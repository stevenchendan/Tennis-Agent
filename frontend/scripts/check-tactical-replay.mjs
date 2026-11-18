import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {root,load} from "./load-tennis-source.mjs";
import * as THREE from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";

const lib=name=>load(path.join(root,"src/lib",name));
const {compileReplay,sampleReplay,shotSwingPath,BALL_RADIUS}=lib("tennis-motion/tactical-replay");
const {encodeTactic,decodeTactic,defaultTactic}=lib("tactic");
const {recordedContact}=lib("drills/recorded-motion");
const {TEMPLATES}=lib("templates");
const {playingStyles,styleTactic}=lib("playing-styles");
const {createAthlete}=lib("tennis-motion/athlete");
// Node samples the geometry and does not upload embedded textures to a GPU.
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
async function readModel(name) {
  const b=fs.readFileSync(path.join(root,"public/models/tennis",name));
  return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),"")).scene;
}
const equipment=await readModel("match-racket.glb");
const rig=createAthlete(await readModel("match-athlete.glb"),equipment,"#22d3ee");
const geometryTip=new THREE.Box3().setFromObject(equipment,true).max.y;
const grip=lib("tennis-motion/racket-grip.json");
assert.ok(Math.abs(geometryTip-grip.tipFromCenter)<.0001,"Trace the deployed bumper");
assert.ok(new THREE.Box3().setFromObject(equipment.getObjectByName("Handle_pallet"),true)
  .containsPoint(new THREE.Vector3(0,-grip.centerFromPalm,0)),"Socket must lie inside the real overgrip");
assert.ok(rig.racket.children.length > 0,"Test the exported string bed and frame");
const arena=new THREE.Group();arena.position.set(20,3,-15);arena.rotation.y=.67;arena.add(rig.group);
const custom=defaultTactic();
custom.frames[0].paths=[{from:{x:5.4,y:2},to:{x:2,y:16},stroke:"serve"},{from:{x:4.7,y:21.8},to:{x:8,y:6},stroke:"backhand"}];
custom.frames.push({players:custom.frames[0].players,paths:[]},{players:[{id:3,x:3,y:.3}],paths:[{from:{x:9,y:18},to:{x:9,y:18}}]});
assert.equal(decodeTactic(encodeTactic(custom)).frames[0].paths[1].stroke,"backhand");
const clipData=lib("drills/recorded-motion.json");
let tracePoints=0;
const items=[defaultTactic(),custom,...TEMPLATES.map(t=>t.build()),...playingStyles.map(styleTactic)];
let contacts=0,bounces=0,samples=0,largestError=0;
for (const item of items) {
  const replay=compileReplay(decodeTactic(encodeTactic(item)));
  const original=JSON.stringify(item);
  assert.equal(replay.starts.length,item.frames.length);
  for(const [i,start] of replay.starts.entries()) assert.equal(sampleReplay(replay,start).frameIndex,i);
  for(const shot of replay.shots) {
    if(shot.id!==undefined) {
      const trace=shotSwingPath(replay,shot);
      assert.ok(trace.before.length && trace.after.length);
      const pose=sampleReplay(replay,shot.hit).players.find(p=>p.id===shot.id).pose;
      rig.pose(pose);
      const tip=arena.worldToLocal(rig.racket.localToWorld(new THREE.Vector3(0,geometryTip,0)));
      assert.ok(tip.distanceTo(new THREE.Vector3(...trace.before.at(-1)))<.001,"Trace reaches the actual bumper at impact");
      assert.deepEqual(trace.before.at(-1),trace.after[0]);
      const trail=[...trace.before,...trace.after.slice(1)];
      const clip=clipData[shot.kind];
      let point=0;
      for(let i=0;i<clip.trail.points.length;i++) {
        const relative=clip.trail.start+i*clip.trail.dt,seconds=shot.hit+relative;
        if(seconds<0 || seconds>replay.duration) continue;
        const actor=sampleReplay(replay,seconds).players.find(p=>p.id===shot.id);
        if(!actor || actor.pose.stroke!==shot.kind || Math.abs(actor.pose.relativeTime-relative)>.0001) continue;
        rig.pose(actor.pose);
        const bumper=arena.worldToLocal(rig.racket.localToWorld(new THREE.Vector3(0,geometryTip,0)));
        assert.ok(bumper.distanceTo(new THREE.Vector3(...trail[point++]))<.001,shot.kind+": guide leaves the rendered hoop");
      }
      assert.equal(point,trail.length);
      tracePoints+=point;
    }
    const hit=sampleReplay(replay,shot.hit);
    assert.ok(hit.ball, "A shot has a ball at impact");
    if (shot.id!==undefined) {
      const player=hit.players.find(p=>p.id===shot.id);
      assert.ok(player,"Hitter present at contact");
      rig.pose(player.pose);
      const actual=arena.worldToLocal(rig.racket.getWorldPosition(new THREE.Vector3()));
      const error=actual.distanceTo(new THREE.Vector3(hit.ball.x,hit.ball.z,hit.ball.y));
      largestError=Math.max(largestError,error);
      assert.ok(error<.001,item.title+" "+shot.kind+" racket misses by "+error);
      assert.ok(Math.abs(hit.ball.z-recordedContact(shot.kind)[1])<1e-6);
      contacts++;
    }
    if(!shot.intercept) {
      const bounce=sampleReplay(replay,shot.bounce).ball;
      assert.ok(Math.abs(bounce.z-BALL_RADIUS)<.00001);
      assert.ok(Math.hypot(bounce.x-shot.landing.x,bounce.y-shot.landing.y)<.00001);
      bounces++;
    }
    if(shot.connected) {
      const before=sampleReplay(replay,shot.hit-.0001).ball;
      assert.ok(before && Math.hypot(before.x-hit.ball.x,before.y-hit.ball.y,before.z-hit.ball.z)<.02);
    }
  }
  for(let t=0;t<=replay.duration;t+=.025) {
    const f=sampleReplay(replay,t);
    for(const p of f.players) for(const v of Object.values(p.pose)) if(typeof v==="number")assert.ok(Number.isFinite(v));
    if(f.ball) assert.ok(Number.isFinite(f.ball.x+f.ball.y+f.ball.z) && f.ball.z>=BALL_RADIUS-.001);
    samples++;
  }
  assert.deepEqual(sampleReplay(replay,replay.duration/2),sampleReplay(replay,replay.duration/2));
  assert.equal(JSON.stringify(item),original);
}
// Sample the rendered mount through shot entry, impact, follow-through and
// the return to ready. A separately animated prop used to drift in blends.
const wrist=rig.group.getObjectByName("RightHand");
const optical=JSON.parse(fs.readFileSync(path.join(root,"public/models/tennis/mocap/racket-markers.json")));
const neutral={x:2,z:-3,yaw:.94,vx:0,vz:0,distance:0,split:0};
const supportHand=rig.group.getObjectByName("LeftHand");
let maxSupportGap=0;
const heading=arena.getWorldQuaternion(new THREE.Quaternion())
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),neutral.yaw));
for(const [stroke,clip] of Object.entries(clipData)) {
  const reference=optical[stroke==="overhead"?"serve":stroke];
  for(let t=-clip.contact-.2;t<.8;t+=.009) {
    rig.pose({...neutral,stroke,relativeTime:t});
    const palm=wrist.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...grip.palm)
      .applyQuaternion(wrist.getWorldQuaternion(new THREE.Quaternion()).normalize()));
    const inHand=rig.racket.localToWorld(new THREE.Vector3(0,-grip.centerFromPalm,0));
    assert.ok(inHand.distanceTo(palm)<.0001,stroke+": grip leaves palm during blend");
    if(stroke==="backhand" && t>=-.38 && t<=.32) {
      const support=supportHand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...grip.palm)
        .applyQuaternion(supportHand.getWorldQuaternion(new THREE.Quaternion()).normalize()));
      const upperGrip=rig.racket.localToWorld(new THREE.Vector3(0,-grip.supportFromCenter,0));
      maxSupportGap=Math.max(maxSupportGap,support.distanceTo(upperGrip));
    }
  }
  // Compare actual model orientation with the independent optical samples,
  // including the racket drop and extension on either side of the contact.
  for(const t of [-.10,-.06,-.02,0,.02,.06,.08]) {
    const u=reference.contact+t*reference.hz;
    if(u<.055*reference.hz || u>reference.rotations.length-1-.055*reference.hz) continue;
    const i=Math.floor(u);
    const expected=heading.clone().multiply(new THREE.Quaternion(...reference.rotations[i])
      .slerp(new THREE.Quaternion(...reference.rotations[i+1]),u-i)).normalize();
    rig.pose({...neutral,stroke,relativeTime:t});
    const actual=rig.racket.getWorldQuaternion(new THREE.Quaternion()).normalize();
    assert.ok(actual.angleTo(expected)<.001,stroke+" measured rim orientation changed");
  }
}
function localTip(stroke,t) {
  rig.pose({...neutral,stroke,relativeTime:t});
  return rig.group.worldToLocal(rig.racket.localToWorld(new THREE.Vector3(0,geometryTip,0)));
}
const drop=localTip("serve",-.12),contact=localTip("serve",0);
assert.ok(contact.y-drop.y>1.25 && drop.z>contact.z+.35,"Serve must drop behind the body before reaching up and forward");
const drive=localTip("forehand",0),finish=localTip("forehand",.16);
assert.ok(finish.x<drive.x-.75 && finish.y>drive.y+.35,"Forehand must rise and finish across the body");
assert.ok(maxSupportGap<.018,`Two-hand grip gap during interpolation: ${maxSupportGap} m`);
console.log(`Checked ${tracePoints} rendered bumper positions and six grip transitions. Two-handed backhand maximum interpolated palm error ${(1000*maxSupportGap).toFixed(1)} mm.`);
rig.dispose();
console.log(`Verified ${items.length} replays, ${contacts} actual racket contacts, ${bounces} landings and ${samples} samples. Maximum contact error ${(largestError*1000).toFixed(3)} mm.`);
