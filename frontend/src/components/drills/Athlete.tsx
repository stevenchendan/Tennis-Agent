"use client";
import {useEffect, useMemo} from "react";
import {useFrame} from "@react-three/fiber";
import {useGLTF} from "@react-three/drei";
import {createAthlete, type AthletePose} from "@/lib/tennis-motion/athlete";

export default function Athlete({color, pose}: {color: string; pose: AthletePose}) {
  const {scene} = useGLTF("/models/tennis/tennis-athlete.glb");
  const {scene: equipment} = useGLTF("/models/tennis/club-player.glb?v=2");
  const rig = useMemo(() => createAthlete(scene, equipment, color), [scene, equipment, color]);
  useEffect(() => () => rig.dispose(), [rig]);
  useFrame(() => rig.pose(pose));
  return <primitive object={rig.group} dispose={null}/>;
}
