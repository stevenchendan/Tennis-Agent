import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from "node:path";
import {root,load} from "./load-tennis-source.mjs";
const arena=name=>load(path.join(root,"src/components/arena1573",name));
const {rallyCourts,courtElevation}=arena("courtPlacements");
const {rallyFrame}=arena("rallyMotion");
const data=JSON.parse(fs.readFileSync('public/data/1573-context.json'));
const courts=rallyCourts(data),mapped=data.features.filter(f=>f.kind==='court');
assert.equal(courts.length,mapped.length,'All mapped courts except detailed 1573, plus JCA');
assert.equal(new Set(courts.map(c=>c.id)).size,courts.length);
for(const f of mapped.filter(f=>f.id!=='way/126844352'))assert.ok(courts.some(c=>c.id===f.id),f.id);
assert.ok(!courts.some(c=>c.id==='way/126844352'),'Do not duplicate 1573');
assert.equal(courts.filter(c=>c.y===5.75).length,5,'Five Eastern Plaza rallies above the deck');
for(const f of mapped.filter(f=>f.surface==='clay'))assert.equal(courts.find(c=>c.id===f.id).y,0);
assert.equal(courts.find(c=>c.id==='way/1239949235').x,154);
assert.equal(courts.find(c=>c.id==='way/1239949236').x,344.8375);
assert.equal(courtElevation(500,1),0);
for(const c of courts){
  assert.ok([c.x,c.y,c.z,c.rotation].every(Number.isFinite));
  for(let t=0;t<13;t+=.1){const f=rallyFrame(t);assert.ok(f.ball.every(Number.isFinite));assert.ok(f.players.every(p=>Math.abs(p.x)<6&&Math.abs(p.z)<15));}
}
console.log(`Rally coverage passed: ${courts.length+1} courts, ${(courts.length+1)*2} players, five elevated rallies; no duplicate 1573.`);
