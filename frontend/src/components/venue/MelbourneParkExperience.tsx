"use client";

import * as THREE from "three";
import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, RoundedBox, Sky } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";

type CourtKind = "arena" | "show" | "outdoor" | "practice";
type TimeOfDay = "day" | "night";
type ViewPreset = "overview" | "river" | "west" | "east";

interface VenueCourt {
  id: string;
  name: string;
  kind: CourtKind;
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  subtitle?: string;
  description?: string;
  materials?: string;
}

const ARENAS: VenueCourt[] = [
  { id: "rod-laver", name: "Rod Laver Arena", kind: "arena", position: [-48, 0, -8], subtitle: "Centre Court · retractable roof", description: "An elliptical centre-court bowl with a ribbed metal roof, glazed public concourse and retractable roof panels.", materials: "Silver standing-seam roof · blue-grey curtain wall · concrete podium" },
  { id: "margaret-court", name: "Margaret Court Arena", kind: "arena", position: [-79, 0, 22], subtitle: "7,500-seat arena", description: "A compact angular arena with a copper-toned roof edge, broad glazed entrance and an operable roof over the court.", materials: "Warm metal cladding · reflective glass · exposed steel" },
  { id: "john-cain", name: "John Cain Arena", kind: "arena", position: [24, 0, 34], subtitle: "Eastern indoor arena", description: "A broad rectangular arena with curved corners, white roof trusses and a continuous glazed concourse band.", materials: "White composite panels · blue glass · steel truss roof" },
  { id: "kia-arena", name: "Kia Arena", kind: "show", position: [58, 0, -28], rotation: -0.05, subtitle: "5,000-seat open arena", description: "An open-air bowl wrapped in tall pale fins, with a vivid entry portal and blue seating focused tightly around the court.", materials: "Vertical precast fins · charcoal base · painted steel" },
];

const OUTDOOR_COURTS: VenueCourt[] = [
  { id: "court-3", name: "1573 Arena", kind: "show", position: [-91, 0, 53], rotation: -0.03, scale: 0.95, subtitle: "Western show court" },
  { id: "court-4", name: "Court 4", kind: "outdoor", position: [-77, 0, 57], rotation: -0.03 },
  { id: "court-5", name: "Court 5", kind: "outdoor", position: [-64, 0, 57], rotation: -0.03 },
  { id: "court-6", name: "Court 6", kind: "outdoor", position: [-51, 0, 57], rotation: -0.03 },
  { id: "court-7", name: "Court 7", kind: "practice", position: [-90, 0, 36], rotation: -0.03 },
  { id: "court-8", name: "Court 8", kind: "practice", position: [-77, 0, 39], rotation: -0.03 },
  { id: "court-9", name: "Court 9", kind: "practice", position: [-64, 0, 40], rotation: -0.03 },
  { id: "court-10", name: "Court 10", kind: "practice", position: [-51, 0, 40], rotation: -0.03 },
  { id: "court-11", name: "Court 11", kind: "outdoor", position: [-23, 0, 54], rotation: 0.01 },
  { id: "court-12", name: "Court 12", kind: "outdoor", position: [-10, 0, 54], rotation: 0.01 },
  { id: "court-13", name: "Court 13", kind: "outdoor", position: [55, 0, 55], rotation: 0.025 },
  { id: "court-14", name: "Court 14", kind: "outdoor", position: [68, 0, 55], rotation: 0.025 },
  { id: "court-15", name: "Court 15", kind: "outdoor", position: [81, 0, 55], rotation: 0.025 },
  { id: "court-16", name: "Court 16", kind: "outdoor", position: [94, 0, 55], rotation: 0.025 },
  { id: "court-17", name: "Court 17", kind: "outdoor", position: [75, 0, 35], rotation: 0.025 },
  { id: "court-18", name: "Court 18", kind: "outdoor", position: [88, 0, 35], rotation: 0.025 },
  { id: "court-19", name: "Court 19", kind: "practice", position: [101, 0, 35], rotation: 0.025 },
  { id: "court-20", name: "Court 20", kind: "practice", position: [82, 0, 15], rotation: 0.025 },
  { id: "court-21", name: "Court 21", kind: "show", position: [96, 0, 14], rotation: 0.025, scale: 0.92, subtitle: "Eastern show court" },
  { id: "court-22", name: "Court 22", kind: "practice", position: [80, 0, -7], rotation: -0.015 },
  { id: "court-23", name: "Court 23", kind: "practice", position: [93, 0, -7], rotation: -0.015 },
  { id: "court-24", name: "Court 24", kind: "practice", position: [106, 0, -7], rotation: -0.015 },
  { id: "court-25", name: "Court 25", kind: "practice", position: [83, 0, -29], rotation: -0.035 },
  { id: "court-26", name: "Court 26", kind: "practice", position: [97, 0, -29], rotation: -0.035 },
];

const ALL_COURTS = [...ARENAS, ...OUTDOOR_COURTS];
const COURT_BLUE = "#087bc1";
const COURT_SURROUND = "#38a8da";

function PhysicalMaterial({ kind, night = false }: { kind: "glass" | "silver" | "concrete" | "bronze" | "dark"; night?: boolean }) {
  if (kind === "glass") return <meshPhysicalMaterial color={night ? "#2aa6d6" : "#5e9bac"} roughness={0.12} metalness={0.12} transmission={0.32} transparent opacity={0.76} clearcoat={1} clearcoatRoughness={0.14} emissive={night ? "#0d749c" : "#000000"} emissiveIntensity={night ? 0.3 : 0} />;
  if (kind === "silver") return <meshStandardMaterial color="#d7dcdd" roughness={0.34} metalness={0.72} />;
  if (kind === "bronze") return <meshStandardMaterial color="#9b5a36" roughness={0.38} metalness={0.62} />;
  if (kind === "dark") return <meshStandardMaterial color="#222c31" roughness={0.55} metalness={0.5} />;
  return <meshStandardMaterial color="#aaa9a2" roughness={0.9} metalness={0.02} />;
}

function TennisCourt({ compact = false, night = false }: { compact?: boolean; night?: boolean }) {
  const width = compact ? 7.2 : 8.8;
  const length = compact ? 14.4 : 17.2;
  const line = compact ? 0.075 : 0.09;
  const singlesX = width * 0.37;
  const serviceZ = length * 0.22;
  const lineColor = night ? "#f4fbff" : "#ecf8ff";
  return (
    <group>
      <mesh position={[0, 0.1, 0]} receiveShadow><boxGeometry args={[width + 1.7, 0.2, length + 2]} /><meshStandardMaterial color={COURT_SURROUND} roughness={0.82} /></mesh>
      <mesh position={[0, 0.22, 0]} receiveShadow><boxGeometry args={[width, 0.055, length]} /><meshStandardMaterial color={COURT_BLUE} roughness={0.74} /></mesh>
      {[-width / 2, width / 2, -singlesX, singlesX].map((x) => <mesh key={`side-${x}`} position={[x, 0.265, 0]}><boxGeometry args={[line, 0.02, length]} /><meshBasicMaterial color={lineColor} /></mesh>)}
      {[-length / 2, length / 2, -serviceZ, serviceZ].map((z) => <mesh key={`base-${z}`} position={[0, 0.265, z]}><boxGeometry args={[Math.abs(z) === length / 2 ? width : singlesX * 2, 0.02, line]} /><meshBasicMaterial color={lineColor} /></mesh>)}
      <mesh position={[0, 0.265, 0]}><boxGeometry args={[line, 0.02, serviceZ * 2]} /><meshBasicMaterial color={lineColor} /></mesh>
      <mesh position={[0, 0.71, 0]}><boxGeometry args={[width + 0.5, 0.86, 0.045]} /><meshStandardMaterial color="#101a1f" transparent opacity={0.72} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 1.14, 0]}><boxGeometry args={[width + 0.52, 0.065, 0.075]} /><meshBasicMaterial color="#ffffff" /></mesh>
    </group>
  );
}

function CourtFurniture({ showSeats = false, night = false }: { showSeats?: boolean; night?: boolean }) {
  return (
    <group>
      {[-5.3, 5.3].map((x) => <mesh key={`side-${x}`} position={[x, 1.75, 0]}><boxGeometry args={[0.055, 3.1, 18.8]} /><meshStandardMaterial color="#526772" transparent opacity={0.36} /></mesh>)}
      {[-9.4, 9.4].map((z) => <mesh key={`end-${z}`} position={[0, 1.75, z]}><boxGeometry args={[10.6, 3.1, 0.055]} /><meshStandardMaterial color="#526772" transparent opacity={0.36} /></mesh>)}
      {showSeats && [-1, 1].map((side) => <group key={side} position={[side * 6.2, 0.8, 0]} rotation={[0, 0, side * -0.1]}>{[0, 1, 2].map((tier) => <mesh key={tier} position={[side * tier * 0.35, tier * 0.36, 0]}><boxGeometry args={[0.8, 0.38, 14.8]} /><meshStandardMaterial color={tier % 2 ? "#176fa8" : "#135c8b"} roughness={0.8} /></mesh>)}</group>)}
      {[-1, 1].flatMap((side) => [-1, 1].map((end) => <group key={`${side}-${end}`} position={[side * 5.9, 0, end * 8.4]}><mesh position={[0, 2.9, 0]} castShadow><cylinderGeometry args={[0.07, 0.11, 5.8, 8]} /><meshStandardMaterial color="#29363a" metalness={0.65} roughness={0.4} /></mesh><mesh position={[-side * 0.24, 5.65, -end * 0.2]} rotation={[0.2 * end, 0, 0.15 * side]}><boxGeometry args={[0.85, 0.34, 0.25]} /><meshStandardMaterial color="#eef7ff" emissive={night ? "#d8f2ff" : "#222222"} emissiveIntensity={night ? 2.8 : 0.05} /></mesh></group>))}
    </group>
  );
}

function SelectionHalo({ selected, radius = 12 }: { selected: boolean; radius?: number }) {
  if (!selected) return null;
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}><ringGeometry args={[radius, radius + 0.55, 72]} /><meshBasicMaterial color="#ff6a2a" transparent opacity={0.95} side={THREE.DoubleSide} /></mesh>;
}

function OutdoorCourt({ court, selected, night, onSelect }: { court: VenueCourt; selected: boolean; night: boolean; onSelect: () => void }) {
  const scale = court.scale ?? 0.72;
  return (
    <group position={court.position} rotation={[0, court.rotation ?? 0, 0]} scale={scale} onClick={(event) => { event.stopPropagation(); onSelect(); }} onPointerEnter={() => { document.body.style.cursor = "pointer"; }} onPointerLeave={() => { document.body.style.cursor = "default"; }}>
      <mesh position={[0, -0.04, 0]} receiveShadow><boxGeometry args={[12.7, 0.12, 21.2]} /><meshStandardMaterial color={selected ? "#ff6a2a" : "#273a40"} roughness={0.92} /></mesh>
      <TennisCourt compact night={night} /><CourtFurniture showSeats={court.kind === "show"} night={night} /><SelectionHalo selected={selected} radius={11.8} />
      {selected && <Html center position={[0, 6.6, 0]} distanceFactor={25}><div className="whitespace-nowrap rounded-full border border-orange-300/60 bg-[#101619]/92 px-3 py-1.5 text-xs font-bold text-white shadow-2xl backdrop-blur">{court.name}</div></Html>}
    </group>
  );
}

function EllipseRing({ radius, tube, y, color, metalness = 0.35, roughness = 0.45, scaleX = 1.2 }: { radius: number; tube: number; y: number; color: string; metalness?: number; roughness?: number; scaleX?: number }) {
  return <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[scaleX, 1, 1]} castShadow receiveShadow><torusGeometry args={[radius, tube, 12, 72]} /><meshStandardMaterial color={color} metalness={metalness} roughness={roughness} /></mesh>;
}

function FacadeFins({ radiusX, radiusZ, count, y, height, color }: { radiusX: number; radiusZ: number; count: number; y: number; height: number; color: string }) {
  return <group>{Array.from({ length: count }, (_, index) => { const a = (index / count) * Math.PI * 2; return <mesh key={index} position={[Math.cos(a) * radiusX, y, Math.sin(a) * radiusZ]} rotation={[0, -a, 0]} castShadow><boxGeometry args={[0.18, height, 0.72]} /><meshStandardMaterial color={color} metalness={0.42} roughness={0.36} /></mesh>; })}</group>;
}

function ArenaLabel({ court, selected, onSelect }: { court: VenueCourt; selected: boolean; onSelect: () => void }) {
  return <Html center position={[0, 14.2, 0]} distanceFactor={38}><button onClick={(event) => { event.stopPropagation(); onSelect(); }} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold shadow-2xl backdrop-blur transition ${selected ? "border-orange-200 bg-[#ff5a1f] text-white" : "border-white/25 bg-[#101619]/88 text-white hover:border-orange-300"}`}>{court.name}</button></Html>;
}

function RodLaverArena({ court, selected, night, onSelect }: { court: VenueCourt; selected: boolean; night: boolean; onSelect: () => void }) {
  const roofGap = selected ? 7.3 : 3.4;
  return (
    <group position={court.position} scale={[1.14, 1, 1]} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow><cylinderGeometry args={[18.6, 20.2, 2.2, 72]} /><PhysicalMaterial kind="concrete" /></mesh>
      <mesh position={[0, 5.2, 0]} scale={[1.14, 1, 1]}><cylinderGeometry args={[17.8, 18.6, 6.2, 72, 1, true]} /><PhysicalMaterial kind="glass" night={night} /></mesh>
      <FacadeFins radiusX={20.65} radiusZ={18.05} count={44} y={5.15} height={6.5} color="#d3d7d5" /><EllipseRing radius={17.1} tube={1.5} y={8.7} color="#d9dddc" metalness={0.72} roughness={0.3} scaleX={1.14} />
      {[-1, 1].map((side) => <group key={side} position={[side * roofGap, 9.45, 0]}><RoundedBox args={[12.5, 0.65, 17.7]} radius={0.5} smoothness={4} castShadow><PhysicalMaterial kind="silver" /></RoundedBox>{[-6, -3, 0, 3, 6].map((z) => <mesh key={z} position={[0, 0.42, z]}><boxGeometry args={[12.2, 0.12, 0.18]} /><meshStandardMaterial color="#f2f5f5" metalness={0.78} roughness={0.28} /></mesh>)}</group>)}
      <group position={[0, 2.45, 0]} scale={0.82}><TennisCourt night={night} /></group>
      {[13.2, 15.1, 16.7].map((radius, index) => <EllipseRing key={radius} radius={radius} tube={0.72} y={2.6 + index * 1.15} color={index === 1 ? "#1576af" : "#164f78"} scaleX={1.14} roughness={0.78} />)}
      <SelectionHalo selected={selected} radius={22} /><ArenaLabel court={court} selected={selected} onSelect={onSelect} />
    </group>
  );
}

function MargaretCourtArena({ court, selected, night, onSelect }: { court: VenueCourt; selected: boolean; night: boolean; onSelect: () => void }) {
  const roofGap = selected ? 6.2 : 2.7;
  return (
    <group position={court.position} scale={[1.08, 1, 0.92]} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <mesh position={[0, 1.1, 0]} castShadow><cylinderGeometry args={[15.6, 17, 2.2, 12]} /><PhysicalMaterial kind="concrete" /></mesh>
      <mesh position={[0, 4.8, 0]}><cylinderGeometry args={[14.8, 15.7, 6.3, 12, 1, true]} /><PhysicalMaterial kind="glass" night={night} /></mesh>
      <FacadeFins radiusX={16.2} radiusZ={15} count={24} y={4.8} height={6.7} color="#b06b42" /><EllipseRing radius={14.9} tube={1.35} y={8.05} color="#a65f37" metalness={0.66} roughness={0.36} scaleX={1.08} />
      {[-1, 1].map((side) => <RoundedBox key={side} position={[side * roofGap, 8.65, 0]} args={[10.7, 0.62, 15]} radius={0.35} smoothness={3} castShadow><PhysicalMaterial kind="bronze" /></RoundedBox>)}
      <group position={[0, 2.42, 0]} scale={0.72}><TennisCourt night={night} /></group>
      {[11.8, 13.2, 14.4].map((radius, index) => <EllipseRing key={radius} radius={radius} tube={0.65} y={2.7 + index * 1.05} color={index === 1 ? "#197bb5" : "#184e70"} scaleX={1.08} roughness={0.8} />)}
      <SelectionHalo selected={selected} radius={18.7} /><ArenaLabel court={court} selected={selected} onSelect={onSelect} />
    </group>
  );
}

function JohnCainArena({ court, selected, night, onSelect }: { court: VenueCourt; selected: boolean; night: boolean; onSelect: () => void }) {
  const roofGap = selected ? 7.5 : 3.6;
  return (
    <group position={court.position} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <RoundedBox position={[0, 1.15, 0]} args={[39, 2.3, 29]} radius={5.5} smoothness={5} castShadow receiveShadow><PhysicalMaterial kind="concrete" /></RoundedBox>
      <RoundedBox position={[0, 5.15, 0]} args={[37, 6.3, 27]} radius={5} smoothness={5}><PhysicalMaterial kind="glass" night={night} /></RoundedBox>
      {[-17.8, 17.8].map((x) => <mesh key={x} position={[x, 6.2, 0]}><boxGeometry args={[0.45, 8.2, 25]} /><PhysicalMaterial kind="silver" /></mesh>)}
      {[-12, -6, 0, 6, 12].map((x) => <mesh key={x} position={[x, 10.1, 0]} rotation={[0, 0, x * 0.004]}><boxGeometry args={[0.28, 0.42, 30]} /><meshStandardMaterial color="#f1f3f2" metalness={0.72} roughness={0.28} /></mesh>)}
      {[-1, 1].map((side) => <RoundedBox key={side} position={[side * roofGap, 9.6, 0]} args={[15.6, 0.7, 25]} radius={0.45} smoothness={4} castShadow><PhysicalMaterial kind="silver" /></RoundedBox>)}
      <group position={[0, 2.5, 0]} scale={0.8}><TennisCourt night={night} /></group>
      {[-1, 1].map((side) => <group key={side} position={[side * 12, 3.2, 0]}>{[0, 1, 2].map((tier) => <mesh key={tier} position={[side * tier * 0.75, tier * 0.85, 0]}><boxGeometry args={[1.3, 0.72, 20]} /><meshStandardMaterial color={tier === 1 ? "#147cb5" : "#155b85"} roughness={0.8} /></mesh>)}</group>)}
      <SelectionHalo selected={selected} radius={23} /><ArenaLabel court={court} selected={selected} onSelect={onSelect} />
    </group>
  );
}

function KiaArena({ court, selected, night, onSelect }: { court: VenueCourt; selected: boolean; night: boolean; onSelect: () => void }) {
  return (
    <group position={court.position} rotation={[0, court.rotation ?? 0, 0]} scale={[1.06, 1, 0.92]} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <mesh position={[0, 1.1, 0]} castShadow><cylinderGeometry args={[15.8, 17, 2.2, 64]} /><PhysicalMaterial kind="dark" /></mesh>
      <FacadeFins radiusX={17.1} radiusZ={15.7} count={52} y={5.1} height={7.2} color="#e3dfd3" /><EllipseRing radius={15.5} tube={1.2} y={8.4} color="#ece9df" metalness={0.25} roughness={0.55} scaleX={1.08} />
      <mesh position={[0, 4.7, -15.8]}><boxGeometry args={[6, 5.5, 0.7]} /><meshStandardMaterial color="#f3b313" roughness={0.55} /></mesh>
      <group position={[0, 2.35, 0]} scale={0.76}><TennisCourt night={night} /></group>
      {[11.8, 13.2, 14.4].map((radius, index) => <EllipseRing key={radius} radius={radius} tube={0.72} y={2.65 + index * 1.15} color={index === 1 ? "#1482bd" : "#145779"} scaleX={1.08} roughness={0.78} />)}
      <SelectionHalo selected={selected} radius={19} /><ArenaLabel court={court} selected={selected} onSelect={onSelect} />
    </group>
  );
}

function MajorArena({ court, selected, night, onSelect }: { court: VenueCourt; selected: boolean; night: boolean; onSelect: () => void }) {
  if (court.id === "rod-laver") return <RodLaverArena court={court} selected={selected} night={night} onSelect={onSelect} />;
  if (court.id === "margaret-court") return <MargaretCourtArena court={court} selected={selected} night={night} onSelect={onSelect} />;
  if (court.id === "john-cain") return <JohnCainArena court={court} selected={selected} night={night} onSelect={onSelect} />;
  return <KiaArena court={court} selected={selected} night={night} onSelect={onSelect} />;
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return <group position={position} scale={scale}><mesh position={[0, 1.1, 0]} castShadow><cylinderGeometry args={[0.18, 0.34, 2.2, 7]} /><meshStandardMaterial color="#544236" roughness={1} /></mesh><mesh position={[0, 3.2, 0]} castShadow><icosahedronGeometry args={[1.7, 1]} /><meshStandardMaterial color="#356947" roughness={1} /></mesh><mesh position={[0.8, 2.8, 0.4]} castShadow><icosahedronGeometry args={[1.1, 1]} /><meshStandardMaterial color="#3f7750" roughness={1} /></mesh></group>;
}

function PavedPath({ position, size, rotation = 0, color = "#c9c8bf" }: { position: [number, number, number]; size: [number, number]; rotation?: number; color?: string }) {
  return <mesh position={position} rotation={[0, rotation, 0]} receiveShadow><boxGeometry args={[size[0], 0.12, size[1]]} /><meshStandardMaterial color={color} roughness={0.94} /></mesh>;
}

function Centrepiece({ night }: { night: boolean }) {
  return (
    <group position={[-8, 0, 12]} rotation={[0, -0.05, 0]}>
      <RoundedBox position={[0, 3.7, 0]} args={[29, 7.2, 18]} radius={1.8} smoothness={4} castShadow><PhysicalMaterial kind="glass" night={night} /></RoundedBox>
      {[-12, -8, -4, 0, 4, 8, 12].map((x) => <mesh key={x} position={[x, 3.7, -9.15]} rotation={[0, 0, x * 0.012]}><boxGeometry args={[0.38, 7.4, 0.6]} /><meshStandardMaterial color="#bb8b55" roughness={0.56} metalness={0.2} /></mesh>)}
      <RoundedBox position={[0, 7.55, 0]} args={[30.5, 0.8, 19.5]} radius={1.8} smoothness={4} castShadow><PhysicalMaterial kind="silver" /></RoundedBox>
      <mesh position={[0, 4, -9.5]}><boxGeometry args={[9, 2.4, 0.25]} /><meshStandardMaterial color="#092f46" emissive={night ? "#078bc5" : "#012234"} emissiveIntensity={night ? 1.4 : 0.18} /></mesh>
      <Html center position={[0, 9.2, 0]} distanceFactor={40}><div className="whitespace-nowrap rounded bg-black/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/85">CENTREPIECE</div></Html>
    </group>
  );
}

function EasternPlaza({ night }: { night: boolean }) {
  return (
    <group position={[119, 0, 50]}>
      <RoundedBox position={[0, 4.3, 0]} args={[25, 8.5, 38]} radius={1.6} smoothness={4} castShadow><meshStandardMaterial color="#e0dfd9" metalness={0.35} roughness={0.48} /></RoundedBox>
      {[-10, -5, 0, 5, 10].map((x) => <RoundedBox key={x} position={[x, 8.9, 0]} args={[4, 0.65, 35]} radius={0.5} smoothness={3}><PhysicalMaterial kind="silver" /></RoundedBox>)}
      <mesh position={[-12.65, 3.9, 0]}><boxGeometry args={[0.3, 6.2, 30]} /><PhysicalMaterial kind="glass" night={night} /></mesh>
      <Html center position={[0, 10.4, 0]} distanceFactor={44}><div className="whitespace-nowrap rounded bg-black/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/85">National Tennis Centre</div></Html>
    </group>
  );
}

function GrandSlamOval({ night }: { night: boolean }) {
  return (
    <group position={[2, 0, -38]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} scale={[1.6, 1, 1]} receiveShadow><circleGeometry args={[17, 72]} /><meshStandardMaterial color="#5f963e" roughness={1} /></mesh>
      <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.45, 1, 1]}><ringGeometry args={[13, 13.4, 72]} /><meshBasicMaterial color="#c4dcae" /></mesh>
      <RoundedBox position={[0, 1.25, -12]} args={[11, 2.2, 3.2]} radius={0.6} smoothness={3} castShadow><meshStandardMaterial color="#202b31" roughness={0.6} /></RoundedBox>
      <mesh position={[0, 3, -13.65]}><boxGeometry args={[8, 2.8, 0.2]} /><meshStandardMaterial color="#064c71" emissive={night ? "#0d9ed8" : "#00334c"} emissiveIntensity={night ? 1.6 : 0.2} /></mesh>
      {Array.from({ length: 16 }, (_, index) => { const a = (index / 16) * Math.PI * 2; return <mesh key={index} position={[Math.cos(a) * 14, 0.65, Math.sin(a) * 10]}><cylinderGeometry args={[0.6, 0.75, 1.3, 12]} /><meshStandardMaterial color={index % 2 ? "#f1a929" : "#d95d3b"} roughness={0.78} /></mesh>; })}
      <Html center position={[0, 5.2, 0]} distanceFactor={40}><div className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-white drop-shadow-lg">Grand Slam Oval</div></Html>
    </group>
  );
}

function ContextLandmarks() {
  return (
    <group>
      <group position={[5, -0.4, 132]} scale={[1.45, 1, 1]}><mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[34, 7, 14, 80]} /><meshStandardMaterial color="#b5b8b4" roughness={0.82} metalness={0.2} /></mesh><mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[26, 64]} /><meshStandardMaterial color="#6b914c" roughness={1} /></mesh><Html center position={[0, 12, 0]} distanceFactor={58}><div className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Melbourne Cricket Ground</div></Html></group>
      <group position={[83, 0, -112]} scale={[1.25, 1, 0.95]}><EllipseRing radius={23} tube={4.2} y={4.3} color="#e5e4df" metalness={0.45} roughness={0.45} scaleX={1.25} />{[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} position={[0, 8 + (i % 2) * 1.4, 0]} rotation={[0, i * Math.PI / 3, Math.PI / 11]}><boxGeometry args={[1, 0.55, 42]} /><meshStandardMaterial color="#f0eee8" metalness={0.5} roughness={0.38} /></mesh>)}<Html center position={[0, 14, 0]} distanceFactor={58}><div className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">AAMI Park</div></Html></group>
    </group>
  );
}

function PrecinctGround({ night }: { night: boolean }) {
  const trees = useMemo(() => {
    const points: [number, number, number][] = [];
    for (let i = 0; i < 54; i += 1) {
      const edge = i % 3;
      if (edge === 0) points.push([-122 + (i % 5) * 3.5, 0, -74 + ((i * 19) % 146)]);
      else if (edge === 1) points.push([118 - (i % 6) * 3.1, 0, -68 + ((i * 23) % 132)]);
      else points.push([-96 + ((i * 17) % 190), 0, -70 + (i % 4) * 3.2]);
    }
    return points;
  }, []);
  return (
    <group>
      <mesh position={[0, -0.65, 4]} receiveShadow><boxGeometry args={[270, 1.2, 190]} /><meshStandardMaterial color={night ? "#18362c" : "#3d7657"} roughness={1} /></mesh>
      <mesh position={[0, -0.02, 84]} rotation={[0, -0.025, 0]} receiveShadow><boxGeometry args={[275, 0.2, 15]} /><meshStandardMaterial color="#3d4141" roughness={0.96} /></mesh>
      {[-5, 0, 5].map((offset) => <mesh key={offset} position={[0, 0.12, 84 + offset]} rotation={[0, -0.025, 0]}><boxGeometry args={[275, 0.06, 0.14]} /><meshStandardMaterial color="#b9bbb6" metalness={0.55} roughness={0.48} /></mesh>)}
      <mesh position={[0, -0.05, -90]} rotation={[0, 0.055, 0]} receiveShadow><boxGeometry args={[282, 0.3, 25]} /><meshStandardMaterial color={night ? "#14354b" : "#2e6d91"} roughness={0.72} metalness={0.08} /></mesh>
      <mesh position={[-4, 0.02, -73]} rotation={[0, 0.05, 0]} receiveShadow><boxGeometry args={[276, 0.18, 8]} /><meshStandardMaterial color="#555a58" roughness={0.95} /></mesh>
      <PavedPath position={[-43, 0.03, 3]} size={[76, 18]} rotation={-0.05} /><PavedPath position={[22, 0.035, 7]} size={[56, 13]} rotation={0.12} color="#d3d1c7" /><PavedPath position={[59, 0.035, -10]} size={[52, 11]} rotation={-0.3} color="#c8c7bd" /><PavedPath position={[19, 0.04, -36]} size={[73, 8]} rotation={0.02} color="#bbbcb5" /><PavedPath position={[-70, 0.04, 43]} size={[72, 7]} rotation={-0.08} color="#bbbcb5" /><PavedPath position={[86, 0.04, 24]} size={[60, 7]} rotation={0.01} color="#bbbcb5" />
      <mesh position={[-45, 1.4, -81]} rotation={[0, 0.045, 0]} castShadow><boxGeometry args={[4.2, 0.45, 24]} /><meshStandardMaterial color="#cbc9bf" metalness={0.22} roughness={0.6} /></mesh><mesh position={[-45, 2.2, -81]} rotation={[0, 0.045, 0]}><boxGeometry args={[4.5, 1.1, 23]} /><meshPhysicalMaterial color="#77a9ba" roughness={0.18} transmission={0.18} transparent opacity={0.65} /></mesh>
      {trees.map((position, index) => <Tree key={`${position[0]}-${position[2]}`} position={position} scale={0.68 + (index % 4) * 0.12} />)}
      <Html center position={[-110, 1, -91]} distanceFactor={54}><div className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/80">Yarra River</div></Html><Html center position={[0, 1, 85]} distanceFactor={54}><div className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">Jolimont rail corridor</div></Html><ContextLandmarks />
    </group>
  );
}

const PRESET_CAMERA: Record<ViewPreset, THREE.Vector3> = { overview: new THREE.Vector3(0, 120, -165), river: new THREE.Vector3(112, 36, -126), west: new THREE.Vector3(118, 52, -72), east: new THREE.Vector3(-128, 48, -58) };

function CameraRig({ focus, preset }: { focus: VenueCourt | null; preset: ViewPreset }) {
  const { camera } = useThree();
  const destination = useRef(PRESET_CAMERA.overview.clone());
  const previousKey = useRef("");
  const moving = useRef(true);
  const key = focus ? `court-${focus.id}` : `preset-${preset}`;
  if (previousKey.current !== key) {
    previousKey.current = key;
    if (focus) destination.current.set(-focus.position[0] + 24, focus.kind === "arena" || focus.kind === "show" ? 28 : 20, focus.position[2] + 30);
    else destination.current.copy(PRESET_CAMERA[preset]);
    moving.current = true;
  }
  useFrame((_, delta) => { if (!moving.current) return; camera.position.lerp(destination.current, 1 - Math.exp(-delta * 2.15)); if (camera.position.distanceTo(destination.current) < 0.2) moving.current = false; });
  return null;
}

function SceneLighting({ night }: { night: boolean }) {
  return <><color attach="background" args={[night ? "#07131f" : "#84b4d0"]} /><fog attach="fog" args={[night ? "#07131f" : "#84b4d0", 145, 330]} />{!night && <Sky distance={450000} sunPosition={[-80, 55, -45]} turbidity={5} rayleigh={0.7} mieCoefficient={0.008} mieDirectionalG={0.85} />}<hemisphereLight args={[night ? "#577b9d" : "#e7f5ff", night ? "#17291e" : "#365e43", night ? 0.8 : 1.55]} /><ambientLight intensity={night ? 0.42 : 0.86} /><directionalLight position={[-75, 105, -42]} intensity={night ? 0.7 : 2.8} color={night ? "#89aedd" : "#fff4dd"} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-far={260} shadow-camera-left={-145} shadow-camera-right={145} shadow-camera-top={120} shadow-camera-bottom={-120} />{night && ([[-48, 18, -8], [-79, 15, 22], [24, 20, 34], [58, 16, -28]] as [number, number, number][]).map((position, index) => <pointLight key={index} position={position} color={index === 3 ? "#ffd35a" : "#bcecff"} intensity={55} distance={65} decay={2} />)}</>;
}

function PrecinctScene({ selected, preset, night, onSelect }: { selected: VenueCourt | null; preset: ViewPreset; night: boolean; onSelect: (court: VenueCourt) => void }) {
  const focus: [number, number, number] = selected ? [-selected.position[0], selected.position[1], selected.position[2]] : [0, 0, 0];
  return <><SceneLighting night={night} /><group scale={[-1, 1, 1]}><PrecinctGround night={night} /><Centrepiece night={night} /><EasternPlaza night={night} /><GrandSlamOval night={night} />{ARENAS.map((court) => <MajorArena key={court.id} court={court} selected={selected?.id === court.id} night={night} onSelect={() => onSelect(court)} />)}{OUTDOOR_COURTS.map((court) => <OutdoorCourt key={court.id} court={court} selected={selected?.id === court.id} night={night} onSelect={() => onSelect(court)} />)}</group><CameraRig focus={selected} preset={preset} /><OrbitControls makeDefault target={[focus[0], 0, focus[2]]} enableDamping dampingFactor={0.075} minDistance={15} maxDistance={275} minPolarAngle={0.16} maxPolarAngle={1.46} /></>;
}

function kindLabel(kind: CourtKind) {
  if (kind === "arena") return "Major arena";
  if (kind === "show") return "Show court";
  if (kind === "practice") return "Practice court";
  return "Outdoor court";
}

export default function MelbourneParkExperience() {
  const [selected, setSelected] = useState<VenueCourt | null>(null);
  const [preset, setPreset] = useState<ViewPreset>("overview");
  const [time, setTime] = useState<TimeOfDay>("day");
  const [panelOpen, setPanelOpen] = useState(true);

  function choosePreset(next: ViewPreset) { setSelected(null); setPreset(next); setPanelOpen(false); }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a151b]">
      <div className="absolute inset-0"><Canvas shadows camera={{ position: [0, 120, -165], fov: 42, near: 0.1, far: 480 }} dpr={[1, 1.65]} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = time === "night" ? 0.88 : 1.04; }}><Suspense fallback={null}><PrecinctScene selected={selected} preset={preset} night={time === "night"} onSelect={(court) => { setSelected(court); setPanelOpen(true); }} /></Suspense></Canvas></div>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 sm:p-5"><div className="pointer-events-auto mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[#091217]/88 px-4 py-3 shadow-2xl backdrop-blur-xl"><div className="flex items-center gap-3"><Link href="/" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/60 transition hover:border-white/30 hover:text-white">Tennis-Agent</Link><div><h1 className="text-sm font-bold text-white sm:text-base">Melbourne Park 3D</h1><p className="text-[10px] uppercase tracking-[0.16em] text-sky-200/65">Reference-based real-time precinct reconstruction</p></div></div><div className="flex flex-wrap items-center gap-2"><div className="hidden items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1 text-[11px] sm:flex">{(["overview", "river", "west", "east"] as ViewPreset[]).map((view) => <button key={view} onClick={() => choosePreset(view)} className={`rounded-lg px-2.5 py-1.5 capitalize transition ${!selected && preset === view ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}>{view}</button>)}</div><button onClick={() => setTime((current) => current === "day" ? "night" : "day")} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70 transition hover:border-white/30 hover:text-white">{time === "day" ? "☀ Day" : "◐ Night"}</button><nav className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1 text-xs"><Link href="/board" className="rounded-lg px-3 py-2 text-white/65 transition hover:bg-white/10 hover:text-white">Tactics board</Link><span className="rounded-lg bg-[#ff5a1f] px-3 py-2 font-semibold text-white">3D precinct</span></nav></div></div></header>
      <section className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 sm:p-5"><div className="mx-auto flex max-w-7xl items-end justify-between gap-3"><div className={`pointer-events-auto max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#091217]/92 shadow-2xl backdrop-blur-xl transition ${panelOpen && selected ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>{selected && <div className="p-4 sm:p-5"><div className="mb-3 flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff8b5e]">{kindLabel(selected.kind)}</p><h2 className="mt-1 text-xl font-bold text-white">{selected.name}</h2><p className="mt-1 text-xs text-white/45">{selected.subtitle ?? "Melbourne Park competition court"}</p></div><button onClick={() => setPanelOpen(false)} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/45 transition hover:text-white">×</button></div><p className="text-xs leading-relaxed text-white/62">{selected.description ?? "A competition court within the Australian Open precinct. Select another venue or return to the complete site overview."}</p>{selected.materials && <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.035] p-3"><p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-white/35">Architectural material study</p><p className="mt-1 text-xs leading-relaxed text-white/62">{selected.materials}</p></div>}<div className="mt-4 flex gap-2"><Link href="/board" className="rounded-lg bg-[#ff5a1f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#ff7040]">Open tactics board →</Link><button onClick={() => choosePreset("overview")} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 transition hover:border-white/35 hover:text-white">Full precinct</button></div></div>}</div><div className="pointer-events-auto flex flex-col items-end gap-2">{!panelOpen && selected && <button onClick={() => setPanelOpen(true)} className="rounded-full border border-white/15 bg-[#091217]/92 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-xl">{selected.name}</button>}<div className="rounded-2xl border border-white/15 bg-[#091217]/92 px-4 py-3 text-right shadow-xl backdrop-blur-xl"><div className="text-2xl font-black text-white">{ALL_COURTS.length}</div><div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Selectable courts</div><p className="mt-1 text-[10px] text-white/35">Drag to orbit · Scroll to zoom · Click a venue</p></div></div></div></section>
    </main>
  );
}
