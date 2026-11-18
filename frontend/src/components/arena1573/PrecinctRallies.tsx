"use client";

import {useMemo,useRef} from "react";
import {useFrame} from "@react-three/fiber";
import * as T from "three";
import grip from "@/lib/tennis-motion/racket-grip.json";
import {recordedReady,recordedSample,readySocket} from "@/lib/drills/recorded-motion";
import type {ContextData} from "./model";
import {rallyCourts} from "./courtPlacements";
import {BALL_RADIUS,COURT_SURFACE,rallyFrame} from "./rallyMotion";

const limbs=[[10,11],[11,12],[13,14],[14,15],[4,5],[5,6],[7,8],[8,9]];
const readyYaw=Math.atan2(recordedReady.j[7][2]-recordedReady.j[4][2],recordedReady.j[7][0]-recordedReady.j[4][0]);
const kits=["#d7ab45","#4186a3","#ba6953","#75a891"];

export default function PrecinctRallies({data,active,visible}:{data:ContextData;active:boolean;visible:boolean}) {
  const courts=useMemo(()=>rallyCourts(data),[data]);
  const torso=useRef<T.InstancedMesh>(null),heads=useRef<T.InstancedMesh>(null),arms=useRef<T.InstancedMesh>(null);
  const rackets=useRef<T.InstancedMesh>(null),grips=useRef<T.InstancedMesh>(null),balls=useRef<T.InstancedMesh>(null);
  const time=useRef(0),last=useRef(-1);
  const scratch=useMemo(()=>({
    joints:Array.from({length:16},()=>new T.Vector3()),o:new T.Object3D(),world:new T.Vector3(),up:new T.Vector3(0,1,0),
    a:new T.Vector3(),b:new T.Vector3(),mid:new T.Vector3(),center:new T.Vector3(),handle:new T.Vector3(),
    localQ:new T.Quaternion(),nextQ:new T.Quaternion(),yawQ:new T.Quaternion(),color:new T.Color(),
  }),[]);
  useFrame((_,dt)=>{
    if(!visible || !torso.current || !heads.current || !arms.current || !rackets.current || !grips.current || !balls.current)return;
    if(active)time.current+=Math.min(dt,.2);
    if(last.current===time.current)return;
    const initial=last.current<0;
    last.current=time.current;
    const {joints,o,world,up,a,b,mid,center,handle,localQ,nextQ,yawQ,color}=scratch;
    function segment(batch:T.InstancedMesh,i:number,start:T.Vector3,end:T.Vector3,width:number,depth=width) {
      a.subVectors(end,start);const length=a.length();
      o.position.copy(start).lerp(end,.5);o.quaternion.setFromUnitVectors(up,a.normalize());
      o.scale.set(width,length,depth);o.updateMatrix();batch.setMatrixAt(i,o.matrix);
    }
    courts.forEach((court,index)=>{
      const frame=rallyFrame(time.current+index*.713),c=Math.cos(court.rotation),s=Math.sin(court.rotation);
      frame.players.forEach((p,side)=>{
        const i=index*2+side,sample=recordedSample(p.stroke,p.relativeTime),idle=1-sample.weight;
        const yaw=court.rotation+p.yaw+readyYaw*idle;
        yawQ.setFromAxisAngle(up,yaw);
        world.set(court.x+p.x*c+p.z*s,court.y+COURT_SURFACE+.06*p.split*idle,court.z-p.x*s+p.z*c);
        for(let j=0;j<joints.length;j++) {
          const joint=joints[j].fromArray(sample.a.j[j]).lerp(b.fromArray(sample.b.j[j]),sample.alpha);
          joint.lerp(b.fromArray(recordedReady.j[j]),idle);
          joint.x-=recordedReady.j[0][0]*idle;joint.z-=recordedReady.j[0][2]*idle;
          joint.applyQuaternion(yawQ).add(world);
        }
        const speed=Math.hypot(p.vx,p.vz);
        if(speed>.02 && idle>.01) for(const [foot,offset] of [[12,0],[15,.5]]) {
          const phase=(p.distance/1.12+offset)%1;
          const step=Math.sin(2*Math.PI*phase)*.20*Math.min(1,speed)*idle;
          joints[foot].x+=step*(p.vx*c+p.vz*s)/speed;joints[foot].z+=step*(p.vz*c-p.vx*s)/speed;
          joints[foot].y+=Math.max(0,-Math.sin(2*Math.PI*phase))*.09*idle;
        }
        mid.copy(joints[4]).lerp(joints[7],.5);
        segment(torso.current!,i,joints[0],mid,.225,.175);
        if(initial)torso.current!.setColorAt(i,color.set(kits[(index+side)%kits.length]));
        o.position.copy(joints[3]).y+=.092;o.quaternion.copy(yawQ);o.scale.set(.098,.13,.11);o.updateMatrix();
        heads.current!.setMatrixAt(i,o.matrix);
        limbs.forEach(([from,to],j)=>segment(arms.current!,i*8+j,joints[from],joints[to],j<4?.072:.047));
        localQ.fromArray(sample.a.q).slerp(nextQ.fromArray(sample.b.q),sample.alpha);
        localQ.slerp(nextQ.fromArray(recordedReady.q),idle).premultiply(yawQ);
        const socket = nextQ.fromArray(readySocket).slerp(o.quaternion.fromArray(sample.socket),sample.weight);
        const hand = socket.invert().premultiply(localQ);
        center.fromArray(grip.palm).applyQuaternion(hand).add(joints[9]);
        center.add(b.set(0,grip.centerFromPalm,0).applyQuaternion(localQ));
        o.position.copy(center);o.quaternion.copy(localQ);o.scale.set(.135,.18,.13);o.updateMatrix();rackets.current!.setMatrixAt(i,o.matrix);
        handle.set(0,-.18,0).applyQuaternion(localQ).add(center);
        segment(grips.current!,i,joints[9],handle,.017);
      });
      const [x,y,z]=frame.ball;
      o.position.set(court.x+x*c+z*s,court.y+COURT_SURFACE+y,court.z-x*s+z*c);
      o.quaternion.identity();o.scale.setScalar(BALL_RADIUS);o.updateMatrix();balls.current!.setMatrixAt(index,o.matrix);
    });
    for(const batch of [torso,heads,arms,rackets,grips,balls])batch.current!.instanceMatrix.needsUpdate=true;
    if(initial && torso.current.instanceColor)torso.current.instanceColor.needsUpdate=true;
  });
  const count=courts.length*2;
  return <group visible={visible}>
    <instancedMesh ref={torso} args={[undefined,undefined,count]} frustumCulled={false}><cylinderGeometry args={[1,.72,1,8]}/><meshStandardMaterial roughness={.86}/></instancedMesh>
    <instancedMesh ref={heads} args={[undefined,undefined,count]} frustumCulled={false}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#b78a70"/></instancedMesh>
    <instancedMesh ref={arms} args={[undefined,undefined,count*8]} frustumCulled={false}><cylinderGeometry args={[.8,1,1,6]}/><meshStandardMaterial color="#b98e72"/></instancedMesh>
    <instancedMesh ref={rackets} args={[undefined,undefined,count]} frustumCulled={false}><torusGeometry args={[1,.065,4,14]}/><meshStandardMaterial color="#d1d5cb"/></instancedMesh>
    <instancedMesh ref={grips} args={[undefined,undefined,count]} frustumCulled={false}><cylinderGeometry args={[1,1,1,6]}/><meshStandardMaterial color="#314039"/></instancedMesh>
    <instancedMesh ref={balls} args={[undefined,undefined,courts.length]} frustumCulled={false}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#d6eb46"/></instancedMesh>
  </group>;
}
