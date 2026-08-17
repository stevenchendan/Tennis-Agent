"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import {
  BALL_COLOR,
  LEN,
  PAD,
  PLAYER_COLORS,
  SINGLES,
  SVC_FAR,
  SVC_NEAR,
  W,
  resolveCourtTheme,
} from "@/lib/court";
import type { BallPath, PlayerPos } from "@/lib/tactic";

export interface Ball3D {
  /** court coordinates, meters */
  x: number;
  y: number;
  /** synthesized arc height above the ground, meters */
  z: number;
}

// court (x, y) → centered world coords; the near player ends up at -z,
// matching a broadcast camera placed behind them.
const tx = (x: number) => x - W / 2;
const tz = (y: number) => y - LEN / 2;

const LINE_Y = 0.02;
const LINE_W = 0.06;

/** White lines as thin raised boxes: [sizeX, sizeZ, posX, posZ]. */
function lineBoxes(): [number, number, number, number][] {
  const cx3 = 0;
  const halfW = W / 2;
  const singlesL = -(halfW - SINGLES);
  const singlesR = halfW - SINGLES;
  const svcNearZ = tz(SVC_NEAR);
  const svcFarZ = tz(SVC_FAR);
  return [
    // sidelines + doubles lines (run along z)
    [LINE_W, LEN, -halfW, 0],
    [LINE_W, LEN, halfW, 0],
    [LINE_W, LEN, singlesL, 0],
    [LINE_W, LEN, singlesR, 0],
    // baselines (run along x)
    [W, LINE_W, cx3, -LEN / 2],
    [W, LINE_W, cx3, LEN / 2],
    // service lines + center service line
    [W - 2 * SINGLES, LINE_W, cx3, svcNearZ],
    [W - 2 * SINGLES, LINE_W, cx3, svcFarZ],
    [LINE_W, SVC_FAR - SVC_NEAR, cx3, (svcNearZ + svcFarZ) / 2],
  ];
}

function Net({ bandColor }: { bandColor: string }) {
  const netW = W + 0.9;
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 + 0.45), 0.53, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1.06, 12]} />
          <meshStandardMaterial color="#1a1a22" />
        </mesh>
      ))}
      {/* net body */}
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[netW, 0.92, 0.02]} />
        <meshStandardMaterial color="#101319" transparent opacity={0.55} />
      </mesh>
      {/* white band + center strap */}
      <mesh position={[0, 0.945, 0]}>
        <boxGeometry args={[netW, 0.07, 0.03]} />
        <meshStandardMaterial color={bandColor} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[0.07, 0.92, 0.035]} />
        <meshStandardMaterial color={bandColor} />
      </mesh>
    </group>
  );
}

function PlayerMarker({ player }: { player: PlayerPos }) {
  const color = PLAYER_COLORS[player.id] ?? "#e7efe9";
  return (
    <group position={[tx(player.x), 0, tz(player.y)]}>
      {/* soft contact shadow */}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <capsuleGeometry args={[0.32, 0.6, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <Html center distanceFactor={16} position={[0, 1.55, 0]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(10,15,13,0.85)",
            color,
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {`P${player.id}`}
        </div>
      </Html>
    </group>
  );
}

/**
 * Read-only 3D playback court (editor stays 2D top-down on purpose).
 * Receives the same interpolated state the SVG court gets; the ball flies
 * along a synthesized arc whose height scales with shot distance.
 */
export default function TacticCourt3D({
  theme,
  players,
  paths,
  ball,
  height = 560,
}: {
  theme?: string;
  players: PlayerPos[];
  paths: BallPath[];
  ball: Ball3D | null;
  height?: number;
}) {
  const t = resolveCourtTheme(theme);
  const lines = lineBoxes();

  return (
    <div style={{ height }} className="w-full">
      <Canvas camera={{ position: [0, 13, 15], fov: 40 }} dpr={[1, 2]}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[6, 14, 8]} intensity={1.3} />

        {/* run-off + surface */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.008, 0]}>
          <planeGeometry args={[W + 2 * PAD + 4, LEN + 2 * PAD + 6]} />
          <meshStandardMaterial color={t.outer} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W, LEN]} />
          <meshStandardMaterial color={t.inner} />
        </mesh>

        {/* lines */}
        {lines.map(([sx, sz, px, pz], i) => (
          <mesh key={i} position={[px, LINE_Y, pz]}>
            <boxGeometry args={[sx, 0.015, sz]} />
            <meshStandardMaterial color={t.line} />
          </mesh>
        ))}

        <Net bandColor={t.net} />

        {/* current frame shot paths: dashed line + landing ring */}
        {paths.map((p, i) => (
          <group key={i}>
            <Line
              points={[
                [tx(p.from.x), 0.07, tz(p.from.y)],
                [tx(p.to.x), 0.07, tz(p.to.y)],
              ]}
              color={BALL_COLOR}
              lineWidth={2}
              dashed
              dashSize={0.4}
              gapSize={0.28}
              transparent
              opacity={0.8}
            />
            <mesh position={[tx(p.to.x), 0.04, tz(p.to.y)]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.16, 0.27, 32]} />
              <meshBasicMaterial color={BALL_COLOR} transparent opacity={0.85} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}

        {players.map((p) => (
          <PlayerMarker key={p.id} player={p} />
        ))}

        {ball && (
          <mesh position={[tx(ball.x), Math.max(ball.z, 0.16), tz(ball.y)]}>
            <sphereGeometry args={[0.14, 24, 24]} />
            <meshStandardMaterial color={BALL_COLOR} emissive={BALL_COLOR} emissiveIntensity={0.35} />
          </mesh>
        )}

        <OrbitControls
          enablePan={false}
          minDistance={9}
          maxDistance={36}
          minPolarAngle={0.12}
          maxPolarAngle={1.32}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
