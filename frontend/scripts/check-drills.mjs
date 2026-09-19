import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import {Vector3,Quaternion} from 'three';
const drillsDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/lib/drills');
function load(name,from=drillsDir) {
  const target=path.resolve(from,name)+(path.extname(name)?'':'.ts');
  if(target.endsWith('.json')) return JSON.parse(fs.readFileSync(target,'utf8'));
  const module={exports:{}};
  const source=fs.readFileSync(target,'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:p=>load(p,path.dirname(target))});
  return module.exports;
}
const { getFrame, DURATION, court, activeHalves } = load('motion');
const {recordedContact,recordedSample}=load('recorded-motion');
const {studioUnits,studioFrame}=load('../tennis-motion/studio');
const {recordingFor}=load('recorded-motion');
assert.throws(()=>recordingFor('serve'),/No recording available/);
assert.throws(()=>recordingFor('unrecognised-stroke'),/Unknown tennis technique/);
assert.equal(recordingFor('forehand-groundstroke'),'forehand');
for(const unit of studioUnits) {
  if(unit.status==='Not available') {
    assert.throws(()=>studioFrame(unit,0),/Unit unavailable/);
    continue;
  }
  for(let time=0;time<=unit.duration;time+=.02) {
    const frame=studioFrame(unit,time);
    for(const actor of frame.players) for(const key of ['x','y','z','vx','vy','travel']) assert.ok(Number.isFinite(actor[key]),`${unit.id}: finite ${key}`);
    assert.equal(frame.players.length,unit.category==='Strategy'?2:1);
  }
  if(unit.kind) {
    const frame=studioFrame(unit,unit.contact);
    const [x,height,z]=recordedContact(unit.kind);
    assert.ok(Math.hypot(frame.strokes[0].point.x-x,frame.strokes[0].point.y-16-z,frame.strokes[0].point.z-height)<1e-8,'Studio contact matches the shared racket pose');
  }
}
console.log('Movement lab checks passed: isolated previews, contact markers and unavailable-unit handling.');
for (const outcome of ['rally', 'mercy', 'double-miss']) {
  for (const moonball of [false, true]) {
    for (let t = 0; t <= DURATION; t += .05) {
      const f = getFrame(t, outcome, moonball);
      assert.equal(new Set(f.players.map(p => p.id)).size, 2);
      assert.equal(f.players[0].id, '1');
      assert.equal(f.players[1].id, '2');
      assert.ok(f.players[0].y < court.length / 2 && f.players[1].y > court.length / 2, 'Players stay on opposite sides');
      for (const p of [...f.players, ...(f.ball ? [f.ball] : [])]) for (const c of ['x', 'y', 'z']) assert.ok(Number.isFinite(p[c]));
      if (f.ball) assert.ok(f.ball.z >= 0);
    }
  }
}
// The second pairing changes court halves and uses a true backhand volley.
for (const t of [2, 3.5, 4.2, 5, 6]) {
  const a = getFrame(t), b = getFrame(t + 16);
  assert.ok(a.players[0].x < court.width/2 && b.players[0].x > court.width/2);
  assert.ok(a.ball && b.ball && Number.isFinite(a.ball.y) && Number.isFinite(b.ball.y));
}
assert.ok(getFrame(0).strokes.some(s => s.id === '1' && s.kind === 'volley'));
assert.ok(getFrame(16).strokes.some(s => s.id === '1' && s.kind === 'backhand-volley'));
assert.equal(getFrame(9.2, 'double-miss').penalty, '1');
assert.equal(getFrame(25.2, 'double-miss').penalty, '1');
assert.equal(getFrame(9.2, 'mercy').penalty, null);
assert.ok(getFrame(2, 'rally', true).ball.z > getFrame(2).ball.z);
assert.equal(getFrame(12.5).players.find(p => p.id === '2').y, 28);
assert.equal(getFrame(28.5).players.find(p => p.id === '2').y, 28);
assert.equal(getFrame(16).round, 1);
assert.equal(getFrame(32).phase, 5);
assert.ok(getFrame(8.4, 'mercy').ball, 'A made mercy feed must continue into a rally');
assert.ok(getFrame(8.8, 'mercy').strokes.some(s => s.id === '2' && s.time === 8), 'Defender returns the mercy overhead');
assert.ok(getFrame(9.5, 'mercy').ball.x > 9.6, 'Example should demonstrate a legal alley landing');
assert.equal(activeHalves(0)[0].x, 0, 'Active half includes doubles alley');
assert.equal(activeHalves(1)[1].x, 0, 'Opposite pairing swaps highlighted halves');
// No mid-shot teleportation at racket contacts or court bounces.
for (const outcome of ['rally', 'mercy', 'double-miss']) {
  for (const round of [0, 16]) {
    const frame = getFrame(round, outcome);
    for (const stroke of frame.strokes) {
      const hit = getFrame(round + stroke.time, outcome);
      assert.ok(Math.hypot(hit.ball.x - stroke.point.x, hit.ball.y - stroke.point.y, hit.ball.z - stroke.point.z) < .00001, 'Ball must meet the authored racket centre');
    }
  }
}
assert.ok(Math.abs(getFrame(4.1).ball.z - .034) < 1e-8, 'Groundstroke starts after a ground bounce');
assert.ok(getFrame(4.09).ball.z > getFrame(4.1).ball.z);
assert.ok(getFrame(4.11).ball.z > getFrame(4.1).ball.z);
for (let t = 1.501; t < 6.64; t += .005) {
  const a = getFrame(t).ball, b = getFrame(t + .001).ball;
  if (a && b) assert.ok(Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z) < .05, 'Ball must follow a continuous trajectory');
  if (a && Math.abs(a.y - 11.885) < .08) assert.ok(a.z > 1, 'Successful shot must clear the net');
}
console.log('Drill motion passed: finite frames, mirrored pairings, penalties, recovery, racket contacts, bounces, trajectory continuity and net clearance.');

for (const boundary of [16, 32]) {
  const a = getFrame(boundary - .001), b = getFrame(boundary === 32 ? 0 : boundary);
  for (let i = 0; i < 2; i++) assert.ok(Math.hypot(a.players[i].x - b.players[i].x, a.players[i].y - b.players[i].y) < .001, 'Player positions remain continuous across diagonals and loops');
}
const feedFrame = getFrame(1.5), feeder = feedFrame.players.find(p => p.id === '2');
assert.ok(Math.hypot(feedFrame.ball.x - feeder.x, feedFrame.ball.y - feeder.y) < 1.2, 'P2 supplies the feed');
for(const outcome of ['rally','mercy','double-miss']) for(const round of [0,16]) {
  for(const stroke of getFrame(round,outcome).strokes) {
    const frame=getFrame(round+stroke.time,outcome), actor=frame.players.find(p=>p.id===stroke.id);
    const [x,y,z]=recordedContact(stroke.kind), direction=actor.y<court.length/2?-1:1;
    assert.ok(Math.hypot(frame.ball.x-actor.x-x*direction,frame.ball.z-y,frame.ball.y-actor.y-z*direction)<1e-5,'Recorded racket and ball meet on both diagonals');
    assert.equal(recordedSample(stroke.kind,0).weight,1);
  }
}
assert.equal(getFrame(1).players[0].movement, 'approach');
assert.equal(getFrame(3).players[0].movement, 'stroke');
assert.equal(getFrame(3.9).players[0].movement, 'close');
assert.equal(getFrame(4.38).players[0].movement, 'split-step');
assert.equal(getFrame(11).players[0].movement, 'recover');
assert.equal(getFrame(14).players[0].movement, 'reset');
for (const id of ['1','2']) {
  let previous=0;
  for(let t=0;t<=32;t+=.05){
    const travel=getFrame(t).players.find(p=>p.id===id).travel;
    assert.ok(travel + .0001 >= previous, `${id}: locomotion distance must be monotonic across both diagonals`);
    previous=travel;
  }
}
console.log('Footwork state checks passed: approach, stroke, close, split-step, recovery and reset.');
console.log('Recorded motion checks passed: ball/racket alignment and consistent handedness on both diagonals.');
for(const [kind,clip] of Object.entries(load('recorded-motion.json'))) {
  const pairs=[[7,8],[8,9],[4,5],[5,6],[10,11],[11,12],[13,14],[14,15]];
  const lengths=pairs.map(([a,b])=>new Vector3(...clip.poses[0].j[a]).distanceTo(new Vector3(...clip.poses[0].j[b])));
  for(const pose of clip.poses) {
    const racket=new Vector3(.065,.39,.02).applyQuaternion(new Quaternion(...pose.q)).add(new Vector3(...pose.j[9]));
    assert.ok(racket.distanceTo(new Vector3(...pose.r))<.00003,kind+': rendered grip must match contact data');
    assert.ok(Math.min(pose.j[12][1],pose.j[15][1])>=.034,kind+': ankles must stay above the floor');
    assert.ok(pose.b.length>30,kind+': full skinned skeleton is retained');
    for(const q of pose.b) assert.ok(Math.abs(Math.hypot(...q)-1)<.00001,kind+': rotations must remain normalized');
    pairs.forEach(([a,b],i)=>assert.ok(Math.abs(new Vector3(...pose.j[a]).distanceTo(new Vector3(...pose.j[b]))-lengths[i])<.0001,kind+': captured limbs must not stretch'));
  }
}
console.log('Recorded skeleton checks passed: grip calibration, floor bounds, normalized rotations and constant limb lengths.');
