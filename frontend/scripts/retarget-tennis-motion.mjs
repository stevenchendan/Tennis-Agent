// Rebuild the browser rig and motion from the original, attributed assets.
// Rotations are retargeted in world space, then stored in the target hierarchy.
import fs from 'node:fs';
import {calibrateRacket, placeSupportHand} from './calibrate-racket.mjs';
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
// Remove tiny nonuniform scale residue in the source thigh bind matrices.
for (const bone of mesh.skeleton.bones) { bone.scale.setScalar(1); bone.quaternion.normalize(); }
scene.updateMatrixWorld(true);
const restRotations = mesh.skeleton.bones.map(bone => bone.quaternion.clone());
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
const markers=JSON.parse(fs.readFileSync(new URL('mocap/racket-markers.json',base)));
const equipment=JSON.parse(fs.readFileSync(new URL('../src/lib/tennis-motion/racket-grip.json',import.meta.url)));
const palm=new T.Vector3(...equipment.palm);
const strokes = {
  volley: { contact: 1.94, lead: .6 },
  'backhand-volley': { contact: 1.7, lead: .6 },
  forehand: { contact: 2.12, lead: .6 },
  overhead: { contact: 2.2, lead: .8 },
  backhand: { contact: 2.08, lead: .72 },
  serve: { contact: 2.56, lead: 1.26 },
};
for(const [kind, {contact, lead}] of Object.entries(strokes)) {
  const {skeleton,clip}=new BVHLoader().parse(fs.readFileSync(new URL(`mocap/${kind}.bvh`,base),'utf8'));
  const root=skeleton.bones[0], source=Object.fromEntries(skeleton.bones.map(b=>[b.name,b]));
  const mixer=new T.AnimationMixer(root); mixer.clipAction(clip).play();
  const sample=t=>{mixer.setTime(t);root.updateMatrixWorld(true);};
  const first=Math.round((contact-lead)/.02),last=Math.round((contact+.65)/.02);
  const forearmAt=time=>{sample(time);return facing.clone().multiply(worldQuaternion(source.RightElbow));};
  // No independent smash trial is available. Transfer the measured overarm
  // racket phase to the captured overhead arm and its own impact time.
  const calibration=calibrateRacket(markers[kind==='overhead'?'serve':kind],contact,forearmAt);
  const support=markers[kind]?.supportInRacket;
  sample(contact);
  const origin=worldPosition(root).multiplyScalar(.011);
  const poses=[];
  let lowestSole = Infinity;
  const vertex = new T.Vector3();
  for(let i=first;i<=last;i++) {
    sample(i*.02); bones.forEach((bone, j) => bone.quaternion.copy(restRotations[j])); scene.updateMatrixWorld(true);
    const q=calibration.rotation(i*.02-contact,facing.clone().multiply(worldQuaternion(source.RightElbow)));
    const hand=q.clone().multiply(calibration.handInRacket);
    const hip=worldPosition(root).multiplyScalar(.011); hip.x-=origin.x;hip.z-=origin.z;hip.applyQuaternion(facing);
    byName.Hips.position.copy(byName.Hips.parent.worldToLocal(hip));
    // Hierarchy order is essential: each local rotation uses its updated parent.
    for(const bone of bones) {
      if(map[bone.name]) {
        const desired=facing.clone().multiply(worldQuaternion(source[map[bone.name]])).multiply(bind[bone.name]);
        if(bone.name==='RightHand') desired.copy(hand);
        bone.quaternion.copy(worldQuaternion(bone.parent).invert().multiply(desired));
      }
      // Close the racket hand instead of leaving a flat, open paddle hand.
      if(/^RightHandIndex[123]$/.test(bone.name) || (support && /^LeftHandIndex[123]$/.test(bone.name))) bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.9));
      bone.quaternion.normalize();
      bone.updateWorldMatrix(false,true);
    }
    const center=worldPosition(byName.RightHand).add(palm.clone().applyQuaternion(hand))
      .add(new T.Vector3(0,equipment.centerFromPalm,0).applyQuaternion(q));
    if (support) {
      const supportQ=q.clone().multiply(new T.Quaternion(...support));
      const target=center.clone().add(new T.Vector3(0,-equipment.supportFromCenter,0).applyQuaternion(q))
        .sub(palm.clone().applyQuaternion(supportQ));
      placeSupportHand(byName.LeftArm,byName.LeftForeArm,byName.LeftHand,target,supportQ);
    }
    mesh.skeleton.update();
    for (let v = 0; v < positions.count; v++) {
      mesh.getVertexPosition(v, vertex).applyMatrix4(mesh.matrixWorld);
      lowestSole = Math.min(lowestSole, vertex.y);
    }
    const j=jointNames.map(n=>worldPosition(byName[n]));
    poses.push({j:j.map(p=>p.toArray()),q:q.toArray(),r:center.toArray(),h:byName.Hips.position.toArray(),b:bones.map(b=>b.quaternion.toArray()),foot:Math.min(...['LeftFoot','RightFoot','LeftToeBase','RightToeBase'].map(n=>worldPosition(byName[n]).y))});
  }
  // One floor alignment for the entire clip preserves the recorded rise/fall.
  const floor=Math.min(lowestSole, Math.min(...poses.map(p=>p.foot))-.035);
  const localShift=new T.Vector3(0,floor,0).divide(byName.Hips.parent.getWorldScale(new T.Vector3()));
  for(const p of poses){p.j=p.j.map(v=>round([v[0],v[1]-floor,v[2]]));p.r=round([p.r[0],p.r[1]-floor,p.r[2]]);p.h=round(new T.Vector3(...p.h).sub(localShift).toArray());p.b=p.b.map(round);p.q=round(p.q);delete p.foot;}
  // Draw subframe positions from the same interpolated arm chain as the
  // runtime. A 50 Hz chord can cut across a fast service loop by centimetres.
  const clipContact=+(contact-first*.02).toFixed(2);
  const socket=calibration.handInRacket.clone().invert();
  const armChain=bones.map((bone,index)=>({bone,index})).filter(({bone})=>{
    for(let p=byName.RightHand;p;p=p.parent) if(p===bone) return true;
    return false;
  });
  const trail={start:-.38,dt:.005,points:[]};
  for(let step=0;step<=140;step++) {
    const sampleIndex=Math.round((clipContact+trail.start+step*trail.dt)*200)/4;
    const frame=Math.floor(sampleIndex), fraction=sampleIndex-frame;
    const a=poses[frame], b=poses[frame+1];
    for(const {bone,index} of armChain) {
      bone.quaternion.fromArray(a.b[index]).slerp(new T.Quaternion(...b.b[index]),fraction);
    }
    byName.Hips.position.fromArray(a.h).lerp(new T.Vector3(...b.h),fraction);
    const hand=worldQuaternion(byName.RightHand).normalize();
    const tip=worldPosition(byName.RightHand).add(palm.clone().applyQuaternion(hand))
      .add(new T.Vector3(0,equipment.centerFromPalm+equipment.tipFromCenter,0).applyQuaternion(hand.multiply(socket)));
    trail.points.push(round(tip.toArray()));
  }
  library[kind]={socket:round(socket.toArray()),dt:.02,contact:clipContact,poses,trail};
  console.log(kind,poses.length,'frames, contact',poses[Math.round(library[kind].contact/.02)].r);
}
fs.writeFileSync(new URL('../src/lib/drills/recorded-motion.json',import.meta.url),JSON.stringify(library));
fs.writeFileSync(new URL('../src/lib/tennis-motion/rig-bones.json',import.meta.url),JSON.stringify(bones.map(b=>b.name)));
