import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const base=new URL('../',import.meta.url);
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const bytes=fs.readFileSync(new URL('public/models/tennis/match-athlete.glb',base));
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const names=JSON.parse(fs.readFileSync(new URL('src/lib/tennis-motion/rig-bones.json',base)));
const clips=JSON.parse(fs.readFileSync(new URL('src/lib/drills/recorded-motion.json',base)));
const grip=JSON.parse(fs.readFileSync(new URL('src/lib/tennis-motion/racket-grip.json',base)));
const bones=names.map(n=>scene.getObjectByName(n));
assert.ok(bones.every(b=>b?.isBone));
const pairs=[['RightArm','RightForeArm'],['RightForeArm','RightHand'],['LeftUpLeg','LeftLeg'],['LeftLeg','LeftFoot']];
const at=n=>scene.getObjectByName(n).getWorldPosition(new T.Vector3());
const meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
assert.equal(meshes.length,6,'Body, eyes, hair, shoes, shorts and shirt');
assert.ok(meshes.every(mesh=>mesh.geometry.attributes.skinWeight),'Every garment must follow the skeleton');
const vertex=new T.Vector3();
const originalLengths=pairs.map(([a,b])=>at(a).distanceTo(at(b)));
let minimum=Infinity;
for(const [kind,clip] of Object.entries(clips)) for(let i=0;i<clip.poses.length-1;i++) {
  for(const fraction of [0,.5]) {
    const a=clip.poses[i],b=clip.poses[i+1];
    bones.forEach((bone,j)=>bone.quaternion.fromArray(a.b[j]).slerp(new T.Quaternion().fromArray(b.b[j]),fraction));
    bones[0].position.fromArray(a.h).lerp(new T.Vector3(...b.h),fraction);
    scene.updateMatrixWorld(true);
    pairs.forEach(([a,b],j)=>assert.ok(Math.abs(at(a).distanceTo(at(b))-originalLengths[j])<1e-5,`${kind}: skin bones must not stretch between frames`));
    if(fraction===0){
      assert.ok(at('RightHand').distanceTo(new T.Vector3(...a.j[9]))<1e-4,`${kind}: baked and deployed wrist transforms match`);
      const hand=scene.getObjectByName('RightHand').getWorldQuaternion(new T.Quaternion());
      const racket=hand.clone().multiply(new T.Quaternion(...clip.socket));
      assert.ok(racket.normalize().angleTo(new T.Quaternion(...a.q).normalize())<.001,kind+': grip follows the hand');
      const center=at('RightHand').add(new T.Vector3(...grip.palm).applyQuaternion(hand))
        .add(new T.Vector3(0,grip.centerFromPalm,0).applyQuaternion(racket));
      assert.ok(center.distanceTo(new T.Vector3(...a.r))<1e-4,`${kind}: actual rig reaches the ball marker`);
    }
    for(const mesh of meshes) for(let v=0;v<mesh.geometry.attributes.position.count;v++) {
      const p=mesh.getVertexPosition(v,vertex).applyMatrix4(mesh.matrixWorld);
      minimum=Math.min(minimum,p.y);
      assert.ok(Number.isFinite(p.length()),'Skin vertices must stay finite');
    }
  }
}
assert.ok(minimum>=-.01,'The deformed skin must not penetrate the court');
console.log('Deployed skin verified: hierarchy, interpolated bone lengths, wrist/contact agreement, finite deformed vertices. Lowest vertex:',minimum.toFixed(4),'m');
