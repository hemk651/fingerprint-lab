import { chromium } from "playwright";
const EXEC = "/home/hemk651/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const b = await chromium.launch({headless:true,executablePath:EXEC,args:["--no-sandbox","--disable-dev-shm-usage"]});

async function test(url, label) {
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("console", m => { if (m.type()==="error") errs.push("console: "+m.text().slice(0,90)); });
  const reqs = [];
  p.on("request", r => reqs.push(r.url()));

  await p.goto(url);
  // Wait for the app to signal completion.
  let done = true;
  try {
    await p.waitForFunction(()=>document.getElementById("rerun")?.disabled===false,null,{timeout:25000});
  } catch { done = false; }

  const s = await p.evaluate(() => ({
    status: document.getElementById("status")?.textContent?.slice(0,60),
    sections: document.querySelectorAll(".di-section").length,
    rows: document.querySelectorAll(".di-table tbody tr").length,
    cards: document.querySelectorAll("#signals .card").length,
    bits: document.querySelector(".summary-bits")?.textContent,
    nav: document.querySelectorAll(".di-nav-link").length,
    browser: [...document.querySelectorAll(".di-table tbody tr")]
      .find(t=>t.textContent.includes("Detected Browser"))?.children[1]?.textContent,
    fatal: !!document.querySelector(".fatal"),
  }));
  console.log(`\n${label}`);
  console.log(`  completed: ${done}   fatal banner: ${s.fatal}`);
  console.log(`  status   : ${JSON.stringify(s.status)}`);
  console.log(`  bits     : ${s.bits}   sections: ${s.sections}   rows: ${s.rows}   cards: ${s.cards}   nav: ${s.nav}`);
  console.log(`  browser  : ${s.browser}`);
  console.log(`  requests : ${reqs.length}  errors: ${errs.length}`);
  errs.slice(0,3).forEach(e=>console.log("    " + e));
  await p.close();
  return {...s, done, errors: errs.length, reqs: reqs.length};
}

const a = await test("file:///home/hemk651/project/datacollection/dist/fingerprint-lab.html", "STANDALONE  dist/fingerprint-lab.html  (file:// — double-click)");
const b2 = await test("file:///home/hemk651/project/datacollection/docs/index.html", "SOURCE     docs/index.html  (file:// — should show the error banner)");
await b.close();

console.log("\n" + "=".repeat(60));
const ok = a.done && a.sections===17 && a.cards===27 && a.errors===0 && b2.fatal===true;
console.log(ok ? "PASS" : "FAIL");
if(!ok) console.log("  standalone:",JSON.stringify({done:a.done,sections:a.sections,cards:a.cards,errors:a.errors}),"source-fatal:",b2.fatal);
