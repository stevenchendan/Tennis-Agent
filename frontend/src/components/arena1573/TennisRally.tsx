"use client";
import {useEffect,useMemo,useRef} from "react";
import {useGLTF} from "@react-three/drei";
import {useFrame} from "@react-three/fiber";
import * as T from "three";
import {createAthlete} from "@/lib/tennis-motion/athlete";
import {BALL_RADIUS,COURT_SURFACE,rallyFrame} from "./rallyMotion";

export default function TennisRally({active}:{active:boolean}) {
  const {scene}=useGLTF("/models/tennis/match-athlete.glb");
  const {scene:equipment}=useGLTF("/models/tennis/match-racket.glb");
  const athletes=useMemo(()=>["#247663","#e4a149"].map(color=>createAthlete(scene,equipment,color)),[scene,equipment]);
  useEffect(()=>()=>athletes.forEach(a=>a.dispose()),[athletes]);
  const time=useRef(0),last=useRef(-1),ball=useRef<T.Mesh>(null);
  useFrame((_,dt)=>{
    if(active)time.current+=Math.min(dt,.2);
    if(time.current===last.current)return;
    last.current=time.current;
    const frame=rallyFrame(time.current);
    athletes.forEach((a,i)=>a.pose(frame.players[i]));
    ball.current?.position.set(...frame.ball);
  });
  return <group position-y={COURT_SURFACE} dispose={null}>
    {athletes.map((a,i)=><primitive key={i} object={a.group}/>)}
    <mesh ref={ball} castShadow><sphereGeometry args={[BALL_RADIUS,16,12]}/><meshStandardMaterial color="#d9ed49" roughness={.92}/></mesh>
  </group>;
}
