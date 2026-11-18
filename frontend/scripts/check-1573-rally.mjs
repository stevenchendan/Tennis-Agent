import assert from "node:assert/strict";
import path from "node:path";
import {load,root} from "./load-tennis-source.mjs";
const {rallyFrame,rallyShots,RALLY_DURATION}=load(path.join(root,"src/components/arena1573/rallyMotion"));
const {recordedContact}=load(path.join(root,"src/lib/drills/recorded-motion"));
const gap=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
for(let t=0;t<RALLY_DURATION;t+=.002) {
  const f=rallyFrame(t),next=rallyFrame(t+.002);
  assert.ok(f.ball.every(Number.isFinite) && f.ball[1]>=.03349);
  if(Math.abs(f.ball[2])<.05)assert.ok(f.ball[1]>1.10,"Clear the net tape");
  assert.ok(gap(f.ball,next.ball)<.10,"Continuous ball including loop");
  for(const [i,p] of f.players.entries()){
    const q=next.players[i];
    assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<.025,"No jumps between recoveries");
    assert.ok(Math.abs(p.z)>10 && Math.abs(p.z)<15 && Math.abs(p.x)<6);
  }
}
for(const [i,shot] of rallyShots.entries()){
  const f=rallyFrame(shot.start),p=f.players[i%2],[x,y,z]=recordedContact(p.stroke);
  const actual=[p.x+x*Math.cos(p.yaw)+z*Math.sin(p.yaw),y,p.z-x*Math.sin(p.yaw)+z*Math.cos(p.yaw)];
  assert.ok(gap(f.ball,actual)<1e-6,"Contact on the captured string bed");
  assert.ok(Math.hypot(p.vx,p.vz)<1e-4,"Hitter planted at contact");
  const t=shot.start+shot.air,b=rallyFrame(t).ball,before=rallyFrame(t-.001).ball,after=rallyFrame(t+.001).ball;
  assert.ok(Math.abs(b[1]-.0335)<1e-8 && Math.abs(b[2])<11.885);
  const restitution=(after[1]-b[1])/(before[1]-b[1]);
  assert.ok(Math.abs(restitution-.79)<.002);
  assert.ok(Math.abs((after[2]-b[2])/(b[2]-before[2])-.73)<.001);
  assert.ok(gap(rallyFrame(t-RALLY_DURATION).ball,b)<1e-8);
}
assert.equal(new Set(rallyShots.map(s=>s.kind)).size,2);
console.log("Arena passed: eight captured forehand/backhand contacts, eight in-court bounces, restitution, net clearance and seamless repeat.");
