/**
 * Focused verification: browser detection is category one.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const ROOT = "/home/hemk651/project/datacollection/docs/";
const PORT = 8741;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const safe = normalize(join(ROOT, rel));
    if (!safe.startsWith(ROOT)) return res.writeHead(403).end("no");
    const body = await readFile(safe);
    res.writeHead(200, { "Content-Type": TYPES[extname(safe)] || "text/plain" });
    res.end(body);
  } catch (e) { res.writeHead(e.code === "ENOENT" ? 404 : 500).end("err"); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const EXEC = [
  "/home/hemk651/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  "/home/hemk651/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].find((p) => existsSync(p));

const browser = await chromium.launch({ headless: true, executablePath: EXEC, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const requests = [], errors = [];
page.on("request", (r) => requests.push(r.url()));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: "load" });
await page.waitForFunction(() => document.getElementById("rerun")?.disabled === false, null, { timeout: 30000 });

const r = await page.evaluate(() => {
  const sections = [...document.querySelectorAll(".di-section .di-section-title")].map((s) => s.textContent);
  const bd = document.querySelector(".di-section");
  const bdRows = bd ? [...bd.querySelectorAll("tbody tr")].map((tr) => {
    const [label, value, tag] = [...tr.children].map((td) => td.textContent.trim());
    return `${label}: ${value}`;
  }) : [];
  return {
    firstSection: sections[0],
    sectionOrder: sections,
    browserSectionRows: bdRows,
    totalCards: document.querySelectorAll("#signals .card").length,
    families: document.querySelectorAll(".family").length,
    bits: Number(document.querySelector(".summary-bits")?.textContent || 0),
  };
});

console.log("=== BROWSER DETECTION (category one) ===");
console.log(`first section in report : ${r.firstSection}`);
console.log(`section order          : ${r.sectionOrder.join(" | ")}`);
console.log(`signal cards            : ${r.totalCards}   families: ${r.families}   bits: ${r.bits}`);
console.log("\nBrowser Detection rows:");
for (const row of r.browserSectionRows) console.log("  " + row);

const external = requests.filter((u) => !u.startsWith(`http://127.0.0.1:${PORT}`));
console.log(`\nrequests ${requests.length} (external ${external.length}) · errors ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log("  " + e);

await browser.close();
server.close();

const problems = [];
if (r.firstSection !== "Browser Detection") problems.push(`first section is "${r.firstSection}", expected "Browser Detection"`);
if (r.browserSectionRows.length < 12) problems.push("browser section has too few rows");
if (external.length) problems.push(`${external.length} external requests`);
if (errors.length) problems.push(`${errors.length} console errors`);

console.log("\n=== VERDICT ===");
if (problems.length === 0) { console.log("PASS"); process.exit(0); }
console.log("FAIL");
for (const p of problems) console.log("  - " + p);
process.exit(1);
