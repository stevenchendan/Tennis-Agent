const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { decompressFromEncodedURIComponent } = require("lz-string");
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
    await page.goto(base + "/lessons/052");
    const player = () => page.getByRole("button", { name: "球员A，方向键移动" });
    await player().waitFor();
    const before = Number(await player().locator("circle").nth(1).getAttribute("cx"));
    await player().focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(Number(await player().locator("circle").nth(1).getAttribute("cx")), before + 3);
    await page.reload();
    await player().waitFor();
    await page.waitForFunction(
      (x) => JSON.parse(localStorage.getItem("tennis-lesson-court-v1:052")).players[0][0] === x,
      before + 3,
    );
    assert.equal(Number(await player().locator("circle").nth(1).getAttribute("cx")), before + 3);
    const box = await player().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 12, { steps: 6 });
    await page.mouse.up();
    assert(Number(await player().locator("circle").nth(1).getAttribute("cx")) > before + 3);
    await page.getByText("调整布置与站位", { exact: true }).click();
    await page.getByRole("button", { name: "恢复课程布置", exact: true }).click();
    assert.equal(Number(await player().locator("circle").nth(1).getAttribute("cx")), before);
    await page.getByRole("button", { name: "左右镜像", exact: true }).click();
    assert.equal(Number(await player().locator("circle").nth(1).getAttribute("cx")), 190 - before);
    await page.getByRole("button", { name: "撤销调整", exact: true }).click();
    assert.equal(Number(await player().locator("circle").nth(1).getAttribute("cx")), before);
    await page.getByRole("button", { name: "球路 2", exact: true }).click();
    await page.getByRole("button", { name: "播放本条球路", exact: true }).click();
    await page.getByTestId("demo-ball").waitFor();
    await page.getByRole("button", { name: "停止演示", exact: true }).click();
    await page.getByLabel("目标区", { exact: true }).uncheck();
    assert.equal(await page.getByRole("button", { name: /目标区1，/ }).count(), 0);
    await page.getByLabel("目标区", { exact: true }).check();
    await page.screenshot({ path: path.resolve(__dirname, "../../../tmp/pdfs/court-desktop.png"), fullPage: true });
    await page.goto(base + "/lessons/096");
    await page.getByRole("button", { name: "球员D，方向键移动" }).waitFor();
    const href = await page.getByRole("link", { name: /在自由战术板继续编辑/ }).getAttribute("href");
    const tactic = JSON.parse(
      decompressFromEncodedURIComponent(new URL(href, base).searchParams.get("import").replaceAll("_", "+")),
    );
    assert.equal(tactic.frames[0].players.length, 4);
    assert.equal(tactic.frames[0].paths.length, 2);
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "播放本条球路", exact: true }).click();
    await page.getByText("已按减少动态偏好显示该球路终点。", { exact: true }).waitFor();
    const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const tp = await touch.newPage();
    await tp.goto(base + "/lessons/001");
    const target = tp.getByRole("button", { name: "球员A，方向键移动" });
    await target.scrollIntoViewIfNeeded();
    const tb = await target.boundingBox(),
      tx = tb.x + tb.width / 2,
      ty = tb.y + tb.height / 2,
      cdp = await touch.newCDPSession(tp);
    const oldX = Number(await target.locator("circle").nth(1).getAttribute("cx"));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tx, y: ty }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: tx + 25, y: ty }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert(Number(await target.locator("circle").nth(1).getAttribute("cx")) > oldX);
    await touch.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: court mouse/touch drag, keyboard, persistence, reset, mirror, undo, playback, overlays, doubles export, mobile/reduced motion.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
