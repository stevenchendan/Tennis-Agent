import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const file = new URL("../src/lib/playing-styles.ts", import.meta.url);
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports });
const { playingStyles, sampleStyle, styleTactic, SHOT_SECONDS } = module.exports;
assert.equal(new Set(playingStyles.map(s => s.id)).size, 6);
for (const style of playingStyles) {
  assert.equal(style.contacts.length, style.cues.length + 1);
  assert.equal(style.heights.length, style.cues.length);
  assert.equal(styleTactic(style).frames.length, style.cues.length);
  const duration = style.cues.length * SHOT_SECONDS;
  for (let t = 0; t <= duration; t += .02) {
    const frame = sampleStyle(style, t);
    for (const point of [...frame.players, frame.ball]) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), style.id);
      assert.ok(point.x >= 0 && point.x <= 10.97 && point.y >= 0 && point.y <= 23.77, style.id);
    }
    assert.ok(frame.ball.z >= 0, `${style.id}: ball above surface`);
    if (Math.abs(frame.ball.y - 11.885) < .2) assert.ok(frame.ball.z > .95, `${style.id}: net clearance`);
  }
  for (let i = 1; i < style.cues.length; i++) {
    const before = sampleStyle(style, i * SHOT_SECONDS - 1e-6), after = sampleStyle(style, i * SHOT_SECONDS);
    for (let p = 0; p < 2; p++) assert.ok(Math.hypot(before.players[p].x - after.players[p].x, before.players[p].y - after.players[p].y) < .001, `${style.id}: no player teleport`);
    assert.ok(Math.hypot(before.ball.x - after.ball.x, before.ball.y - after.ball.y, before.ball.z - after.ball.z) < .001, `${style.id}: continuous ball contact`);
    const striker = after.players[i % 2];
    assert.ok(Math.hypot(striker.x - after.ball.x, striker.y - after.ball.y) < .001, `${style.id}: contact meets player marker`);
  }
  assert.equal(sampleStyle(style, duration + 10).index, style.cues.length - 1);
  assert.equal(sampleStyle(style, -10).index, 0);
}
console.log("Six styles passed: timeline bounds, contact continuity, player movement, court bounds and net clearance.");
