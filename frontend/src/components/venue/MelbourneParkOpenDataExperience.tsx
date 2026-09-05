"use client";

import * as THREE from "three";
import Link from "next/link";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, RoundedBox, Sky } from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

type LonLat = [number, number];
type ViewPreset = "precinct" | "river" | "western" | "eastern";

interface DataGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

interface BuildingRecord {
  id: string;
  structureId: string;
  tier: number;
  type: string;
  roofType: string;
  minElevation: number;
  maxElevation: number;
  extrusion: number;
  geometry: DataGeometry;
}

interface OsmPoint {
  lat: number;
  lon: number;
}

interface OsmFeature {
  id: string;
  type: string;
  tags: Record<string, string>;
  center: OsmPoint | null;
  geometry: OsmPoint[] | null;
}

interface OpenDataSet {
  generatedAt: string;
  origin: { latitude: number; longitude: number };
  buildings: BuildingRecord[];
  osmFeatures: OsmFeature[];
}

interface CourtFeature {
  id: string;
  name: string;
  source: OsmFeature;
  center: THREE.Vector2;
  size: THREE.Vector2;
  angle: number;
}

const DATA_URL = "/data/melbourne-park-open-data.json";
const GROUND_DATUM = 5.5;
const COURT_BLUE = "#087dc1";
const COURT_SURROUND = "#27a2d3";
const BUILDING_PALETTE = ["#697574", "#7c7770", "#69767c", "#89796b", "#777d78"];

const CAMERA_PRESETS: Record<ViewPreset, [number, number, number]> = {
  precinct: [0, 820, 920],
  river: [-280, 185, 560],
  western: [-610, 250, 120],
  eastern: [610, 255, 150],
};

function projectPoint(point: LonLat, origin: OpenDataSet["origin"]) {
  const latitudeScale = 110_540;
  const longitudeScale = 111_320 * Math.cos((origin.latitude * Math.PI) / 180);
  return new THREE.Vector2(
    (point[0] - origin.longitude) * longitudeScale,
    -(point[1] - origin.latitude) * latitudeScale,
  );
}

function osmPointToVector(point: OsmPoint, origin: OpenDataSet["origin"]) {
  return projectPoint([point.lon, point.lat], origin);
}

function shapeFromRings(rings: LonLat[][], origin: OpenDataSet["origin"]) {
  const outer = rings[0];
  if (!outer || outer.length < 3) return null;
  const shape = new THREE.Shape();
  outer.forEach((point, index) => {
    const projected = projectPoint(point, origin);
    if (index === 0) shape.moveTo(projected.x, -projected.y);
    else shape.lineTo(projected.x, -projected.y);
  });
  for (const holeRing of rings.slice(1)) {
    if (holeRing.length < 3) continue;
    const hole = new THREE.Path();
    holeRing.forEach((point, index) => {
      const projected = projectPoint(point, origin);
      if (index === 0) hole.moveTo(projected.x, -projected.y);
      else hole.lineTo(projected.x, -projected.y);
    });
    shape.holes.push(hole);
  }
  return shape;
}

function geometryShapes(geometry: DataGeometry, origin: OpenDataSet["origin"]) {
  const polygonCoordinates = geometry.type === "Polygon"
    ? [geometry.coordinates as LonLat[][]]
    : geometry.coordinates as LonLat[][][];
  return polygonCoordinates
    .map((rings) => shapeFromRings(rings, origin))
    .filter((shape): shape is THREE.Shape => Boolean(shape));
}

function OpenDataBuildings({ data }: { data: OpenDataSet }) {
  const geometry = useMemo(() => {
    const pieces: THREE.BufferGeometry[] = [];
    for (const building of data.buildings) {
      const shapes = geometryShapes(building.geometry, data.origin);
      if (!shapes.length) continue;
      const height = Math.max(0.8, building.extrusion || building.maxElevation - building.minElevation);
      const base = Math.max(0, building.minElevation - GROUND_DATUM);
      const part = new THREE.ExtrudeGeometry(shapes, {
        depth: height,
        bevelEnabled: false,
        curveSegments: 1,
      });
      part.rotateX(-Math.PI / 2);
      part.translate(0, base, 0);
      const paletteIndex = [...building.structureId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % BUILDING_PALETTE.length;
      const color = new THREE.Color(BUILDING_PALETTE[paletteIndex]);
      const colors = new Float32Array(part.attributes.position.count * 3);
      for (let colorIndex = 0; colorIndex < part.attributes.position.count; colorIndex += 1) {
        colors[colorIndex * 3] = color.r;
        colors[colorIndex * 3 + 1] = color.g;
        colors[colorIndex * 3 + 2] = color.b;
      }
      part.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      pieces.push(part);
    }
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((piece) => piece.dispose());
    merged?.computeVertexNormals();
    return merged;
  }, [data]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.48} metalness={0.23} envMapIntensity={0.92} />
    </mesh>
  );
}

function StreetDetails({ data, night }: { data: OpenDataSet; night: boolean }) {
  const treeTrunks = useRef<THREE.InstancedMesh>(null);
  const treeCrowns = useRef<THREE.InstancedMesh>(null);
  const lampPoles = useRef<THREE.InstancedMesh>(null);
  const lampHeads = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => data.osmFeatures.filter((feature) => feature.tags.natural === "tree" && feature.center), [data]);
  const lamps = useMemo(() => data.osmFeatures.filter((feature) => feature.tags.highway === "street_lamp" && feature.center), [data]);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    trees.forEach((feature, index) => {
      const point = osmPointToVector(feature.center!, data.origin);
      const scale = 0.72 + (Number(feature.id.split("/")[1]) % 7) * 0.055;
      dummy.position.set(point.x, 1.65 * scale, point.y);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      treeTrunks.current?.setMatrixAt(index, dummy.matrix);
      dummy.position.set(point.x, 4.25 * scale, point.y);
      dummy.rotation.set(0, (index % 11) * 0.37, 0);
      dummy.updateMatrix();
      treeCrowns.current?.setMatrixAt(index, dummy.matrix);
    });
    if (treeTrunks.current) treeTrunks.current.instanceMatrix.needsUpdate = true;
    if (treeCrowns.current) treeCrowns.current.instanceMatrix.needsUpdate = true;

    lamps.forEach((feature, index) => {
      const point = osmPointToVector(feature.center!, data.origin);
      dummy.position.set(point.x, 2.9, point.y);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      lampPoles.current?.setMatrixAt(index, dummy.matrix);
      dummy.position.set(point.x, 5.86, point.y);
      dummy.updateMatrix();
      lampHeads.current?.setMatrixAt(index, dummy.matrix);
    });
    if (lampPoles.current) lampPoles.current.instanceMatrix.needsUpdate = true;
    if (lampHeads.current) lampHeads.current.instanceMatrix.needsUpdate = true;
  }, [data, lamps, trees]);

  return (
    <group>
      <instancedMesh ref={treeTrunks} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.18, 0.32, 3.3, 7]} />
        <meshStandardMaterial color="#4d4034" roughness={0.96} />
      </instancedMesh>
      <instancedMesh ref={treeCrowns} args={[undefined, undefined, trees.length]} castShadow>
        <icosahedronGeometry args={[2.15, 1]} />
        <meshStandardMaterial color={night ? "#1f4a34" : "#2e6847"} roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={lampPoles} args={[undefined, undefined, lamps.length]} castShadow>
        <cylinderGeometry args={[0.055, 0.09, 5.8, 8]} />
        <meshStandardMaterial color="#273235" metalness={0.78} roughness={0.36} />
      </instancedMesh>
      <instancedMesh ref={lampHeads} args={[undefined, undefined, lamps.length]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial color="#eef7f4" emissive={night ? "#cbefff" : "#3c4544"} emissiveIntensity={night ? 4.5 : 0.08} />
      </instancedMesh>
    </group>
  );
}

function lineGeometry(features: OsmFeature[], origin: OpenDataSet["origin"]) {
  const positions: number[] = [];
  for (const feature of features) {
    if (!feature.geometry || feature.geometry.length < 2) continue;
    for (let index = 1; index < feature.geometry.length; index += 1) {
      const start = osmPointToVector(feature.geometry[index - 1], origin);
      const end = osmPointToVector(feature.geometry[index], origin);
      positions.push(start.x, 0, start.y, end.x, 0, end.y);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function ribbonGeometry(features: OsmFeature[], width: number, origin: OpenDataSet["origin"]) {
  const positions: number[] = [];
  for (const feature of features) {
    if (!feature.geometry || feature.geometry.length < 2) continue;
    for (let index = 1; index < feature.geometry.length; index += 1) {
      const start = osmPointToVector(feature.geometry[index - 1], origin);
      const end = osmPointToVector(feature.geometry[index], origin);
      const direction = end.clone().sub(start);
      if (direction.lengthSq() < 0.0001) continue;
      const normal = new THREE.Vector2(-direction.y, direction.x).normalize().multiplyScalar(width / 2);
      const startLeft = start.clone().add(normal);
      const startRight = start.clone().sub(normal);
      const endLeft = end.clone().add(normal);
      const endRight = end.clone().sub(normal);
      positions.push(
        startLeft.x, 0, startLeft.y,
        endLeft.x, 0, endLeft.y,
        startRight.x, 0, startRight.y,
        startRight.x, 0, startRight.y,
        endLeft.x, 0, endLeft.y,
        endRight.x, 0, endRight.y,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function areaGeometry(features: OsmFeature[], origin: OpenDataSet["origin"]) {
  const pieces: THREE.BufferGeometry[] = [];
  for (const feature of features) {
    if (!feature.geometry || feature.geometry.length < 4) continue;
    const shape = shapeFromRings([feature.geometry.map((point) => [point.lon, point.lat] as LonLat)], origin);
    if (!shape) continue;
    const geometry = new THREE.ShapeGeometry(shape, 1);
    geometry.rotateX(-Math.PI / 2);
    pieces.push(geometry);
  }
  const merged = mergeGeometries(pieces, false) ?? new THREE.BufferGeometry();
  pieces.forEach((piece) => piece.dispose());
  return merged;
}

function OpenDataNetwork({ data, night }: { data: OpenDataSet; night: boolean }) {
  const groups = useMemo(() => {
    const paths = data.osmFeatures.filter((feature) => feature.tags.highway && !["motorway", "trunk", "primary"].includes(feature.tags.highway));
    const roads = data.osmFeatures.filter((feature) => ["motorway", "trunk", "primary", "secondary", "tertiary"].includes(feature.tags.highway));
    const rails = data.osmFeatures.filter((feature) => feature.tags.railway === "rail");
    const water = data.osmFeatures.filter((feature) => feature.tags.waterway || feature.tags.natural === "water");
    const pedestrianAreas = paths.filter((feature) => feature.tags.area === "yes" && feature.geometry);
    const asphaltAreas = pedestrianAreas.filter((feature) => feature.tags.surface === "asphalt");
    const pavedAreas = pedestrianAreas.filter((feature) => feature.tags.surface !== "asphalt" && feature.tags.surface !== "unpaved");
    const rivers = water.filter((feature) => feature.tags.waterway === "river");
    return {
      paths: lineGeometry(paths, data.origin),
      roads: lineGeometry(roads, data.origin),
      rails: lineGeometry(rails, data.origin),
      water: lineGeometry(water, data.origin),
      pathSurfaces: ribbonGeometry(paths, 2.4, data.origin),
      roadSurfaces: ribbonGeometry(roads, 7.5, data.origin),
      railBed: ribbonGeometry(rails, 2.2, data.origin),
      riverSurface: ribbonGeometry(rivers, 54, data.origin),
      pavedAreas: areaGeometry(pavedAreas, data.origin),
      asphaltAreas: areaGeometry(asphaltAreas, data.origin),
    };
  }, [data]);

  useEffect(() => () => Object.values(groups).forEach((geometry) => geometry.dispose()), [groups]);
  return (
    <group position={[0, 0.13, 0]}>
      <mesh geometry={groups.riverSurface} position={[0, -0.13, 0]} receiveShadow><meshPhysicalMaterial color={night ? "#15394b" : "#397e97"} roughness={0.3} metalness={0.08} clearcoat={0.55} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={groups.pavedAreas} position={[0, -0.085, 0]} receiveShadow><meshStandardMaterial color={night ? "#596063" : "#c6c3ba"} roughness={0.88} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={groups.asphaltAreas} position={[0, -0.075, 0]} receiveShadow><meshStandardMaterial color={night ? "#272d2f" : "#555a59"} roughness={0.94} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={groups.pathSurfaces} position={[0, -0.09, 0]} receiveShadow><meshStandardMaterial color={night ? "#465155" : "#b5b4aa"} roughness={0.95} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={groups.roadSurfaces} position={[0, -0.08, 0]} receiveShadow><meshStandardMaterial color={night ? "#252b2d" : "#555b5b"} roughness={0.92} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={groups.railBed} position={[0, -0.07, 0]} receiveShadow><meshStandardMaterial color="#3a3836" roughness={0.98} side={THREE.DoubleSide} /></mesh>
      <lineSegments geometry={groups.paths}><lineBasicMaterial color={night ? "#718087" : "#bcc3c0"} transparent opacity={0.58} /></lineSegments>
      <lineSegments geometry={groups.roads} position={[0, 0.04, 0]}><lineBasicMaterial color={night ? "#c2a46b" : "#7b7d79"} /></lineSegments>
      <lineSegments geometry={groups.rails} position={[0, 0.08, 0]}><lineBasicMaterial color="#353b3c" /></lineSegments>
      <lineSegments geometry={groups.water} position={[0, 0.02, 0]}><lineBasicMaterial color="#4aa7c5" /></lineSegments>
    </group>
  );
}

function getCourtFeatures(data: OpenDataSet): CourtFeature[] {
  const pitches = data.osmFeatures.filter(
    (feature) => feature.tags.leisure === "pitch" && feature.tags.sport?.split(";").includes("tennis") && feature.geometry,
  );
  return pitches.map((feature, index) => {
    const points = feature.geometry!.map((point) => osmPointToVector(point, data.origin));
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector2()).multiplyScalar(1 / points.length);
    let longest = { length: 0, angle: 0 };
    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
      const delta = points[pointIndex].clone().sub(points[pointIndex - 1]);
      if (delta.length() > longest.length) longest = { length: delta.length(), angle: Math.atan2(delta.y, delta.x) };
    }
    const axis = new THREE.Vector2(Math.cos(longest.angle), Math.sin(longest.angle));
    const normal = new THREE.Vector2(-axis.y, axis.x);
    const along = points.map((point) => point.clone().sub(center).dot(axis));
    const across = points.map((point) => point.clone().sub(center).dot(normal));
    const length = Math.max(...along) - Math.min(...along);
    const width = Math.max(...across) - Math.min(...across);
    return {
      id: feature.id,
      name: feature.tags.name?.replace(/^#/, "Court ") ?? `Practice court ${index + 1}`,
      source: feature,
      center,
      size: new THREE.Vector2(Math.max(length, width), Math.min(length, width)),
      angle: longest.angle,
    };
  });
}

function CourtMarkings({ court, night }: { court: CourtFeature; night: boolean }) {
  const actualLength = Math.min(23.77, court.size.x * 0.72);
  const actualWidth = Math.min(10.97, court.size.y * 0.72);
  const rotation = Math.PI / 2 - court.angle;
  const color = night ? "#ffffff" : "#effaff";
  return (
    <group position={[court.center.x, 0.3, court.center.y]} rotation={[0, rotation, 0]}>
      <mesh receiveShadow><boxGeometry args={[court.size.y, 0.16, court.size.x]} /><meshStandardMaterial color={COURT_SURROUND} roughness={0.72} /></mesh>
      <mesh position={[0, 0.11, 0]}><boxGeometry args={[actualWidth, 0.06, actualLength]} /><meshStandardMaterial color={COURT_BLUE} roughness={0.66} /></mesh>
      {[-actualWidth / 2, actualWidth / 2, -4.115, 4.115].map((x) => <mesh key={`x-${x}`} position={[x, 0.16, 0]}><boxGeometry args={[0.07, 0.025, actualLength]} /><meshBasicMaterial color={color} /></mesh>)}
      {[-actualLength / 2, actualLength / 2, -6.4, 0, 6.4].map((z) => <mesh key={`z-${z}`} position={[0, 0.16, z]}><boxGeometry args={[Math.abs(z) === actualLength / 2 ? actualWidth : 8.23, 0.025, 0.07]} /><meshBasicMaterial color={color} /></mesh>)}
      <mesh position={[0, 0.72, 0]}><boxGeometry args={[actualWidth + 0.8, 0.92, 0.05]} /><meshStandardMaterial color="#172125" transparent opacity={0.72} /></mesh>
      <mesh position={[0, 1.18, 0]}><boxGeometry args={[actualWidth + 0.85, 0.055, 0.07]} /><meshBasicMaterial color="#f8fbff" /></mesh>
    </group>
  );
}

function Courts({ courts, selected, night, onSelect }: { courts: CourtFeature[]; selected: CourtFeature | null; night: boolean; onSelect: (court: CourtFeature) => void }) {
  return (
    <group>
      {courts.map((court) => (
        <group
          key={court.id}
          onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(court); }}
          onPointerEnter={() => { document.body.style.cursor = "pointer"; }}
          onPointerLeave={() => { document.body.style.cursor = "default"; }}
        >
          <CourtMarkings court={court} night={night} />
          {selected?.id === court.id && <mesh position={[court.center.x, 0.24, court.center.y]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[court.size.x * 0.54, court.size.x * 0.57, 64]} /><meshBasicMaterial color="#ff6a2a" transparent opacity={0.95} /></mesh>}
          {selected?.id === court.id && <Html center position={[court.center.x, 8, court.center.y]} distanceFactor={260}><div className="whitespace-nowrap rounded-full border border-orange-300/60 bg-[#101619]/94 px-3 py-1.5 text-xs font-bold text-white shadow-2xl backdrop-blur">{court.name}</div></Html>}
        </group>
      ))}
    </group>
  );
}

const VENUE_MATERIAL: Record<string, { color: string; metalness: number; roughness: number; clearcoat: number }> = {
  "Rod Laver Arena": { color: "#cfd4d4", metalness: 0.76, roughness: 0.25, clearcoat: 0.8 },
  "Margaret Court Arena": { color: "#a6633f", metalness: 0.68, roughness: 0.3, clearcoat: 0.65 },
  "John Cain Arena": { color: "#d9dcda", metalness: 0.7, roughness: 0.26, clearcoat: 0.72 },
  "Centrepiece Melbourne": { color: "#6f9ea7", metalness: 0.22, roughness: 0.18, clearcoat: 1 },
};

function LandmarkRoofs({ data, showLabels }: { data: OpenDataSet; showLabels: boolean }) {
  const landmarks = useMemo(() => data.osmFeatures.filter((feature) => feature.geometry && VENUE_MATERIAL[feature.tags.name]), [data]);
  return (
    <group>
      {landmarks.map((feature) => {
        const rings = [feature.geometry!.map((point) => [point.lon, point.lat] as LonLat)];
        const shape = shapeFromRings(rings, data.origin);
        if (!shape) return null;
        const height = Number.parseFloat(feature.tags.height ?? "24") || 24;
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: true, bevelSize: 0.55, bevelThickness: 0.3, bevelSegments: 2 });
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(0, height - 0.4, 0);
        const material = VENUE_MATERIAL[feature.tags.name];
        const [x, z] = featureCenter(feature, data.origin);
        return (
          <group key={feature.id}>
            <mesh geometry={geometry} castShadow>
              <meshPhysicalMaterial {...material} envMapIntensity={1.35} />
            </mesh>
            {showLabels && <Html center position={[x, height + 7, z]} distanceFactor={390}>
              <div className="whitespace-nowrap rounded-md border border-white/15 bg-[#091217]/88 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/85 shadow-xl backdrop-blur">{feature.tags.name}</div>
            </Html>}
          </group>
        );
      })}
    </group>
  );
}

function RodLaverArchitecture({ data, night }: { data: OpenDataSet; night: boolean }) {
  const feature = data.osmFeatures.find((item) => item.tags.name === "Rod Laver Arena" && item.geometry);
  if (!feature) return null;
  const [x, z] = featureCenter(feature, data.origin);
  return (
    <group position={[x, 0, z]} rotation={[0, -0.035, 0]}>
      <mesh position={[0, 9.4, 0]} scale={[0.96, 1, 1.08]} castShadow>
        <cylinderGeometry args={[58.2, 60, 18, 72, 1, true]} />
        <meshPhysicalMaterial color={night ? "#123c52" : "#527985"} roughness={0.17} metalness={0.18} transmission={0.16} transparent opacity={0.92} clearcoat={0.92} />
      </mesh>
      <mesh position={[0, 24.1, 0]} scale={[0.97, 1, 1.09]} castShadow>
        <cylinderGeometry args={[58.8, 60.5, 12, 72, 1, true]} />
        <meshStandardMaterial color="#c9cecd" roughness={0.3} metalness={0.72} envMapIntensity={1.15} />
      </mesh>
      {[2.1, 9.5, 18.2].map((height, index) => <mesh key={height} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.96, 1.08, 1]} castShadow><torusGeometry args={[59.2, index === 2 ? 0.9 : 0.42, 8, 72]} /><meshStandardMaterial color={index === 1 ? "#354c56" : "#d8dcda"} metalness={0.7} roughness={0.3} /></mesh>)}
      <mesh position={[0, 29.8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.96, 1.08, 1]} castShadow><torusGeometry args={[59, 1.2, 10, 72]} /><meshStandardMaterial color="#d9dcda" metalness={0.8} roughness={0.24} /></mesh>
      <group position={[0, 31.15, 0]}>
        {[-45, -30, -15, 0, 15, 30, 45].map((rib) => <mesh key={`x-${rib}`} position={[rib, 0, 0]} castShadow><boxGeometry args={[0.38, 0.42, 114]} /><meshStandardMaterial color="#c8cecd" metalness={0.82} roughness={0.24} /></mesh>)}
        {[-45, -30, -15, 0, 15, 30, 45].map((rib) => <mesh key={`z-${rib}`} position={[0, 0.08, rib]} castShadow><boxGeometry args={[104, 0.3, 0.34]} /><meshStandardMaterial color="#e5e7e5" metalness={0.76} roughness={0.28} /></mesh>)}
      </group>
    </group>
  );
}

function PedestrianScaleProps({ night }: { night: boolean }) {
  return (
    <group position={[-185, 0, -145]} rotation={[0, -1.73, 0]}>
      {[-6, -3, 0, 3, 6].map((offset) => <mesh key={offset} position={[offset, 0.55, 2.5]} castShadow><cylinderGeometry args={[0.18, 0.24, 1.1, 10]} /><meshStandardMaterial color="#3d4547" metalness={0.72} roughness={0.35} /></mesh>)}
      <mesh position={[-7.2, 2.5, 10]} castShadow><boxGeometry args={[0.28, 5, 0.28]} /><meshStandardMaterial color="#313b3e" metalness={0.78} roughness={0.3} /></mesh>
      <mesh position={[7.2, 2.5, 10]} castShadow><boxGeometry args={[0.28, 5, 0.28]} /><meshStandardMaterial color="#313b3e" metalness={0.78} roughness={0.3} /></mesh>
      <mesh position={[0, 4.7, 10]} castShadow><boxGeometry args={[14.7, 0.7, 0.34]} /><meshStandardMaterial color="#24353b" metalness={0.52} roughness={0.38} /></mesh>
      <mesh position={[0, 4.72, 9.8]}><planeGeometry args={[7.6, 0.9]} /><meshStandardMaterial color="#0b79ae" emissive={night ? "#088dcc" : "#00334b"} emissiveIntensity={night ? 1.3 : 0.16} /></mesh>
      <Html center position={[0, 4.72, 9.6]} distanceFactor={18}><div className="whitespace-nowrap text-[9px] font-black uppercase tracking-[0.2em] text-white">Melbourne Park</div></Html>
      {[-16, 16].map((side) => <group key={side} position={[side, 0, 7]}><mesh position={[0, 0.45, 0]} castShadow><cylinderGeometry args={[1.65, 1.9, 0.9, 28]} /><meshStandardMaterial color="#8d8f87" roughness={0.85} /></mesh><mesh position={[0, 1.6, 0]} castShadow><icosahedronGeometry args={[1.4, 1]} /><meshStandardMaterial color="#3d7450" roughness={0.95} /></mesh></group>)}
    </group>
  );
}

function featureCenter(feature: OsmFeature, origin: OpenDataSet["origin"]): [number, number] {
  if (feature.center) {
    const point = osmPointToVector(feature.center, origin);
    return [point.x, point.y];
  }
  const points = feature.geometry?.map((point) => osmPointToVector(point, origin)) ?? [];
  if (!points.length) return [0, 0];
  const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector2()).multiplyScalar(1 / points.length);
  return [center.x, center.y];
}

function EventOverlay() {
  const zones = [
    { name: "Western Courts", position: [-355, 0.18, -240] as [number, number, number], size: [330, 175] as [number, number], color: "#2f8ec4" },
    { name: "Garden Square", position: [-205, 0.18, 170] as [number, number, number], size: [180, 145] as [number, number], color: "#ff7c38" },
    { name: "Grand Slam Oval", position: [30, 0.18, 285] as [number, number, number], size: [225, 150] as [number, number], color: "#80b74b" },
    { name: "Eastern Courts", position: [405, 0.18, 65] as [number, number, number], size: [310, 200] as [number, number], color: "#26a4d4" },
  ];
  return <group>{zones.map((zone) => <group key={zone.name} position={zone.position}><RoundedBox args={[zone.size[0], 0.12, zone.size[1]]} radius={16} smoothness={3}><meshStandardMaterial color={zone.color} transparent opacity={0.11} /></RoundedBox><Html center position={[0, 2, 0]} distanceFactor={620}><div className="whitespace-nowrap rounded bg-black/45 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/70">{zone.name}</div></Html></group>)}</group>;
}

function Reflections({ night }: { night: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = night ? 0.82 : 0.9;
  }, [gl, night]);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    return () => {
      scene.environment = null;
      environment.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function CameraRig({ preset, selected, disabled }: { preset: ViewPreset; selected: CourtFeature | null; disabled: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    if (disabled) return;
    if (selected) {
      camera.position.set(selected.center.x + 85, 105, selected.center.y + 125);
    } else {
      camera.position.set(...CAMERA_PRESETS[preset]);
    }
    camera.updateProjectionMatrix();
  }, [camera, disabled, preset, selected]);
  return null;
}

function WalkController({ active, onExit }: { active: boolean; onExit: () => void }) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const yaw = useRef(1.41);
  const pitch = useRef(-0.03);
  const dragging = useRef(false);

  useEffect(() => {
    if (!active) return;
    const pressedKeys = keys.current;
    yaw.current = 1.41;
    pitch.current = -0.03;
    camera.position.set(-180, 2.15, -145);
    camera.rotation.order = "YXZ";
    camera.rotation.set(pitch.current, yaw.current, 0);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 62;
      camera.updateProjectionMatrix();
    }
    const canvas = gl.domElement;
    canvas.style.cursor = "grab";
    const movementKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"]);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        onExit();
        return;
      }
      if (movementKeys.has(event.code)) event.preventDefault();
      pressedKeys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => pressedKeys.delete(event.code);
    const onPointerDown = () => { dragging.current = true; canvas.style.cursor = "grabbing"; };
    const onPointerUp = () => { dragging.current = false; canvas.style.cursor = "grab"; };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      yaw.current -= event.movementX * 0.0032;
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.0027, -1.15, 1.15);
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    return () => {
      pressedKeys.clear();
      dragging.current = false;
      canvas.style.cursor = "default";
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = 40;
        camera.updateProjectionMatrix();
      }
    };
  }, [active, camera, gl, onExit]);

  useFrame((_, delta) => {
    if (!active) return;
    camera.rotation.set(pitch.current, yaw.current, 0);
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const direction = new THREE.Vector3();
    if (keys.current.has("KeyW") || keys.current.has("ArrowUp")) direction.add(forward);
    if (keys.current.has("KeyS") || keys.current.has("ArrowDown")) direction.sub(forward);
    if (keys.current.has("KeyD") || keys.current.has("ArrowRight")) direction.add(right);
    if (keys.current.has("KeyA") || keys.current.has("ArrowLeft")) direction.sub(right);
    if (direction.lengthSq() > 0) {
      const sprinting = keys.current.has("ShiftLeft") || keys.current.has("ShiftRight");
      camera.position.addScaledVector(direction.normalize(), Math.min(delta, 0.05) * (sprinting ? 42 : 20));
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -820, 820);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -720, 720);
      camera.position.y = 2.15;
    }
  });
  return null;
}

function Scene({ data, courts, night, preset, selected, showEventOverlay, walkMode, onExitWalk, onSelect }: { data: OpenDataSet; courts: CourtFeature[]; night: boolean; preset: ViewPreset; selected: CourtFeature | null; showEventOverlay: boolean; walkMode: boolean; onExitWalk: () => void; onSelect: (court: CourtFeature) => void }) {
  return (
    <>
      <color attach="background" args={[night ? "#07121a" : "#76a7bb"]} />
      <fog attach="fog" args={[night ? "#07121a" : "#76a7bb", 850, 2200]} />
      {!night && <Sky distance={450000} sunPosition={[-120, 140, -80]} turbidity={4.5} rayleigh={0.58} mieCoefficient={0.006} mieDirectionalG={0.82} />}
      <Reflections night={night} />
      <hemisphereLight args={[night ? "#5b7891" : "#eaf7ff", night ? "#111d17" : "#293f31", night ? 0.95 : 1.08]} />
      <directionalLight position={[-420, 680, -360]} intensity={night ? 0.8 : 2.3} color={night ? "#aac5e5" : "#fff0d4"} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-850} shadow-camera-right={850} shadow-camera-top={850} shadow-camera-bottom={-850} />
      <mesh position={[0, -1.2, 0]} receiveShadow><boxGeometry args={[1900, 2, 1750]} /><meshStandardMaterial color={night ? "#16251e" : "#365b44"} roughness={0.96} /></mesh>
      <OpenDataNetwork data={data} night={night} />
      {showEventOverlay && <EventOverlay />}
      <OpenDataBuildings data={data} />
      <StreetDetails data={data} night={night} />
      <LandmarkRoofs data={data} showLabels={!walkMode} />
      <RodLaverArchitecture data={data} night={night} />
      <PedestrianScaleProps night={night} />
      <Courts courts={courts} selected={selected} night={night} onSelect={onSelect} />
      <CameraRig preset={preset} selected={selected} disabled={walkMode} />
      <WalkController active={walkMode} onExit={onExitWalk} />
      <OrbitControls makeDefault enabled={!walkMode} target={selected ? [selected.center.x, 0, selected.center.y] : [0, 0, 0]} enableDamping dampingFactor={0.075} minDistance={25} maxDistance={1650} minPolarAngle={0.16} maxPolarAngle={1.48} />
    </>
  );
}

function LoadingScreen({ error }: { error: string | null }) {
  return <div className="absolute inset-0 z-20 grid place-items-center bg-[#071218]"><div className="max-w-sm px-6 text-center"><div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#ff6a2a]" /><p className="text-sm font-semibold text-white">Building the geographic scene</p><p className="mt-2 text-xs leading-relaxed text-white/45">Loading survey-aligned footprints, measured heights and court geometry…</p>{error && <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}</div></div>;
}

export default function MelbourneParkOpenDataExperience() {
  const [data, setData] = useState<OpenDataSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CourtFeature | null>(null);
  const [night, setNight] = useState(false);
  const [showEventOverlay, setShowEventOverlay] = useState(false);
  const [preset, setPreset] = useState<ViewPreset>("precinct");
  const [walkMode, setWalkMode] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Open-data package failed to load (${response.status})`);
        return response.json();
      })
      .then((payload: OpenDataSet) => { if (active) setData(payload); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load venue data"); });
    return () => { active = false; };
  }, []);

  const courts = useMemo(() => data ? getCourtFeatures(data) : [], [data]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071218]">
      {!data && <LoadingScreen error={error} />}
      {data && <div className="absolute inset-0"><Canvas shadows camera={{ position: CAMERA_PRESETS[preset], fov: 40, near: 0.5, far: 4000 }} dpr={[1, 1.6]} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = night ? 0.82 : 0.9; }}><Suspense fallback={null}><Scene data={data} courts={courts} night={night} preset={preset} selected={selected} showEventOverlay={showEventOverlay} walkMode={walkMode} onExitWalk={() => setWalkMode(false)} onSelect={setSelected} /></Suspense></Canvas></div>}

      {walkMode && <div className="pointer-events-none absolute inset-0 z-[5]"><div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-black/25 shadow" /><div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-xl border border-white/15 bg-[#091217]/82 px-4 py-2 text-center text-[10px] uppercase tracking-[0.14em] text-white/65 shadow-xl backdrop-blur"><span className="font-bold text-white">WASD</span> walk · <span className="font-bold text-white">drag</span> look · <span className="font-bold text-white">Shift</span> sprint · <span className="font-bold text-white">Esc</span> exit</div></div>}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 sm:p-5">
        <div className="pointer-events-auto mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[#091217]/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3"><Link href="/" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/60 transition hover:text-white">Tennis-Agent</Link><div><h1 className="text-sm font-bold text-white sm:text-base">Melbourne Park · Open Digital Twin</h1><p className="text-[10px] uppercase tracking-[0.15em] text-emerald-200/65">Self-hosted geometry · no Google map dependency</p></div></div>
          <div className="flex flex-wrap items-center gap-2">
            {!walkMode && <div className="hidden items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1 text-[11px] md:flex">{(["precinct", "river", "western", "eastern"] as ViewPreset[]).map((view) => <button key={view} onClick={() => { setPreset(view); setSelected(null); }} className={`rounded-lg px-2.5 py-1.5 capitalize transition ${preset === view && !selected ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}>{view}</button>)}</div>}
            {!walkMode && <button onClick={() => setShowEventOverlay((value) => !value)} className={`rounded-lg border px-3 py-2 text-xs transition ${showEventOverlay ? "border-sky-300/40 bg-sky-400/10 text-sky-100" : "border-white/10 bg-black/20 text-white/55"}`}>AO draft zones</button>}
            <button onClick={() => setNight((value) => !value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70 transition hover:border-white/30 hover:text-white">{night ? "◐ Night" : "☀ Day"}</button>
            <button onClick={() => { setWalkMode((value) => !value); setSelected(null); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${walkMode ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : "bg-white text-[#112026] hover:bg-emerald-100"}`}>{walkMode ? "Exit ground mode" : "Enter precinct"}</button>
            <Link href="/board" className="rounded-lg bg-[#ff5a1f] px-3 py-2 text-xs font-semibold text-white">Open tactics →</Link>
          </div>
        </div>
      </header>

      {!walkMode && <section className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 sm:p-5">
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-3">
          <div className="pointer-events-auto max-w-md rounded-2xl border border-white/15 bg-[#091217]/92 p-4 shadow-2xl backdrop-blur-xl">
            {selected ? <><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff8b5e]">Georeferenced competition court</p><div className="mt-1 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-white">{selected.name}</h2><button onClick={() => setSelected(null)} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/45 hover:text-white">×</button></div><p className="mt-2 text-xs leading-relaxed text-white/55">Position and orientation come from the local open-data package. Regulation lines are generated by our own Three.js renderer.</p></> : <><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/75">Accuracy foundation installed</p><p className="mt-1 text-sm font-semibold text-white">Real coordinates, footprints and measured heights</p><p className="mt-2 text-xs leading-relaxed text-white/48">Buildings are based on the City of Melbourne 2020 survey. Courts, paths and rail alignment are bundled from OpenStreetMap. AO zones are an annual planning overlay and remain visibly separate.</p></>}
          </div>
          <div className="pointer-events-auto rounded-2xl border border-white/15 bg-[#091217]/92 px-4 py-3 text-right shadow-xl backdrop-blur-xl"><div className="text-2xl font-black text-white">{courts.length || "—"}</div><div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Mapped tennis surfaces</div><p className="mt-1 text-[10px] text-white/35">Drag · Zoom · Select a court</p></div>
        </div>
        <div className="pointer-events-auto mx-auto mt-2 flex max-w-7xl justify-end text-[9px] text-white/35"><a className="hover:text-white/70" href="https://data.melbourne.vic.gov.au/explore/dataset/2020-building-footprints/information/" target="_blank" rel="noreferrer">City of Melbourne Open Data · CC BY 4.0</a><span className="px-2">·</span><a className="hover:text-white/70" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a></div>
      </section>}
    </main>
  );
}
