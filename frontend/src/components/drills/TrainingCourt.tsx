"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

function surfaceTexture() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const pixels = ctx.createImageData(256, 256);
  let seed = 781;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const value = 180 + seed % 65;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(12, 24); texture.anisotropy = 8;
  return texture;
}

function Net() {
  const resources = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#101a21"; ctx.lineWidth = 4; ctx.strokeRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(110, 9);
    const positions: number[] = [], uv: number[] = [], indices: number[] = [], band: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const x = -.914 + (10.97 + 1.828) * i / 64;
      const h = .914 + .156 * ((x - 5.485) / 6.399) ** 2;
      positions.push(x, .05, 11.885, x, h, 11.885); uv.push(i / 64, 0, i / 64, 1); band.push(new THREE.Vector3(x, h, 11.885));
      if (i < 64) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const tape = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band), 64, .023, 6, false);
    return { texture, geometry, tape };
  }, []);
  useEffect(() => () => { resources.texture.dispose(); resources.geometry.dispose(); resources.tape.dispose(); }, [resources]);
  return <group>
    <mesh geometry={resources.geometry} receiveShadow><meshStandardMaterial map={resources.texture} transparent alphaTest={.2} side={THREE.DoubleSide} roughness={.9} /></mesh>
    <mesh geometry={resources.tape} castShadow><meshStandardMaterial color="#faf6e9" roughness={.8} /></mesh>
    <mesh position={[5.485, .47, 11.9]}><boxGeometry args={[.05, .94, .035]} /><meshStandardMaterial color="#f0eadc" /></mesh>
    {[-.914, 11.884].map(x => <group key={x} position={[x, 0, 11.885]}><mesh castShadow position={[0, .535, 0]}><cylinderGeometry args={[.065, .075, 1.07, 16]} /><meshStandardMaterial color="#244039" metalness={.5} roughness={.4} /></mesh><mesh position={[0, 1.085, 0]}><sphereGeometry args={[.072, 12, 8]} /><meshStandardMaterial color="#d5d9c8" /></mesh></group>)}
  </group>;
}

function Fence({ position, length, rotate = false }: { position: [number, number, number]; length: number; rotate?: boolean }) {
  const wire = useMemo(() => {
    const values: number[] = [];
    for (let x = -length / 2; x <= length / 2; x += .16) values.push(x, 2.2, 0, x, 3.2, 0);
    for (let y = 2.2; y <= 3.2; y += .16) values.push(-length / 2, y, 0, length / 2, y, 0);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(values, 3)); return g;
  }, [length]);
  useEffect(() => () => wire.dispose(), [wire]);
  return <group position={position} rotation={[0, rotate ? Math.PI / 2 : 0, 0]}>
    <mesh position={[0, 1.12, 0]} receiveShadow><boxGeometry args={[length, 2.2, .025]} /><meshStandardMaterial color="#203f38" roughness={1} /></mesh>
    <lineSegments geometry={wire}><lineBasicMaterial color="#7d9386" transparent opacity={.4} /></lineSegments>
    {Array.from({ length: Math.ceil(length / 2.8) + 1 }, (_, i) => <mesh key={i} position={[-length / 2 + Math.min(i * 2.8, length), 1.6, 0]} castShadow><cylinderGeometry args={[.045, .045, 3.2, 8]} /><meshStandardMaterial color="#71867e" metalness={.7} roughness={.5} /></mesh>)}
  </group>;
}

function Bench({ x, y }: { x: number; y: number }) {
  return <group position={[x, 0, y]}>
    {[0, .12, .24].map(z => <mesh key={z} position={[0, .44, z]} castShadow><boxGeometry args={[1.8, .055, .1]} /><meshStandardMaterial color="#bfae86" /></mesh>)}
    {[-.7, .7].map(x => <mesh key={x} position={[x, .22, .12]} castShadow><boxGeometry args={[.045, .44, .3]} /><meshStandardMaterial color="#dedbd0" metalness={.5} /></mesh>)}
    <mesh position={[0, .75, .28]} castShadow><boxGeometry args={[1.8, .22, .04]} /><meshStandardMaterial color="#bfae86" /></mesh>
  </group>;
}

export default function TrainingCourt() {
  const texture = useMemo(surfaceTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const stripes = [[5.485, 0, 10.97, .1], [5.485, 23.77, 10.97, .1], [0, 11.885, .05, 23.77], [10.97, 11.885, .05, 23.77], [1.37, 11.885, .05, 23.77], [9.6, 11.885, .05, 23.77], [5.485, 5.485, 8.23, .05], [5.485, 18.285, 8.23, .05], [5.485, 11.885, .05, 12.8], [5.485, .12, .05, .24], [5.485, 23.65, .05, .24]];
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.485, -.08, 11.885]} receiveShadow><planeGeometry args={[160, 160]} /><meshStandardMaterial color="#5d7560" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.485, -.02, 11.5]} receiveShadow><planeGeometry args={[20.2, 35.5]} /><meshStandardMaterial color="#3d7670" map={texture} roughness={.95} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.485, -.005, 11.885]} receiveShadow><planeGeometry args={[10.97, 23.77]} /><meshStandardMaterial color="#3679a4" map={texture} roughness={.9} /></mesh>
    {stripes.map(([x, y, width, length], i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, .007, y]} receiveShadow><planeGeometry args={[width, length]} /><meshStandardMaterial color="#f4f2dd" roughness={1} /></mesh>)}
    <Net />
    <Fence position={[5.485, 0, -5.55]} length={20} /><Fence position={[5.485, 0, 28.55]} length={20} />
    <Fence position={[-4.5, 0, 11.5]} length={34.1} rotate /><Fence position={[15.47, 0, 11.5]} length={34.1} rotate />
    <Bench x={-3.5} y={8.7} /><Bench x={14.2} y={14.5} />
    <group position={[4.1, 0, 26.8]}>{[-.22, .22].map(x => <mesh key={x} position={[x, .46, 0]} castShadow><boxGeometry args={[.025, .92, .025]} /><meshStandardMaterial color="#dce0d4" metalness={.7} /></mesh>)}<mesh position={[0, .95, 0]} castShadow><boxGeometry args={[.6, .24, .4]} /><meshStandardMaterial color="#26392e" /></mesh>{Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-.2 + (i % 4) * .13, 1.08, -.12 + Math.floor(i / 4) * .12]}><sphereGeometry args={[.034, 8, 6]} /><meshStandardMaterial color="#d9ef3f" /></mesh>)}</group>
    {[[-3.3, 6], [-3.3, 19], [14.4, 6], [14.4, 19]].map(([x, y], i) => <group key={i} position={[x, 0, y]}><mesh castShadow position={[0, 3.9, 0]}><cylinderGeometry args={[.07, .1, 7.8, 8]} /><meshStandardMaterial color="#bac7bc" metalness={.65} roughness={.55} /></mesh><mesh position={[0, 7.8, 0]} rotation={[.3, 0, 0]}><boxGeometry args={[.65, .15, .35]} /><meshStandardMaterial color="#e3e5d4" /></mesh></group>)}
  </group>;
}
