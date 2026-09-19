import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const base=new URL('../',import.meta.url);
const bytes=fs.readFileSync(new URL('public/models/tennis/tennis-athlete.glb',base));
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const names=JSON.parse(fs.readFileSync(new URL('src/lib/tennis-motion/rig-bones.json',base)));
const clips=JSON.parse(fs.readFileSync(new URL('src/lib/drills/recorded-motion.json',base)));
const bones=names.map(n=>scene.getObjectByName(n));
assert.ok(bones.every(b=>b?.isBone));
const pairs=[['RightArm','RightForeArm'],['RightForeArm','RightHand'],['LeftUpLeg','LeftLeg'],['LeftLeg','LeftFoot']];
const at=n=>scene.getObjectByName(n).getWorldPosition(new T.Vector3());
let mesh;scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
assert.ok(mesh?.geometry.attributes.skinWeight,'The deployed asset must contain a weighted skin');
const originalLengths=pairs.map(([a,b])=>at(a).distanceTo(at(b)));
let minimum=Infinity;
for(const [kind,clip] of Object.entries(clips)) for(let i=0;i<clip.poses.length-1;i++) {
  for(const fraction of [0,.5]) {
    const a=clip.poses[i],b=clip.poses[i+1];
    bones.forEach((bone,j)=>bone.quaternion.fromArray(a.b[j]).slerp(new T.Quaternion().fromArray(b.b[j]),fraction));
    bones[0].position.fromArray(a.h).lerp(new T.Vector3(...b.h),fraction);
    scene.updateMatrixWorld(true);mesh.skeleton.update();
    pairs.forEach(([a,b],j)=>assert.ok(Math.abs(at(a).distanceTo(at(b))-originalLengths[j])<1e-5,`${kind}: skin bones must not stretch between frames`));
    if(fraction===0){
      assert.ok(at('RightHand').distanceTo(new T.Vector3(...a.j[9]))<1e-4,`${kind}: baked and deployed wrist transforms match`);
      const center=at('RightHand').add(new T.Vector3(.065,.39,.02).applyQuaternion(new T.Quaternion(...a.q)));
      assert.ok(center.distanceTo(new T.Vector3(...a.r))<1e-4,`${kind}: actual rig reaches the ball marker`);
    }
    for(let v=0;v<mesh.geometry.attributes.position.count;v++) {
      const p=mesh.getVertexPosition(v,new T.Vector3()).applyMatrix4(mesh.matrixWorld);
      minimum=Math.min(minimum,p.y);
      assert.ok(Number.isFinite(p.length()),'Skin vertices must stay finite');
    }
  }
}
assert.ok(minimum>=-.01,'The deformed skin must not penetrate the court');
console.log('Deployed skin verified: hierarchy, interpolated bone lengths, wrist/contact agreement, finite deformed vertices. Lowest vertex:',minimum.toFixed(4),'m');
