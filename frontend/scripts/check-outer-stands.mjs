import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
function load(file){const loaded={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/components/arena1573/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:loaded,exports:loaded.exports,require:()=>THREE});return loaded.exports;}
const {courtFrame,pointInRing}=load('precinctGeometry'),{outerCourtStands,outerStandLayout}=load('OuterCourtStands');
const data=JSON.parse(fs.readFileSync('public/data/1573-context.json'));
const courts=data.features.filter(f=>f.kind==='court'),group=new THREE.Group(),crowd=new THREE.Group();
const batch={group,box:(x,y,z,w,h,d,color,angle)=>{
  assert.ok([x,y,z,w,h,d,angle].every(Number.isFinite));
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const u=sx*w/2,v=sz*d/2,p=[x+u*Math.cos(angle)+v*Math.sin(angle),z-u*Math.sin(angle)+v*Math.cos(angle)];
    assert.ok(!courts.some(c=>pointInRing(p,c.points)),'Stand tiers must not enter any court apron');
  }
},rod:()=>{}};
for(const name of Object.keys(outerStandLayout)){const court=courts.find(c=>c.name===name);assert.ok(court,name);outerCourtStands(batch,courtFrame(court.points),name,crowd);}
assert.equal(group.children.length,9,'Nine grandstands across eight courts');
assert.equal(crowd.children.length,18,'Body/head instances for every stand');
console.log('Outer stands passed: nine stands, eight mapped courts, no tier corners inside court aprons.');
