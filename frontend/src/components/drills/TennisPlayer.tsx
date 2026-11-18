"use client";
import { Html } from "@react-three/drei";
import type { Actor, Frame, Stroke } from "@/lib/drills/motion";
import { movementLabel, techniqueForStroke } from "@/lib/tennis-motion";
import Athlete from "./Athlete";

export default function TennisPlayer({actor,frame,labels}:{actor:Actor;frame:Frame;labels:boolean}) {
  let stroke: Stroke | undefined, opponent: Stroke | undefined;
  for (const hit of frame.strokes) {
    if (hit.id === actor.id) {
      if (!stroke || Math.abs(frame.localTime-hit.time)<Math.abs(frame.localTime-stroke.time)) stroke=hit;
    } else if (hit.kind==="forehand" && (!opponent || Math.abs(frame.localTime-hit.time)<Math.abs(frame.localTime-opponent.time))) opponent=hit;
  }
  const side=actor.id==="1"?1:-1;
  const action=actor.technique?`${techniqueForStroke(actor.technique).label} · ${movementLabel(actor.movement)}`:movementLabel(actor.movement);
  const pose={
    x:actor.x,z:actor.y,yaw:actor.y<11.885?Math.PI:0,vx:actor.vx,vz:actor.vy,distance:actor.travel,
    stroke:stroke?.kind??"volley",relativeTime:stroke?frame.localTime-stroke.time:5,
    split:side===1 && opponent ? Math.max(0,1-Math.abs(frame.localTime-opponent.time)/.24):0,
  } as const;
  return <><Athlete color={actor.color} pose={pose}/>{labels && <Html position={[actor.x+side*.62,2.38,actor.y]} center distanceFactor={8} zIndexRange={[10,0]} style={{pointerEvents:"none"}}>
    <span className={side>0?"playerLabel playerLabelRight":"playerLabel playerLabelLeft"} style={{borderColor:actor.color}}>P{actor.id}<small>{action.toUpperCase()}</small></span>
  </Html>}</>;
}
