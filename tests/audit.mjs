/**
 * Full live audit.
 *
 * Checks every section, row, nav link, and probe on the running site, and
 * reports what is working, what is hidden, what is empty, and what errors.
 */
import { chromium } from "playwright";

const EXEC = "/home/hemk651/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const BASE = process.env.BASE || "http://127.0.0.1:8000";

const browser = await chromium.launch({
  headless: true, executablePath: EXEC, args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const report = async (label, viewport) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => requests.push(r.url()));

  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.getElementById("rerun")?.disabled === false, null, { timeout: 30000 }
  );

  const a = await page.evaluate(() => {
    const q = (s) => [...document.querySelectorAll(s)];
    const txt = (e) => (e ? e.textContent.trim() : "");

    const sections = q(".di-section").map((s) => ({
      id: s.id,
      title: txt(s.querySelector(".di-section-title")),
      top: Math.round(s.getBoundingClientRect().top + window.scrollY),
      height: Math.round(s.getBoundingClientRect().height),
      rows: s.querySelectorAll("tbody tr").length,
      visible: s.getBoundingClientRect().height > 0 && getComputedStyle(s).display !== "none",
    }));

    // Rows whose value rendered as empty/em-dash — these are the "exposed to
    // the user" failures.
    const emptyRows = [];
    for (const tr of q(".di-table tbody tr")) {
      const label = txt(tr.querySelector(".di-label"));
      const value = txt(tr.querySelector(".di-value"));
      const tag = txt(tr.querySelector(".di-tag"));
      if (!value || value === "—") emptyRows.push(`${label} [${tag}]`);
    }

    const navLinks = q(".di-nav-link").map((a2) => ({
      text: a2.textContent.trim(),
      href: a2.getAttribute("href"),
    }));

    // Do nav targets actually exist?
    const deadLinks = navLinks
      .filter((l) => !l.href || !document.querySelector(l.href))
      .map((l) => l.text);

    const cards = q("#signals .card").map((c) => ({
      title: txt(c.querySelector(".card-title")),
      blocked: Boolean(c.querySelector(".status.warn")),
      rows: c.querySelectorAll(".row").length,
    }));

    return {
      docHeight: document.documentElement.scrollHeight,
      bits: txt(document.querySelector(".summary-bits")),
      tier: txt(document.querySelector(".summary-tier-label")),
      diTop: Math.round(document.querySelector("#deviceinfo").getBoundingClientRect().top + window.scrollY),
      sections, emptyRows, navLinks, deadLinks, cards,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      leakedObjects: /\[object [A-Za-z]/.test(document.body.innerText),
      // Is anything painted but invisible (zero size, hidden, clipped)?
      invisible: q(".di-section, .card, .di-nav").filter(
        (e) => e.getBoundingClientRect().height === 0 || getComputedStyle(e).visibility === "hidden"
      ).length,
    };
  });

  const external = requests.filter((u) => !u.startsWith(BASE));
  await ctx.close();
  return { label, a, errors, external: external.length, requests: requests.length };
};

const results = [];
for (const [label, vp] of [
  ["desktop 1440x900", { width: 1440, height: 900 }],
  ["mobile 390x844", { width: 390, height: 844 }],
]) {
  results.push(await report(label, vp));
}

for (const { label, a, errors, external, requests } of results) {
  console.log(`\n${"=".repeat(64)}\n${label}\n${"=".repeat(64)}`);
  console.log(`bits ${a.bits} · tier "${a.tier}" · doc ${a.docHeight}px · #deviceinfo at y=${a.diTop}`);
  console.log(`overflowX=${a.overflowX}  leakedObjects=${a.leakedObjects}  invisible=${a.invisible}`);
  console.log(`requests=${requests} external=${external}  errors=${errors.length}`);
  if (errors.length) errors.slice(0, 4).forEach((e) => console.log("  ERR " + e));

  console.log(`\n  SECTIONS (${a.sections.length}):`);
  for (const s of a.sections) {
    console.log(
      `    y=${String(s.top).padStart(6)} h=${String(s.height).padStart(4)} rows=${String(s.rows).padStart(3)} ` +
      `${s.visible ? "OK  " : "HID!"} ${s.title}`
    );
  }

  console.log(`\n  NAV: ${a.navLinks.length} links · dead=${a.deadLinks.length}` +
    (a.deadLinks.length ? ` -> ${a.deadLinks.join(", ")}` : ""));
  if (a.navLinks.length) {
    console.log(`    first: "${a.navLinks[0].text}" -> ${a.navLinks[0].href}`);
  }

  console.log(`\n  EMPTY VALUE ROWS: ${a.emptyRows.length}`);
  a.emptyRows.forEach((r) => console.log("    " + r));

  console.log(`\n  PROBE CARDS: ${a.cards.length} (${a.cards.filter((c) => !c.blocked).length} available, ${a.cards.filter((c) => c.blocked).length} blocked)`);
  for (const c of a.cards.filter((c) => c.blocked)) console.log(`    BLOCKED: ${c.title}`);
}

await browser.close();

// Overall verdict
const d = results[0].a;
const problems = [];
if (results.some((r) => r.errors.length)) problems.push("console/page errors");
if (d.deadLinks.length) problems.push(`${d.deadLinks.length} dead nav links`);
if (d.leakedObjects) problems.push("[object] leak");
if (d.overflowX || results[1].a.overflowX) problems.push("horizontal overflow");
if (d.invisible || results[1].a.invisible) problems.push("invisible blocks");
if (d.sections.length !== 17) problems.push(`${d.sections.length} sections, expected 17`);
if (!d.sections[0].title.startsWith("Browser Detection")) problems.push("first section is not Browser Detection");
if (d.diTop > 1500) problems.push(`#deviceinfo still buried at y=${d.diTop}`);

console.log(`\n${"=".repeat(64)}\nVERDICT: ${problems.length === 0 ? "PASS" : "FAIL"}`);
problems.forEach((p) => console.log("  - " + p));
process.exit(problems.length ? 1 : 0);