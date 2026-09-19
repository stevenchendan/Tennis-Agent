"use client";
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { recordedReady, recordedSample } from "@/lib/drills/recorded-motion";
import boneNames from "@/lib/tennis-motion/rig-bones.json";
import type { Actor, Frame } from "@/lib/drills/motion";
import { movementLabel, techniqueForStroke } from "@/lib/tennis-motion";

function makeRig(source: THREE.Group, equipment: THREE.Group, color: string) {
  // Every actor owns a skeleton; only immutable skin geometry is shared.
  const body=clone(source), group=new THREE.Group(), racket=new THREE.Group();
  const bones=boneNames.map(name=>body.getObjectByName(name) as THREE.Bone);
  if(bones.some(b=>!b?.isBone)) throw new Error('Tennis skeleton does not match baked motion');
  body.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  body.traverse(o=>{
    if(!(o instanceof THREE.SkinnedMesh))return;
    o.geometry=o.geometry.clone();
    const colors=o.geometry.attributes.color,shirt=new THREE.Color('#df7744'),team=new THREE.Color(color);
    for(let i=0;i<colors.count;i++)if(Math.abs(colors.getX(i)-shirt.r)<.001&&Math.abs(colors.getY(i)-shirt.g)<.001)colors.setXYZ(i,team.r,team.g,team.b);
    colors.needsUpdate=true;
  });
  const src=equipment.getObjectByName('Racket')!;
  src.updateWorldMatrix(true,true);
  const inverse=src.matrixWorld.clone().invert(), buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
  src.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const m=o.material as THREE.Material;
    const g=o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
    for(const key of Object.keys(g.attributes))if(key!=='position'&&key!=='normal')g.deleteAttribute(key);
    if(!buckets.has(m))buckets.set(m,[]);buckets.get(m)!.push(g);
  });
  for(const [material,geometries] of buckets){const g=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(g){const m=new THREE.Mesh(g,material);m.castShadow=true;racket.add(m);}}
  group.add(body,racket);
  const a=new THREE.Quaternion(),b=new THREE.Quaternion(),ready=new THREE.Quaternion();
  const p=new THREE.Vector3(),q=new THREE.Vector3();
  function pose(actor:Actor,frame:Frame){
    const time=frame.localTime;
    const stroke=frame.strokes.filter(s=>s.id===actor.id).sort((a,b)=>Math.abs(a.time-time)-Math.abs(b.time-time))[0];
    const sample=recordedSample(stroke?.kind??'volley',stroke?time-stroke.time:10);
    const {weight,alpha}=sample;
    for(let i=0;i<bones.length;i++){
      a.fromArray(sample.a.b[i]);b.fromArray(sample.b.b[i]);a.slerp(b,alpha);
      ready.fromArray(recordedReady.b[i]);bones[i].quaternion.copy(ready.slerp(a,weight));
    }
    p.fromArray(sample.a.h).lerp(q.fromArray(sample.b.h),alpha);
    bones[0].position.fromArray(recordedReady.h).lerp(p,weight);
    const speed=Math.hypot(actor.vx,actor.vy),running=Math.min(1,speed/2)*(1-weight);
    const baseYaw=actor.y<11.885?Math.PI:0,travelYaw=Math.atan2(-actor.vx,-actor.vy);
    const follow=actor.movement==='recover'||actor.movement==='reset';
    const yaw=follow?baseYaw+Math.atan2(Math.sin(travelYaw-baseYaw),Math.cos(travelYaw-baseYaw))*Math.min(1,running*3):baseYaw;
    group.position.set(actor.x,0,actor.y);group.rotation.y=yaw;
    // Illustrative footwork rotates real joints rather than stretching limbs.
    for(const [side,offset] of [['Left',0],['Right',Math.PI]] as const){
      const phase=actor.travel/.72*Math.PI*2+offset;
      const thigh=body.getObjectByName(`${side}UpLeg`)!,shin=body.getObjectByName(`${side}Leg`)!;
      thigh.rotateX(Math.sin(phase)*.38*running);shin.rotateX(Math.max(0,-Math.sin(phase))*.65*running);
    }
    const opponentHit=frame.strokes.filter(s=>s.id!==actor.id&&s.kind==='forehand').sort((a,b)=>Math.abs(a.time-time)-Math.abs(b.time-time))[0];
    const split=actor.id==='1'&&opponentHit?Math.max(0,1-Math.abs(time-opponentHit.time)/.25)*(1-weight):0;
    if(split){
      const bend=split*split*(3-2*split);
      for(const side of ['Left','Right']){body.getObjectByName(`${side}UpLeg`)!.rotateX(-.12*bend);body.getObjectByName(`${side}Leg`)!.rotateX(.24*bend);}
    }
    body.updateWorldMatrix(true,true);
    // Attach to the actual wrist after interpolation, including transitions.
    bones[boneNames.indexOf('RightHand')].getWorldPosition(p);
    group.worldToLocal(p);
    a.fromArray(sample.a.q).slerp(b.fromArray(sample.b.q),alpha);
    racket.quaternion.fromArray(recordedReady.q).slerp(a,weight);
    racket.position.copy(p).add(q.set(.065,.39,.02).applyQuaternion(racket.quaternion));
  }
  return {group,pose,dispose(){racket.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});body.traverse(o=>{if(o instanceof THREE.SkinnedMesh){o.skeleton.dispose();o.geometry.dispose();}});}};
}

export default function TennisPlayer({actor,frame,labels}:{actor:Actor;frame:Frame;labels:boolean}){
  const {scene}=useGLTF('/models/tennis/tennis-athlete.glb');
  const {scene:equipment}=useGLTF('/models/tennis/club-player.glb?v=2');
  const rig=useMemo(()=>makeRig(scene,equipment,actor.color),[scene,equipment,actor.color]);
  useEffect(()=>()=>rig.dispose(),[rig]);useFrame(()=>rig.pose(actor,frame));
  const action=actor.technique?`${techniqueForStroke(actor.technique).label} · ${movementLabel(actor.movement)}`:movementLabel(actor.movement);
  const side=actor.id==='1'?1:-1;
  return <><primitive object={rig.group} dispose={null}/>{labels&&<Html position={[actor.x+side*.62,2.38,actor.y]} center distanceFactor={8} zIndexRange={[10,0]} style={{pointerEvents:'none'}}><span className={side>0?'playerLabel playerLabelRight':'playerLabel playerLabelLeft'} style={{borderColor:actor.color}}>{`P${actor.id}`}<small>{action.toUpperCase()}</small></span></Html>}</>;
}
