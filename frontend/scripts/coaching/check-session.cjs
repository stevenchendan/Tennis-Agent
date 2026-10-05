const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
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
    console.log("Loading session");
    await page.goto(base + "/lessons/001");
    console.log("Loaded session");
    await page.getByRole("button", { name: "进入带课模式", exact: true }).waitFor();
    await page.getByLabel("班级 / 学员", { exact: true }).fill("周六测试班");
    await page.getByLabel("本次人数", { exact: true }).selectOption("2");
    await page.getByLabel("练习难度", { exact: true }).selectOption("easier");
    await page.getByRole("button", { name: "进入带课模式", exact: true }).click();
    console.log("Configured session");
    await page.getByRole("button", { name: "开始计时", exact: true }).click();
    await page.evaluate(() => {
      const original = Date.now;
      Date.now = () => original() + 62000;
    });
    await page.waitForFunction(() => document.querySelector('[role="timer"]').textContent.startsWith("06:5"));
    const time = await page.getByRole("timer").textContent();
    assert(/^06:5[678]$/.test(time), time);
    console.log("Countdown verified");
    await page.getByRole("button", { name: "暂停计时", exact: true }).click();
    const paused = await page.getByRole("timer").textContent();
    await page.evaluate(() => {
      const original = Date.now;
      Date.now = () => original() + 20000;
    });
    assert.equal(await page.getByRole("timer").textContent(), paused);
    await page.reload();
    await page.getByRole("button", { name: "继续本次带课", exact: true }).click();
    assert.equal(await page.getByRole("timer").textContent(), paused);
    console.log("Reload verified");
    await page.getByRole("button", { name: "开始计时", exact: true }).click();
    await page.evaluate(() => {
      const original = Date.now;
      Date.now = () => original() + 450000;
    });
    await page.getByText("本阶段时间到。请确认后进入下一阶段。", { exact: true }).waitFor();
    assert.equal(await page.getByRole("timer").textContent(), "00:00");
    await page.getByRole("button", { name: "下一阶段 →", exact: true }).click();
    assert.equal(await page.getByRole("timer").textContent(), "07:00");
    console.log("Stages verified");
    await page.getByRole("button", { name: "成功 +1", exact: true }).click();
    await page.getByRole("button", { name: "成功 +1", exact: true }).click();
    await page.getByRole("button", { name: "未成功 +1", exact: true }).click();
    await page.getByRole("button", { name: "撤销上一球", exact: true }).click();
    await page.getByLabel("带课备注 / 下次调整", { exact: true }).fill("下次缩短距离，继续合作三拍。");
    await page.screenshot({ path: path.resolve(__dirname, "../../../tmp/pdfs/session-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "保存并结束本次课", exact: true }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("tennis-coach-workspace-v2")));
    assert.equal(stored.history.length, 1);
    assert.equal(stored.history[0].success, 2);
    assert.equal(stored.history[0].attempts, 2);
    assert.equal(stored.history[0].className, "周六测试班");
    assert.equal(stored.history[0].players, 2);
    assert.equal(stored.records["001"].draft.outcomes.length, 0);
    assert.equal(stored.records["001"].draft.deadline, null);
    assert(await page.getByRole("button", { name: "保存并结束本次课", exact: true }).isDisabled());
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.resolve(__dirname, "../../../tmp/pdfs/session-mobile.png"), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: session countdown/background jump, pause, reload, expiry, stage transition, difficulty/participants, observation undo, history save and mobile.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
