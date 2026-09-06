import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const loaded={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/arena1573/GrandSlamOval.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:loaded,exports:loaded.exports,require:()=>THREE});
const group=new THREE.Group();let fixtures=0;
const batch={group,add:()=>{},box:(...args)=>{assert.ok(args.slice(0,6).every(Number.isFinite));fixtures++;},rod:(a,b)=>{assert.ok([...a,...b].every(Number.isFinite));assert.ok(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b))>0);}};
loaded.exports.grandSlamOval(batch);
assert.equal(group.children.length,11,'Three non-overlapping ground regions and eight sails');
let area=0;
for(const mesh of group.children){
  const p=mesh.geometry.getAttribute('position');assert.ok([...p.array].every(Number.isFinite));
  if(group.children.indexOf(mesh)<3){
    for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-.24)<1e-6,'Raised above paths/markings');
    const idx=mesh.geometry.index;
    for(let i=0;i<idx.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,idx.getX(i)),b=new THREE.Vector3().fromBufferAttribute(p,idx.getX(i+1)),c=new THREE.Vector3().fromBufferAttribute(p,idx.getX(i+2));area+=b.sub(a).cross(c.sub(a)).length()/2;}
  }
}
assert.ok(Math.abs(area-Math.PI*92*55)/(Math.PI*92*55)<.001,'Surface regions preserve oval area without stacked full discs');
assert.ok(fixtures>100,'Event fixtures present');
console.log('Oval geometry passed: finite structures, eight sails, raised partitioned ground, preserved area.');
