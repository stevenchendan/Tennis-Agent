import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
import ts from "typescript";
import * as THREE from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";

const root=fileURLToPath(new URL("../",import.meta.url)), require=createRequire(import.meta.url);
const modules=new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  if (file.endsWith(".json")) return JSON.parse(fs.readFileSync(file,"utf8"));
  const module={exports:{}};
  const source=fs.readFileSync(file+".ts","utf8");
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInThisContext("(function(module,exports,require){"+js+"\n})",{filename:file})(module,module.exports,id=>{
    if(id.startsWith("@/")) return load(path.join(root,"src",id.slice(2)));
    if(id.startsWith(".")) return load(path.resolve(path.dirname(file),id));
    return id==="three" ? THREE : require(id);
  });
  modules.set(file,module.exports);
  return module.exports;
}
const lib=name=>load(path.join(root,"src/lib",name));
const {compileReplay,sampleReplay,BALL_RADIUS}=lib("tennis-motion/tactical-replay");
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
const rig=createAthlete(await readModel("match-athlete.glb"),await readModel("match-racket.glb"),"#22d3ee");
assert.ok(rig.racket.children.length > 0,"Test the exported string bed and frame");
const arena=new THREE.Group();arena.position.set(20,3,-15);arena.rotation.y=.67;arena.add(rig.group);
const custom=defaultTactic();
custom.frames[0].paths=[{from:{x:5.4,y:2},to:{x:2,y:16},stroke:"serve"},{from:{x:4.7,y:21.8},to:{x:8,y:6},stroke:"backhand"}];
custom.frames.push({players:custom.frames[0].players,paths:[]},{players:[{id:3,x:3,y:.3}],paths:[{from:{x:9,y:18},to:{x:9,y:18}}]});
assert.equal(decodeTactic(encodeTactic(custom)).frames[0].paths[1].stroke,"backhand");
const items=[defaultTactic(),custom,...TEMPLATES.map(t=>t.build()),...playingStyles.map(styleTactic)];
let contacts=0,bounces=0,samples=0,largestError=0;
for (const item of items) {
  const replay=compileReplay(decodeTactic(encodeTactic(item)));
  const original=JSON.stringify(item);
  assert.equal(replay.starts.length,item.frames.length);
  for(const [i,start] of replay.starts.entries()) assert.equal(sampleReplay(replay,start).frameIndex,i);
  for(const shot of replay.shots) {
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
rig.dispose();
console.log(`Verified ${items.length} replays, ${contacts} actual racket contacts, ${bounces} landings and ${samples} samples. Maximum contact error ${(largestError*1000).toFixed(3)} mm.`);
