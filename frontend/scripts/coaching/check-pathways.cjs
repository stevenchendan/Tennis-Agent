const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto((process.env.BASE_URL || "http://127.0.0.1:3010") + "/development/pathways?level=3&age=6-9");
    await page.getByRole("heading", { name: "学会读取比赛局面" }).waitFor();
    const links = () => page.getByRole("link", { name: /打开第/ }).evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
    const initial = await links(); assert.equal(initial.length, 4);
    await page.getByLabel("年龄背景", { exact: true }).selectOption("16-18");
    assert.deepEqual(await links(), initial);
    await page.getByLabel("实际能力", { exact: true }).selectOption("1");
    await page.getByRole("heading", { name: "从送球到小场比赛" }).waitFor();
    assert.notDeepEqual(await links(), initial);
    await page.reload();
    await page.getByRole("heading", { name: "从送球到小场比赛" }).waitFor();
    assert.equal(await page.getByLabel("年龄背景", { exact: true }).inputValue(), "16-18");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: "../tmp/pdfs/pathways-mobile.png" });
    for (const href of await links()) { const res = await page.request.get(new URL(href, page.url()).href); assert.equal(res.status(), 200); }
    await page.goto((process.env.BASE_URL || "http://127.0.0.1:3010") + "/development/pathways?level=99&age=invalid");
    await page.getByRole("heading", { name: "从送球到小场比赛" }).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS pathways: age independent of ability, sequence changes, URL reload, valid lesson links, invalid query fallback, mobile layout.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
