"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { activeHalves, type Frame } from "@/lib/drills/motion";
import TennisPlayer from "./TennisPlayer";
import TrainingCourt from "./TrainingCourt";
import s from "./drills.module.css";

type Angle = "Broadcast" | "Baseline" | "Volley";
const cameras: Record<Angle, { position: [number, number, number]; target: [number, number, number] }> = {
  Broadcast: { position: [19, 17, 27], target: [0, .3, 1] },
  Baseline: { position: [3, 12, 21], target: [0, 0, 5] },
  Volley: { position: [3.5, 2.5, -5.5], target: [-2.7, 1.05, -5.3] },
};
function CameraRig({ angle, reset, round }: { angle: Angle; reset: number; round: number }) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    const preset = cameras[angle];
    const target = new THREE.Vector3(...preset.target);
    const position = new THREE.Vector3(...preset.position);
    if (angle === "Volley" && round) { position.x *= -1; target.x *= -1; }
    if (size.width / size.height < .85 && angle !== "Volley") position.sub(target).multiplyScalar(1.3).add(target);
    camera.position.copy(position); camera.lookAt(target);
    controls.current?.target.copy(target); controls.current?.update();
  }, [angle, reset, round, camera, size.width, size.height]);
  return <OrbitControls ref={controls} makeDefault minDistance={3} maxDistance={65} maxPolarAngle={Math.PI / 2 - .035} minPolarAngle={.12} enableDamping dampingFactor={.08} />;
}
function Ball({ frame, guides }: { frame: Frame; guides: boolean }) {
  if (!frame.ball) return null;
  const ball = frame.ball;
  return <>
    {guides && frame.trajectory.length > 1 && <Line points={frame.trajectory.map(p => [p.x, p.z, p.y])} color="#edf0a1" transparent opacity={.35} lineWidth={1} dashed dashSize={.18} gapSize={.12} />}
    {frame.trail.length > 1 && <Line points={frame.trail.map(p => [p.x, p.z, p.y])} color="#e3ed69" transparent opacity={.55} lineWidth={1.5} />}
    <mesh position={[ball.x, ball.z, ball.y]} castShadow><sphereGeometry args={[.034, 16, 12]} /><meshStandardMaterial color="#d8f143" roughness={.95} emissive="#bbd62c" emissiveIntensity={.12} /></mesh>
    {/* A subtle tracking halo preserves ball visibility at the wide teaching angle. */}
    {guides && <mesh position={[ball.x, ball.z, ball.y]}><sphereGeometry args={[.065, 12, 8]} /><meshBasicMaterial color="#e9f97b" transparent opacity={.18} depthWrite={false} /></mesh>}
  </>;
}

export default function Court3D({ frame }: { frame: Frame }) {
  const [angle, setAngle] = useState<Angle>("Broadcast");
  const [guides, setGuides] = useState(true);
  const [labels, setLabels] = useState(true);
  const [reset, setReset] = useState(0);
  return <div className={s.scene}>
    <div className={s.cameraBar} aria-label="3D camera controls"><div className={s.cameraGroup}>{(Object.keys(cameras) as Angle[]).map(name => <button key={name} aria-pressed={angle === name} onClick={() => { setAngle(name); setReset(n => n + 1); }}>{name}</button>)}</div><div className={s.sceneOptions}><button aria-pressed={guides} onClick={() => setGuides(!guides)}>Ball path</button><button aria-pressed={labels} onClick={() => setLabels(!labels)}>Labels</button></div></div>
    <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 1.75]} camera={{ position: [19, 17, 27], fov: 43, near: .1, far: 250 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12 }} fallback={<p>3D requires WebGL. Select 2D to continue.</p>}>
      <color attach="background" args={["#c5d6d7"]} /><fog attach="fog" args={["#c5d6d7", 55, 140]} />
      <hemisphereLight args={["#dfedf9", "#788875", 2.1]} />
      <directionalLight position={[-14, 24, 12]} intensity={2.8} color="#fff2d7" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-camera-near={1} shadow-camera-far={70} shadow-bias={-.00015} shadow-normalBias={.015} />
      <group position={[-5.485, 0, -11.885]}>
        <TrainingCourt />
        {guides && activeHalves(frame.round).map((half, i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[half.x + 2.7425, .009, half.y + 5.9425]}><planeGeometry args={[5.485, 11.885]} /><meshBasicMaterial color="#e5f093" transparent opacity={.09} depthWrite={false} /></mesh>)}
        <Suspense fallback={<Html center position={[5.485, 2, 11.885]}><span className={s.loadingScene}>Preparing players…</span></Html>}>
          {frame.players.map(actor => <TennisPlayer key={actor.id} actor={actor} frame={frame} labels={labels} />)}
        </Suspense>
        <Ball frame={frame} guides={guides} />
      </group>
      <CameraRig angle={angle} reset={reset} round={frame.round} />
    </Canvas>
    <div className={s.sceneCaption}><span>HARD COURT <b> / </b> {angle === "Volley" ? "CONTACT STUDY" : "COACH VIEW"}</span><span>Drag to orbit · Scroll to zoom</span></div>
  </div>;
}
