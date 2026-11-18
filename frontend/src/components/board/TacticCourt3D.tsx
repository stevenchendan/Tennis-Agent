"use client";
import {Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {Canvas, useFrame, useThree} from "@react-three/fiber";
import {Html, Line, OrbitControls} from "@react-three/drei";
import * as T from "three";
import {CX, NET, PLAYER_COLORS, resolveCourtTheme} from "@/lib/court";
import {strokeLabels, type BallPath} from "@/lib/tactic";
import {BALL_RADIUS, type ReplayFrame} from "@/lib/tennis-motion/tactical-replay";
import Athlete from "../drills/Athlete";
import TrainingCourt from "../drills/TrainingCourt";
import BroadcastGrounds from "./BroadcastGrounds";
import styles from "./broadcast.module.css";

const angles = {baseline:"转播机位",sideline:"边线机位",contact:"击球特写",orbit:"自由视角"};
type Angle = keyof typeof angles;
function Director({angle,frame}:{angle:Angle;frame:ReplayFrame}) {
  const {camera,size}=useThree();
  const sceneCamera=camera as T.PerspectiveCamera;
  const focus=useMemo(()=>new T.Vector3(),[]);
  const position=useMemo(()=>new T.Vector3(),[]);
  const target=useMemo(()=>new T.Vector3(),[]);
  const mobile=size.width/size.height<1.18;
  const place=()=>{
    const shot=frame.shot;
    if(angle==="contact") {
      const id=shot?.id ?? frame.players[0]?.id;
      const player=frame.players.find(p=>p.id===id) ?? frame.players[0];
      const high=shot?.kind==="serve" || shot?.kind==="overhead";
      focus.set(player.x-CX,high?1.43:1.05,player.y-NET);
      const side=player.y<NET?-1:1;
      position.set(focus.x+side*5.45,1.74,focus.z+side*3.65);
      target.copy(focus);
      sceneCamera.fov=mobile?39:32;
    } else if(angle==="sideline") {
      position.set(mobile?36:26,9.4,3.4);target.set(0,.65,0);
      sceneCamera.fov=mobile?48:43;
    } else {
      const follow=frame.ball ? (frame.ball.x-CX)*.075:0;
      position.set(1.4,mobile?9.5:7.3,mobile?-27:-24);
      target.set(follow,.55,-1.55);
      sceneCamera.fov=mobile?46:38;
    }
    sceneCamera.position.copy(position);
    sceneCamera.lookAt(target);sceneCamera.updateProjectionMatrix();
  };
  useFrame(()=>{if(angle!=="orbit")place();});
  return angle==="orbit"?<OrbitControls makeDefault target={[0,.6,0]} minDistance={3} maxDistance={52} maxPolarAngle={Math.PI*.486} enableDamping/>:null;
}

function TennisBall({frame}:{frame:ReplayFrame}) {
  const ball=frame.ball;
  const seams=useMemo(()=>{
    const points=Array.from({length:65},(_,i)=>{
      const a=i*Math.PI/32, lat=.55*Math.cos(2*a);
      return new T.Vector3(Math.cos(lat)*Math.cos(a),Math.sin(lat),Math.cos(lat)*Math.sin(a)).multiplyScalar(BALL_RADIUS);
    });
    return new T.TubeGeometry(new T.CatmullRomCurve3(points,true),64,.00125,4,true);
  },[]);
  useEffect(()=>()=>seams.dispose(),[seams]);
  if(!ball) return null;
  return <>
    <mesh position={[ball.x,.011,ball.y]} rotation={[-Math.PI/2,0,0]} scale={1+ball.z*.32}>
      <circleGeometry args={[.055,20]}/><meshBasicMaterial color="#102a19" transparent opacity={.36/(1+ball.z)} depthWrite={false}/>
    </mesh>
    <group position={[ball.x,ball.z,ball.y]}>
      <group rotation={[frame.time*26,.35,frame.time*4]}>
        <mesh castShadow><sphereGeometry args={[BALL_RADIUS,18,14]}/><meshStandardMaterial color="#d7f443" roughness={.96} emissive="#a3bd22" emissiveIntensity={.19}/></mesh>
        <mesh geometry={seams}><meshStandardMaterial color="#feffb7"/></mesh>
      </group>
      <sprite scale={[.095,.095,1]}><spriteMaterial map={undefined} color="#edff76" opacity={.12} transparent depthWrite={false}/></sprite>
    </group>
  </>;
}

function SceneReady({onReady}:{onReady:()=>void}) {
  useLayoutEffect(()=>{onReady();},[onReady]);
  return null;
}

class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

export default function TacticCourt3D({theme,frame,paths,frameCount,onReady,onFlat}:{
  theme?:string;frame:ReplayFrame;paths:BallPath[];frameCount:number;onReady:()=>void;onFlat:()=>void;
}) {
  const [angle,setAngle]=useState<Angle>("baseline");
  const [guides,setGuides]=useState(false);
  const [ready,setReady]=useState(false);
  const notified=useRef(false);
  const markReady=useMemo(()=>()=>{setReady(true);if(!notified.current){onReady();notified.current=true;}},[onReady]);
  const fallback=<button className={styles.loading} onClick={onFlat}>无法显示 3D 球场 · 打开 2D 回放</button>;
  return <>
    <div className={styles.stage} aria-label="3D 战术回放">
      <SceneBoundary fallback={fallback}><Canvas shadows={{type:T.PCFShadowMap}} dpr={[1,1.6]} camera={{position:[1.4,7.3,-24],fov:38,near:.09,far:230}}
        gl={{antialias:true,powerPreference:"high-performance",toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1.04}} fallback={fallback}>
        <Suspense fallback={null}>
          <BroadcastGrounds/>
          <group position={[-CX,0,-NET]}>
            <TrainingCourt theme={resolveCourtTheme(theme)}/>
            {frame.players.map(p=><group key={p.id}>
              <Athlete color={PLAYER_COLORS[p.id]??"#eee8d5"} pose={p.pose}/>
              {guides && <Html center position={[p.x,2.05,p.y]} zIndexRange={[5,0]} style={{pointerEvents:"none",whiteSpace:"nowrap",font:"bold 11px sans-serif",color:"#fff",background:"#152b26cc",borderRadius:4,padding:"2px 6px"}}>P{p.id}</Html>}
            </group>)}
            <TennisBall frame={frame}/>
            {guides && paths.map((path,i)=><group key={i}>
              <Line points={[[path.from.x,.025,path.from.y],[path.to.x,.025,path.to.y]]} color="#f3ec99" dashed dashSize={.25} gapSize={.18} transparent opacity={.72}/>
              <mesh position={[path.to.x,.023,path.to.y]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.19,.25,48]}/><meshBasicMaterial color="#e5e88f" transparent opacity={.82}/></mesh>
            </group>)}
          </group>
          <Director angle={angle} frame={frame}/>
          <SceneReady onReady={markReady}/>
        </Suspense>
      </Canvas></SceneBoundary>
      {!ready && <div className={styles.loading} style={{pointerEvents:"none",background:"transparent",alignItems:"start",paddingTop:32}}>准备球场与球员…</div>}
      {ready && <div className={styles.score}><strong>{String(frame.frameIndex+1).padStart(2,"0")} / {String(frameCount).padStart(2,"0")}</strong><span>{frame.shot ? ((frame.shot.id!==undefined?`P${frame.shot.id} · `:"")+strokeLabels[frame.shot.kind]) : "站位与回位"}</span></div>}
    </div>
    <div className={styles.options}>
      <div className={styles.angles} aria-label="回放机位">{(Object.keys(angles) as Angle[]).map(a=><button key={a} aria-pressed={a===angle} onClick={()=>setAngle(a)}>{angles[a]}</button>)}</div>
      <div className={styles.angles}><button aria-pressed={guides} onClick={()=>setGuides(v=>!v)}>战术标注</button><a className={styles.credits} href="/models/tennis/BROADCAST-CREDITS.md" target="_blank" rel="noreferrer">素材署名</a></div>
    </div>
  </>;
}
