const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "../..");
const out = path.resolve(root, "../output");
fs.mkdirSync(path.join(out, "pdf"), { recursive: true });
fs.mkdirSync(path.join(root, "../tmp/pdfs"), { recursive: true });
const html = fs.readFileSync(path.join(root, "public/coaching/index.html"));
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:" + server.address().port);
    assert.equal(await page.locator(".lesson-item").count(), 120);
    for (let level = 1; level <= 6; level++) {
      await page.selectOption("#level", String(level));
      assert.equal(await page.locator(".lesson-item").count(), 20);
    }
    await page.selectOption("#level", "");
    await page.fill("#search", "反手");
    assert((await page.locator(".lesson-item").count()) > 10);
    await page.fill("#search", "不可能存在的测试词");
    assert.equal(await page.locator(".lesson-item").count(), 0);
    await page.fill("#search", "");
    await page.evaluate(() => pick("001"));
    for (const duration of ["45", "60", "90"]) {
      await page.selectOption("#duration", duration);
      const sum = await page.locator("#detail .time strong").allTextContents();
      assert.equal(
        sum.reduce((n, x) => n + parseInt(x), 0),
        Number(duration),
      );
    }
    await page.selectOption("#duration", "60");
    await page.locator("#star").click();
    await page.locator("#done").click();
    await page.fill("#note", "测试记录：二发7/10，下一次练回位。");
    await page.fill("#className", "测试班");
    await page.reload();
    assert.equal(await page.locator("#note").inputValue(), "测试记录：二发7/10，下一次练回位。");
    assert.equal(await page.locator("#done").getAttribute("aria-pressed"), "true");
    await page.selectOption("#saved", "star");
    assert.equal(await page.locator(".lesson-item").count(), 1);
    await page.selectOption("#saved", "");
    const downloadPromise = page.waitForEvent("download");
    await page.click("#export");
    const download = await downloadPromise;
    const backupPath = path.join(root, "../tmp/pdfs/qa-backup.json");
    await download.saveAs(backupPath);
    assert.equal(JSON.parse(fs.readFileSync(backupPath)).records["001"].className, "测试班");
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.setInputFiles("#import-file", backupPath);
    await page.waitForFunction(() => document.getElementById("note").value.includes("二发7/10"));
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.selectOption("#level", "6");
    await page.locator('[data-id="120"]').click();
    assert((await page.locator("#detail h2").textContent()).includes("下一周期"));
    await page.screenshot({ path: path.join(root, "../tmp/pdfs/library-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(root, "../tmp/pdfs/library-mobile.png"), fullPage: true });
    // Inspect every lesson at narrow width; no unresolved placeholders or empty instructional fields.
    for (const l of JSON.parse(fs.readFileSync(path.join(root, "public/coaching/lessons.json"))).lessons) {
      assert.equal(
        Object.values(l).some((x) => typeof x === "string" && !x.trim()),
        false,
      );
      await page.evaluate((id) => pick(id), l.id);
      assert.equal(await page.locator("#detail .block").count(), 6);
      assert.equal(await page.locator("#detail svg").count(), 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow ${l.id}`);
    }
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.evaluate(() => {
      const contents = DATA.levels
        .map(
          (lev) =>
            `<section class="print-guide"><div class="eyebrow">课程目录 / ${lev.id} of 6</div><h1>${lev.name}</h1><p>${lev.entry}</p><table><thead><tr><th>课号</th><th>主题</th><th>本课目标</th></tr></thead><tbody>${DATA.lessons
              .filter((l) => l.level === lev.id)
              .map((l) => `<tr><td>${l.id}</td><td>${l.title}</td><td>${l.objective}</td></tr>`)
              .join("")}</tbody></table></section>`,
        )
        .join("");
      document.getElementById("print-area").innerHTML =
        guidePrintHTML() + contents + DATA.lessons.map((l) => lessonHTML(l, true)).join("");
    });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: path.join(out, "pdf/网球教练120课-完整手册.pdf"),
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:8px;width:100%;text-align:center;color:#777">TENNIS / COACH FIELD BOOK &nbsp; <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(root, "../tmp/pdfs/qa-result.json"),
      JSON.stringify(
        {
          lessons: 120,
          levels: 6,
          filters: true,
          durations: [45, 60, 90],
          notesPersistence: true,
          backupRestore: true,
          mobileAll120: true,
          consoleErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: 120 lesson pages, six levels, filters, durations, notes, backup/restore, mobile overflow, PDF export.",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
