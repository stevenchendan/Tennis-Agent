// Rebuild the browser rig and motion from the original, attributed assets.
// Rotations are retargeted in world space, then stored in the target hierarchy.
import fs from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result=result; this.onloadend?.(); }); }
};
const base=new URL('../public/models/tennis/',import.meta.url);
const buffer=fs.readFileSync(new URL('quaternius-human.glb',base));
const {scene}=await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
let mesh; scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
mesh.skeleton.pose();
scene.scale.setScalar(1.8/5.53528665); scene.rotation.y=-Math.PI/2;
scene.updateMatrixWorld(true);
const bones=mesh.skeleton.bones, byName=Object.fromEntries(bones.map(b=>[b.name,b]));
const worldPosition=b=>b.getWorldPosition(new T.Vector3());
const worldQuaternion=b=>b.getWorldQuaternion(new T.Quaternion());
const bind=Object.fromEntries(bones.map(b=>[b.name,worldQuaternion(b)]));
// Give the CC0 base mesh tennis apparel colours; the skin and weights stay intact.
const positions=mesh.geometry.attributes.position, colors=[];
for(let i=0;i<positions.count;i++) {
  const p=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
  const torso=Math.abs(p.x)<.245 && p.y>.87 && p.y<1.43;
  const shorts=p.y>.63 && p.y<=.94;
  const c=new T.Color(p.y>1.68?'#493429':p.y<.12?'#e9ece4':shorts?'#233942':torso?'#df7744':'#b98769');
  colors.push(c.r,c.g,c.b);
}
mesh.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
mesh.material=new T.MeshStandardMaterial({vertexColors:true,roughness:.86});
const exported=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});
fs.writeFileSync(new URL('tennis-athlete.glb',base),Buffer.from(exported));
const map={Hips:'Hips',Spine:'Chest',Spine1:'Chest',Spine2:'Chest',Neck:'Neck',Head:'Head',LeftShoulder:'LeftCollar',LeftArm:'LeftShoulder',LeftForeArm:'LeftElbow',LeftHand:'LeftWrist',RightShoulder:'RightCollar',RightArm:'RightShoulder',RightForeArm:'RightElbow',RightHand:'RightWrist',LeftUpLeg:'LeftHip',LeftLeg:'LeftKnee',LeftFoot:'LeftAnkle',RightUpLeg:'RightHip',RightLeg:'RightKnee',RightFoot:'RightAnkle'};
const jointNames=['Hips','Spine2','Neck','Head','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'];
const directions={LeftArm:['LeftForeArm',new T.Vector3(1,0,0)],LeftForeArm:['LeftHand',new T.Vector3(1,0,0)],RightArm:['RightForeArm',new T.Vector3(-1,0,0)],RightForeArm:['RightHand',new T.Vector3(-1,0,0)],LeftUpLeg:['LeftLeg',new T.Vector3(0,-1,0)],LeftLeg:['LeftFoot',new T.Vector3(0,-1,0)],RightUpLeg:['RightLeg',new T.Vector3(0,-1,0)],RightLeg:['RightFoot',new T.Vector3(0,-1,0)]};
for(const [name,[child,axis]] of Object.entries(directions)) {
  const direction=worldPosition(byName[child]).sub(worldPosition(byName[name])).normalize();
  bind[name]=new T.Quaternion().setFromUnitVectors(direction,axis).multiply(bind[name]);
}
// BVH wrist end sites point down in the reference pose; the model's fingers
// point along its outstretched arms. Account for that 90-degree basis difference.
const leftPalm=worldPosition(byName.LeftHandIndex1).sub(worldPosition(byName.LeftHand)).normalize();
bind.LeftHand=new T.Quaternion().setFromUnitVectors(leftPalm,new T.Vector3(0,-1,0)).multiply(bind.LeftHand);
const facing=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI);
const round=v=>v.map(n=>+n.toFixed(6));
const library={};
for(const kind of ['volley','backhand-volley','forehand','overhead']) {
  const {skeleton,clip}=new BVHLoader().parse(fs.readFileSync(new URL(`mocap/${kind}.bvh`,base),'utf8'));
  const root=skeleton.bones[0], source=Object.fromEntries(skeleton.bones.map(b=>[b.name,b]));
  const mixer=new T.AnimationMixer(root); mixer.clipAction(clip).play();
  const sample=t=>{mixer.setTime(t);root.updateMatrixWorld(true);};
  const contact={volley:1.94,'backhand-volley':1.7,forehand:2.12,overhead:2.2}[kind];
  const first=Math.round((contact-(kind==='overhead'?.8:.6))/.02),last=Math.round((contact+.65)/.02);
  sample(contact);
  const origin=worldPosition(root).multiplyScalar(.011);
  const axis=new T.Vector3(...(kind==='overhead'?[-.15,.98,.12]:kind==='backhand-volley'?[.65,.70,.3]:[-.65,.70,.3])).normalize();
  const gripOffset=worldQuaternion(source.RightWrist).invert().multiply(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis));
  const poses=[];
  for(let i=first;i<=last;i++) {
    sample(i*.02); mesh.skeleton.pose(); scene.updateMatrixWorld(true);
    const q=facing.clone().multiply(worldQuaternion(source.RightWrist)).multiply(gripOffset);
    const hip=worldPosition(root).multiplyScalar(.011); hip.x-=origin.x;hip.z-=origin.z;hip.applyQuaternion(facing);
    byName.Hips.position.copy(byName.Hips.parent.worldToLocal(hip));
    // Hierarchy order is essential: each local rotation uses its updated parent.
    for(const bone of bones) {
      if(map[bone.name]) {
        const desired=facing.clone().multiply(worldQuaternion(source[map[bone.name]])).multiply(bind[bone.name]);
        if(bone.name==='RightHand') desired.copy(q).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-Math.PI/2));
        bone.quaternion.copy(worldQuaternion(bone.parent).invert().multiply(desired));
      }
      // Close the racket hand instead of leaving a flat, open paddle hand.
      if(/^RightHandIndex[123]$/.test(bone.name)) bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.9));
      bone.updateWorldMatrix(false,true);
    }
    const j=jointNames.map(n=>worldPosition(byName[n]));
    poses.push({j:j.map(p=>p.toArray()),q:q.toArray(),r:j[9].clone().add(new T.Vector3(.065,.39,.02).applyQuaternion(q)).toArray(),h:byName.Hips.position.toArray(),b:bones.map(b=>b.quaternion.toArray()),foot:Math.min(...['LeftFoot','RightFoot','LeftToeBase','RightToeBase'].map(n=>worldPosition(byName[n]).y))});
  }
  // One floor alignment for the entire clip preserves the recorded rise/fall.
  const floor=Math.min(...poses.map(p=>p.foot))-.035;
  const localShift=new T.Vector3(0,floor,0).divide(byName.Hips.parent.getWorldScale(new T.Vector3()));
  for(const p of poses){p.j=p.j.map(v=>round([v[0],v[1]-floor,v[2]]));p.r=round([p.r[0],p.r[1]-floor,p.r[2]]);p.h=round(new T.Vector3(...p.h).sub(localShift).toArray());p.b=p.b.map(round);p.q=round(p.q);delete p.foot;}
  library[kind]={dt:.02,contact:+(contact-first*.02).toFixed(2),poses};
  console.log(kind,poses.length,'frames, contact',poses[Math.round(library[kind].contact/.02)].r);
}
fs.writeFileSync(new URL('../src/lib/drills/recorded-motion.json',import.meta.url),JSON.stringify(library));
fs.writeFileSync(new URL('../src/lib/tennis-motion/rig-bones.json',import.meta.url),JSON.stringify(bones.map(b=>b.name)));
