const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto((process.env.BASE_URL || "http://127.0.0.1:3010") + "/development/decisions");
    await page.getByRole("button", { name: "加到最大力量，追求压线" }).click();
    await page.getByRole("heading", { name: "再看看时间、平衡和对手位置" }).waitFor();
    await page.getByRole("button", { name: "下一情境" }).click();
    assert.equal(await page.getByRole("status").count(), 0);
    await page.getByRole("button", { name: "缩短准备，挡回深中路" }).click();
    await page.getByRole("heading", { name: "这个选择符合当前情境" }).waitFor();
    await page.getByRole("button", { name: "上一情境" }).click();
    await page.getByRole("heading", { name: "再看看时间、平衡和对手位置" }).waitFor();
    await page.getByRole("button", { name: "重试本题" }).click();
    await page.getByRole("button", { name: "中等速度发向反手大区" }).click();
    await page.getByText(/本轮已练 2 \/ 6 · 符合情境 2/).waitFor();
    await page.getByRole("link", { name: /去练习/ }).waitFor();
    for (let i = 3; i <= 6; i++) {
      await page.getByRole("button", { name: `情境 ${i}`, exact: true }).click();
      await page.getByRole("group", { name: "这一拍怎么选" }).getByRole("button").first().click();
      const href = await page.getByRole("link", { name: /去练习/ }).getAttribute("href");
      assert.equal((await page.request.get(new URL(href, page.url()).href)).status(), 200);
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: "../tmp/pdfs/decisions-mobile.png", fullPage: true });
    await page.reload(); await page.getByText(/本轮已练 0 \/ 6/).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS decisions: incorrect/correct feedback, independent scenarios, retries, progress, lesson links, mobile and restart.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
