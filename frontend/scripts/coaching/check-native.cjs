const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(60000);
    const base = process.env.BASE_URL || "http://127.0.0.1:3010";
    await page.goto(base + "/lessons", { timeout: 120000 });
    await page.getByRole("heading", { name: /下一节课/ }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/lessons");
    assert((await page.getByRole("status").textContent()).includes("120"));
    await page.getByRole("button", { name: "06 / 比赛", exact: true }).click();
    await page.waitForURL(/level=6/);
    assert((await page.getByRole("status").textContent()).includes("20"));
    await page.getByLabel("搜索课题或课号").fill("找不到这个课题");
    await page.getByRole("heading", { name: "没有找到这类课程" }).waitFor();
    await page.getByRole("button", { name: "查看全部120课" }).click();
    await page.getByRole("link", { name: "打开教案001：第一次把球送过网" }).click();
    await page.getByRole("heading", { name: "第一次把球送过网", exact: true }).waitFor();
    await page.getByRole("button", { name: "90分钟", exact: true }).click();
    await page.getByText(/83—90′/).waitFor();
    const out = path.resolve(__dirname, "../../../tmp/pdfs");
    fs.mkdirSync(out, { recursive: true });
    await page.screenshot({ path: path.join(out, "native-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, "native-mobile.png"), fullPage: true });
    await page.goto(base + "/lessons/096");
    await page.getByRole("heading", { name: "双打双底线接发策略", exact: true }).waitFor();
    const response = await page.goto(base + "/lessons/not-a-lesson");
    assert.equal(response.status(), 404);
    assert.deepEqual(errors, []);
    console.log("PASS native routes, filters, empty results, duration, mobile, doubles and 404.");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
