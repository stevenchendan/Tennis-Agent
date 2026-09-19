'use client';
import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import type { OrbitControls as Controls } from 'three-stdlib';
import TennisPlayer from '../drills/TennisPlayer';
import type { Frame } from '@/lib/drills/motion';
export type StudioAngle = 'Front' | 'Side' | 'Rear';
function Camera({ angle }: { angle: StudioAngle }) {
  const { camera } = useThree(); const controls = useRef<Controls>(null);
  useEffect(() => { camera.position.set(...({Front:[0,1.8,-5.8],Side:[5.8,1.8,0],Rear:[0,1.8,5.8]}[angle] as [number,number,number])); camera.lookAt(0,1,0); controls.current?.target.set(0,1,0); controls.current?.update(); }, [angle,camera]);
  return <OrbitControls ref={controls} minDistance={2} maxDistance={12} maxPolarAngle={Math.PI/2-.02} />;
}
export default function StudioScene({frame,angle,contact}:{frame:Frame;angle:StudioAngle;contact?:number}) {
  const point=frame.strokes.find(s=>s.id==='1')?.point;
  return <Canvas shadows camera={{position:[0,1.8,-5.8],fov:40}} dpr={[1,1.5]} fallback={<p>WebGL is unavailable on this device.</p>}>
    <color attach="background" args={['#cfdddc']} /><hemisphereLight args={['#f1f8ff','#667865',2]} /><directionalLight position={[3,6,-3]} intensity={2.4} castShadow />
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[200,200]}/><meshStandardMaterial color="#698e8a"/></mesh><gridHelper args={[12,24,'#a6c5b8','#7d9f94']} position={[0,.003,0]}/>
    <group position={[0,0,-16]}><Suspense fallback={<Html center position={[0,1,16]}>Loading player…</Html>}>{frame.players.map(actor=><TennisPlayer key={actor.id} actor={actor} frame={frame} labels={false}/>)}</Suspense>
      {point && contact!==undefined && Math.abs(frame.time-contact)<.06 && <mesh position={[point.x,point.z,point.y]}><sphereGeometry args={[.034,16,12]}/><meshStandardMaterial color="#dfff45"/></mesh>}
    </group><Camera angle={angle}/>
  </Canvas>;
}
