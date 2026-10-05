const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto((process.env.BASE_URL || "http://127.0.0.1:3010") + "/development/movement");
    const slider = page.getByRole("slider", { name: "步骤进度" });
    assert.equal(await slider.inputValue(), "0");
    await slider.focus(); await slider.press("ArrowRight"); assert.equal(await slider.inputValue(), "1");
    await page.getByRole("button", { name: "4 回位再准备" }).click();
    const position = () => page.locator('[data-player="A"]').first().getAttribute("cx");
    const cross = Number(await position());
    await page.getByRole("button", { name: "直线球路", exact: true }).click();
    assert.notEqual(Number(await position()), cross);
    const straight = Number(await position());
    await page.getByRole("button", { name: "镜像场地" }).click(); assert.equal(Number(await position()), 190 - straight);
    await page.getByRole("button", { name: "并排比较" }).click(); assert.equal(await page.getByRole("img", { name: /斜线：|直线：/ }).count(), 2);
    await page.screenshot({ path: "../tmp/pdfs/movement-desktop.png", fullPage: true });
    await page.getByRole("button", { name: "回到开始" }).click();
    await page.getByRole("button", { name: "自动分步演示" }).click();
    await page.waitForFunction(() => document.querySelector('input[type="range"]').value === "3");
    await page.getByRole("button", { name: "自动分步演示" }).waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByText(/已遵循减少动态效果偏好/).waitFor();
    assert(await page.getByRole("button", { name: "自动分步演示" }).isDisabled());
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log("PASS movement: keyboard steps, different recovery targets, mirror, comparison, playback stops, reduced motion, mobile layout.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
