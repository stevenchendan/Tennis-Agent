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
    page.setDefaultTimeout(30000);
    const base = process.env.BASE_URL || "http://127.0.0.1:3010";
    await page.goto(base + "/lessons");
    await page.evaluate(() =>
      localStorage.setItem(
        "tennis-coaching-120-v1",
        JSON.stringify({
          records: {
            "001": {
              star: true,
              done: true,
              note: "旧版笔记",
              date: "2026-10-01",
              className: "旧版班级",
              players: "4",
            },
          },
        }),
      ),
    );
    await page.reload();
    await page.getByRole("button", { name: "取消收藏教案001", exact: true }).waitFor();
    await page.getByLabel("我的教案", { exact: true }).selectOption("favorites");
    await page.waitForURL(/saved=favorites/);
    assert.equal(await page.locator("article:visible").count(), 1);
    await page.locator("summary").filter({ hasText: "课堂记录与备份" }).click();
    await page.getByText("旧版笔记", { exact: true }).waitFor();
    const layout = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../public/coaching/lessons.json"))).diagrams
      .mini;
    layout.players[0][0] += 4;
    await page.evaluate((layout) => {
      localStorage.setItem("tennis-lesson-court-v1:001", JSON.stringify(layout));
      const s = JSON.parse(localStorage.getItem("tennis-coach-workspace-v2"));
      s.records["001"].draft.deadline = Date.now() + 60000;
      s.records["001"].draft.startedAt = new Date().toISOString();
      localStorage.setItem("tennis-coach-workspace-v2", JSON.stringify(s));
    }, layout);
    await page.reload();
    await page.locator("summary").filter({ hasText: "课堂记录与备份" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "备份全部记录", exact: true }).click();
    const download = await downloadPromise;
    const file = path.resolve(__dirname, "../../../tmp/pdfs/native-records.json");
    await download.saveAs(file);
    const exported = JSON.parse(fs.readFileSync(file));
    assert.equal(exported.records["001"].draft.deadline, null);
    assert(exported.records["001"].draft.remaining <= 60);
    assert.equal(exported.history.length, 1);
    assert.equal(exported.courts["001"].players[0][0], layout.players[0][0]);
    await page.evaluate(() => localStorage.clear());
    await page.goto(base + "/lessons#records");
    await page.reload();
    await page.getByLabel("选择记录备份文件", { exact: true }).setInputFiles(file);
    await page.getByRole("heading", { name: "合并预览", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("tennis-coach-workspace-v2")), null);
    await page.getByRole("button", { name: "合并这份备份", exact: true }).click();
    await page.getByText("备份已合并；恢复的计时器均为暂停状态。", { exact: true }).waitFor();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tennis-coach-workspace-v2")));
    assert.equal(saved.history.length, 1);
    assert.equal(saved.records["001"].favorite, true);
    assert.equal(saved.records["001"].draft.deadline, null);
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem("tennis-lesson-court-v1:001")).players[0][0]),
      layout.players[0][0],
    );
    await page.getByLabel("选择记录备份文件", { exact: true }).setInputFiles(file);
    await page.getByRole("button", { name: "合并这份备份", exact: true }).click();
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem("tennis-coach-workspace-v2")).history.length),
      1,
    );
    const bad = path.resolve(__dirname, "../../../tmp/pdfs/invalid-records.json");
    exported.records["001"].draft.players = 999;
    fs.writeFileSync(bad, JSON.stringify(exported));
    const before = await page.evaluate(() => localStorage.getItem("tennis-coach-workspace-v2"));
    await page.getByLabel("选择记录备份文件", { exact: true }).setInputFiles(bad);
    await page.getByText(/无法读取：请使用本项目/).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("tennis-coach-workspace-v2")), before);
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.resolve(__dirname, "../../../tmp/pdfs/records-mobile.png"), fullPage: true });
    await page.evaluate(() => localStorage.setItem("tennis-coach-workspace-v2", "{broken"));
    await page.reload();
    await page.getByText(/记录格式异常，已保留原文副本/).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("tennis-coach-workspace-v2-recovery")), "{broken");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: legacy migration, favorites, history, paused timer/court backup, explicit restore preview, deduplication, invalid import rejection, corruption recovery and mobile.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
