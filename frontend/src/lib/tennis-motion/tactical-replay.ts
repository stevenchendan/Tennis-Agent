import type {BallPath, PlayerPos, Point, Tactic} from "../tactic";
import {LEN, NET} from "../court";
import {recordedContact, recordedSample} from "../drills/recorded-motion";
import type {MotionClipKey} from "./index";
import type {AthletePose} from "./athlete";

export const BALL_RADIUS = .0335;
const G = 9.81;
const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x, a.y-b.y);
const clamp = (v: number, lo=0, hi=1) => Math.min(hi,Math.max(lo,v));
const smooth = (v: number) => v*v*(3-2*v);
type Ball = Point & {z: number};
type Anchor = Point & {time: number; distance: number};
type Shot = {
  frame: number; id?: number; kind: MotionClipKey; yaw: number; root: Point;
  contact: Ball; landing: Ball; hit: number; bounce: number; end: number;
  rebound: Ball; connected: boolean; intercept: boolean;
};
type Replay = ReturnType<typeof compileReplay>;
const interpolate = (a: number,b: number,t: number) => a+(b-a)*t;
function offset(local: number[], yaw: number) {
  return {x: local[0]*Math.cos(yaw)+local[2]*Math.sin(yaw), y: -local[0]*Math.sin(yaw)+local[2]*Math.cos(yaw), z: local[1]};
}
function flight(a: Ball,b: Ball,seconds: number,t: number): Ball {
  return {x: interpolate(a.x,b.x,t), y: interpolate(a.y,b.y,t), z: interpolate(a.z,b.z,t)+.5*G*seconds*seconds*t*(1-t)};
}

function describe(tactic: Tactic, index: number, path: BallPath, first: boolean): Shot {
  const frame = tactic.frames[index];
  const nearest = frame.players.reduce((a,b) => distance(a,path.from)<=distance(b,path.from) ? a:b);
  // Independent arrows (e.g. a landing zone drawn without a player) still play.
  const id = distance(nearest,path.from) <= 3.5 ? nearest.id : undefined;
  const near = path.from.y < NET;
  const backhand = (path.from.x-nearest.x)*(near?-1:1) < -.18;
  const heading = Math.atan2(path.from.x-path.to.x,path.from.y-path.to.y);
  const annotatedServe = tactic.strategy?.category === "serve" || /发球|\bserv(e|er|ice)\b/i.test(frame.note ?? tactic.title);
  const service = first && annotatedServe && Math.min(path.from.y,LEN-path.from.y)<3.5 && (near ? path.to.y>NET : path.to.y<NET);
  const volley = Math.abs(path.from.y-NET)<3.3;
  const kind = path.stroke ?? (service ? "serve" : volley ? backhand ? "backhand-volley":"volley" : backhand ? "backhand":"forehand");
  const yaw = distance(path.from,path.to)>.05 ? heading : near ? Math.PI : 0;
  const grip = offset(recordedContact(kind),yaw);
  const root = {x:path.from.x-grip.x, y:path.from.y-grip.y};
  if (kind==="serve") root.y = near ? -.62 : LEN+.62;
  const contact = {x:root.x+grip.x,y:root.y+grip.y,z:grip.z};
  const landing = {...path.to,z:BALL_RADIUS};
  return {frame:index,id,kind,yaw,root,contact,landing,hit:0,bounce:0,end:0,rebound:landing,connected:false,intercept:false};
}

function flightTime(shot: Shot, peak?: number) {
  const {contact:a, landing:b} = shot;
  const distanceTime = distance(a,b)/(shot.kind==="serve"?31:22);
  const netFraction = (NET-a.y)/(b.y-a.y);
  let clearanceTime = 0;
  if (netFraction>0 && netFraction<1) {
    const x = interpolate(a.x,b.x,netFraction);
    const tape = .914+.156*((x-5.485)/6.399)**2;
    const lift = Math.max(0,tape+.24-interpolate(a.z,b.z,netFraction));
    clearanceTime = Math.sqrt(2*lift/(G*netFraction*(1-netFraction)));
  }
  // An arrow ending on the net is an authored target. Avoid a multi-second
  // vertical launch for a landing point a few millimetres past the tape.
  const loftTime=peak ? Math.sqrt(2*Math.max(0,peak-a.z)/G)+Math.sqrt(2*Math.max(0,peak-b.z)/G) : 0;
  return clamp(Math.max(distanceTime,clearanceTime,loftTime),.34,1.8);
}

function planRebound(shot: Shot, next: Shot | undefined) {
  const air = shot.bounce-shot.hit, a=shot.contact, b=shot.landing;
  const reboundSpeed = (.5*G*air + (a.z-b.z)/air)*.77;
  const canLink = next && next.frame<=shot.frame+1 && next.kind!=="serve" && next.id!==shot.id &&
    distance(next.contact,b)<4.3 && (next.contact.y-NET)*(a.y-NET)<0;
  if (canLink && (next.kind==="volley" || next.kind==="backhand-volley" || next.kind==="overhead")) {
    // Intercept on the incoming trajectory before the intended landing zone.
    const descending = Math.max(0, (.5*G*air-(a.z-b.z)/air)/G);
    const disc = (descending*G)**2 + 2*G*(a.z-next.contact.z);
    if (disc>=0) {
      const time = descending+Math.sqrt(disc)/G;
      const point = flight(a,b,air,clamp(time/air));
      if (time<air && time>.12 && distance(point,next.contact)<3) {
        next.root.x+=point.x-next.contact.x; next.root.y+=point.y-next.contact.y;
        next.contact={...point,z:next.contact.z}; next.connected=true;
        shot.end=shot.hit+time; shot.intercept=true;
        return;
      }
    }
  }
  let duration = Math.min(.62,2*reboundSpeed/G);
  let vertical = reboundSpeed;
  if (canLink && next.kind!=="volley" && next.kind!=="backhand-volley" && next.kind!=="overhead") {
    // Fit the rebound to the receiver's strike height. Diagram distances and
    // the contact heights are fixed, so restitution is an authored parameter.
    vertical = Math.max(reboundSpeed,Math.sqrt(2*G*(next.contact.z-b.z))+.12);
    duration = (vertical-Math.sqrt(Math.max(0,vertical**2-2*G*(next.contact.z-b.z))))/G;
    // Friction slows horizontal travel. Preserve the incoming direction at
    // the bounce and position the receiver at the resulting string-bed point.
    const forward=Math.min(duration*.72/air,4/Math.max(1,distance(a,b)));
    const x=b.x+(b.x-a.x)*forward, y=b.y+(b.y-a.y)*forward;
    next.root.x+=x-next.contact.x; next.root.y+=y-next.contact.y;
    next.contact={x,y,z:next.contact.z};
    shot.rebound = next.contact;
    next.connected=true;
  } else {
    const retain = duration*.72/air;
    shot.rebound = {x:b.x+(b.x-a.x)*retain,y:b.y+(b.y-a.y)*retain,z:b.z+Math.max(0,vertical*duration-.5*G*duration**2)};
  }
  shot.end=shot.bounce+duration;
}

export function compileReplay(tactic: Tactic, peaks?: readonly number[]) {
  const shots = tactic.frames.flatMap((frame,i)=>frame.paths.map((path,j)=>describe(tactic,i,path,i===0&&j===0)));
  const starts: number[] = [];
  let clock=0, index=0;
  for (const [i,frame] of tactic.frames.entries()) {
    starts.push(clock);
    if (!frame.paths.length) { clock+=1.5; continue; }
    for (let j=0;j<frame.paths.length;j++,index++) {
      const shot=shots[index];
      shot.hit=shot.connected ? shots[index-1].end : clock+(shot.kind==="serve"?1.3:.68);
      shot.bounce=shot.hit+flightTime(shot,peaks?.[i]);
      planRebound(shot,shots[index+1]);
      const linked=shots[index+1]?.connected;
      // Hand over the chapter while the receiver is preparing to hit.
      clock=linked ? shot.end-Math.min(.28,(shot.end-shot.hit)*.3) : shot.end+.18;
    }
  }
  const duration=clock+.32;
  const tracks = new Map<number,Anchor[]>();
  for (const [i,frame] of tactic.frames.entries()) {
    for (const player of frame.players) {
      const track = tracks.get(player.id) ?? [];
      track.push({...player,time:starts[i],distance:0});
      tracks.set(player.id,track);
    }
  }
  for (const [id, track] of tracks) {
    const contacts=shots.filter(s=>s.id===id);
    // Keep drawn recovery positions where there is time to reach them. During
    // a stroke the capture supplies the weight shift and the court root plants.
    const authored=track.filter(key=>contacts.every(s=>Math.abs(key.time-s.hit) > Math.max(.55,distance(key,s.root)/3.4) && !(s.kind==="serve" && key.time>=s.hit-1.31 && key.time<s.hit)));
    for (const s of contacts) {
      authored.push({...s.root,time:Math.max(0,s.hit-(s.kind==="serve"?1.3:.12)),distance:0},{...s.root,time:s.hit+.09,distance:0});
    }
    authored.sort((a,b)=>a.time-b.time);
    let travelled=0;
    for(let j=1;j<authored.length;j++) {travelled+=distance(authored[j-1],authored[j]); authored[j].distance=travelled;}
    tracks.set(id,authored);
  }
  return {tactic,shots,starts,duration,tracks};
}

function location(track: Anchor[], t: number) {
  const i=track.findIndex(p=>p.time>t);
  const b=track[i<0?track.length-1:i], a=track[i<=0?(i<0?track.length-1:0):i-1];
  const span=b.time-a.time;
  const u=span>0?clamp((t-a.time)/span):0, v=smooth(u), rate=span>0?6*u*(1-u)/span:0;
  return {x:interpolate(a.x,b.x,v),z:interpolate(a.y,b.y,v),distance:interpolate(a.distance,b.distance,v),vx:(b.x-a.x)*rate,vz:(b.y-a.y)*rate};
}

function toss(s: Shot, t: number): Ball | null {
  const relative=t-s.hit;
  if(relative < -1.26) return null;
  const release=-.86;
  const sample=recordedSample("serve",Math.min(release,relative));
  const hand=sample.a.j[6].map((n,i)=>interpolate(n,sample.b.j[6][i],sample.alpha));
  const palm=offset(hand,s.yaw);
  const from={x:s.root.x+palm.x,y:s.root.y+palm.y,z:palm.z+.035};
  return relative<release ? from : flight(from,s.contact,-release,clamp((relative-release)/-release));
}

export function sampleReplay(replay: Replay, seconds: number) {
  const t=clamp(seconds,0,replay.duration);
  const nextFrame=replay.starts.findIndex(start=>start>t);
  const frameIndex=nextFrame<0?replay.starts.length-1:Math.max(0,nextFrame-1);
  const shot=replay.shots.find(s=>t>=s.hit-(!s.connected?(s.kind==="serve"?1.3:.68):0) && t<s.end);
  let ball: Ball | null=null;
  if(shot) {
    if(t<shot.hit) { if(shot.kind==="serve") ball=toss(shot,t); }
    else if(t<=shot.bounce) ball=flight(shot.contact,shot.landing,shot.bounce-shot.hit,(t-shot.hit)/(shot.bounce-shot.hit));
    else ball=flight(shot.landing,shot.rebound,shot.end-shot.bounce,(t-shot.bounce)/(shot.end-shot.bounce));
  }
  const players = replay.tactic.frames[frameIndex].players.map((player): PlayerPos & {pose:AthletePose} => {
    const motion=location(replay.tracks.get(player.id)!,t);
    let own: Shot | undefined, opponent: Shot | undefined;
    for (const s of replay.shots) {
      if (s.id===player.id) {
        if (!own || Math.abs(t-s.hit)<Math.abs(t-own.hit)) own=s;
      } else if (!opponent || Math.abs(t-s.hit)<Math.abs(t-opponent.hit)) opponent=s;
    }
    const base=motion.z<NET?Math.PI:0;
    const relativeTime=own?t-own.hit:5;
    const orient=own?smooth(clamp(1-(Math.abs(relativeTime)-(own.kind==="serve"?1.3:.68))/.42)):0;
    const yaw=own?base+orient*Math.atan2(Math.sin(own.yaw-base),Math.cos(own.yaw-base)):base;
    const split=opponent?Math.max(0,1-Math.abs(t-opponent.hit+.04)/.18):0;
    return {id:player.id,x:motion.x,y:motion.z,pose:{...motion,yaw,stroke:own?.kind??"forehand",relativeTime,split}};
  });
  return {time:t,frameIndex,players,ball,shot};
}
export type ReplayFrame = ReturnType<typeof sampleReplay>;
