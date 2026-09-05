import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface ContextData {
  buildings: { id: string; name?: string; ring: number[][]; height: number; base: number; roof: string }[];
  features: { id: string; name: string; kind: string; width: number; points: number[][] }[];
}

// All dimensions are metres. Court geometry is regulation sized; architecture
// is a visual reconstruction, not a surveyed or as-built model.
const palette = { concrete: '#b4b4ac', edge: '#d4d1c5', steel: '#727d7b', dark: '#183b46', blue: '#147daa', outer: '#3593b5', seat: '#779da6', white: '#f2f0dc', copper: '#a87050' };
class Builder {
  group = new T.Group();
  batches = new Map<string, T.BufferGeometry[]>();
  add(geometry: T.BufferGeometry, color: string) {
    const list = this.batches.get(color) || [];
    list.push(geometry); this.batches.set(color, list);
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, rotation = 0) {
    const g = new T.BoxGeometry(w,h,d); g.rotateY(rotation); g.translate(x,y,z); this.add(g,color);
  }
  rod(a: number[], b: number[], radius = .04, color = palette.steel) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
    const g = new T.CylinderGeometry(radius,radius,delta.length(),6);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray()); this.add(g,color);
  }
  finish() {
    this.batches.forEach((geometries,color) => {
      const merged = mergeGeometries(geometries);
      if (merged) { const mesh = new T.Mesh(merged,new T.MeshStandardMaterial({color,roughness:.83})); mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh); }
      geometries.forEach(g=>g.dispose());
    });
    this.batches.clear(); return this.group;
  }
}

function roundedPath(w: number, d: number, r: number) {
  const p = new T.Shape();
  p.moveTo(-w+r,-d); p.lineTo(w-r,-d); p.absarc(w-r,-d+r,r,-Math.PI/2,0,false);
  p.lineTo(w,d-r); p.absarc(w-r,d-r,r,0,Math.PI/2,false);
  p.lineTo(-w+r,d); p.absarc(-w+r,d-r,r,Math.PI/2,Math.PI,false);
  p.lineTo(-w,-d+r); p.absarc(-w+r,-d+r,r,Math.PI,Math.PI*1.5,false);
  return p;
}
function ring(b: Builder, inner: number, outer: number, bottom: number, height: number, color: string) {
  const s = roundedPath(10.8+outer,19.5+outer,2.8+outer);
  const hole = roundedPath(10.8+inner,19.5+inner,2.8+inner);
  s.holes.push(new T.Path(hole.getPoints(12).reverse()));
  const g = new T.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:10});
  g.rotateX(-Math.PI/2); g.translate(0,bottom,0); b.add(g,color);
}
function label(text: string, w: number, h: number, color = '#eff5ed', background = '#163945') {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background; ctx.fillRect(0,0,1024,128);
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 65px Arial';ctx.fillText(text,512,69);
  const texture = new T.CanvasTexture(canvas);texture.colorSpace = T.SRGBColorSpace;texture.anisotropy=8;
  return new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:texture,roughness:.8,side:T.DoubleSide}));
}
function court(b: Builder, x=0,z=0,rotation=0, detailed=true) {
  const cb = new Builder();
  cb.box(0,.035,0,21.2,.12,38.3,palette.outer);
  cb.box(0,.105,0,10.97,.02,23.77,palette.blue);
  const line=(x:number,z:number,w:number,d:number)=>cb.box(x,.122,z,w,.015,d,palette.white);
  [-5.485,-4.115,4.115,5.485].forEach(x=>line(x,0,.05,23.77));
  [-11.885,11.885].forEach(z=>{line(0,z,10.97,.065);line(0,z-Math.sign(z)*.15,.05,.3);});
  [-6.4,6.4].forEach(z=>line(0,z,8.23,.05)); line(0,0,.05,12.8);
  [-6.4,6.4].forEach(x=>cb.rod([x,.1,0],[x,1.22,0],.055,palette.dark));
  // Fine net lattice with a visibly lower centre strap.
  for(let i=0;i<=80;i++) { const x=-6.4+i*.16; const y=.914+.156*Math.pow(Math.abs(x)/6.4,2); cb.rod([x,.18,0],[x,y,0],.009,'#293a3b'); }
  for(let i=0;i<9;i++) cb.rod([-6.4,.2+i*.085,0],[6.4,.2+i*.085,0],.008,'#293a3b');
  for(let i=0;i<32;i++){ const x=-6.4+i*.4; const y=(n:number)=>.914+.156*Math.pow(Math.abs(n)/6.4,2);cb.rod([x,y(x),0],[x+.4,y(x+.4),0],.023,palette.white); }
  cb.box(0,.55,.016,.045,.89,.025,palette.white);
  const g=cb.finish();g.position.set(x,0,z);g.rotation.y=rotation;
  if(detailed){
    [-1,1].forEach(s=>{
      const text=label('M E L B O U R N E',6.7,.8,palette.white,palette.outer);text.rotation.x=-Math.PI/2;text.rotation.z=s<0?0:Math.PI;text.position.set(0,.105,s*16);g.add(text);
    });
  }
  b.group.add(g);
}

export function buildArena() {
  const b = new Builder();
  court(b);
  const seats: {x:number;y:number;z:number;angle:number}[]=[];
  for(let row=0;row<12;row++) {
    const offset = row*.79;
    ring(b,offset,offset+.79,.1,.5+row*.43,palette.concrete);
    ring(b,offset,offset+.055,.61+row*.43,.025,palette.edge);
    const path=roundedPath(11.2+offset,19.9+offset,3.2+offset);
    const length=path.getLength(), count=Math.floor(length/.52);
    for(let i=0;i<count;i++){
      const t=i/count, p=path.getPointAt(t), tangent=path.getTangentAt(t);
      // Twelve radial aisles retained through every seating tier.
      if ((t*12)%1 < .105 || (t*12)%1 > .94) continue;
      seats.push({x:p.x,y:.87+row*.43,z:-p.y,angle:Math.atan2(tangent.y,tangent.x)});
    }
  }
  ring(b,9.48,10.9,.1,5.24,palette.concrete);
  ring(b,10.7,10.94,5.34,.75,palette.edge);
  // A continuous front advertising wall, with open corners at the entries.
  [-1,1].forEach(s=>{
    b.box(s*10.55,.62,0,.16,1.04,29,palette.dark);
    b.box(0,.62,s*19.1,14.9,1.04,.16,palette.dark);
    const name=label('1573 ARENA',7.4,.75); name.position.set(0,.72,s*18.995); if(s>0)name.rotation.y=Math.PI;b.group.add(name);
    for(let z=-10;z<=10;z+=10){ const ad=label(z===0?'MELBOURNE':'AO   /   1573',6,.68);ad.position.set(s*10.45,.72,z);ad.rotation.y=-s*Math.PI/2;b.group.add(ad); }
  });
  // Radial stair handrails and guardrails around the outer concourse.
  for(let section=0;section<12;section++) {
    const t=(section+.015)/12;
    const lo=roundedPath(11.05,19.75,3.05).getPointAt(t), hi=roundedPath(20.65,29.35,12.65).getPointAt(t);
    b.rod([lo.x,1.6,-lo.y],[hi.x,6.5,-hi.y],.043);
    for(let j=0;j<=4;j++){const k=j/4;b.rod([T.MathUtils.lerp(lo.x,hi.x,k),.65+k*4.9,-T.MathUtils.lerp(lo.y,hi.y,k)],[T.MathUtils.lerp(lo.x,hi.x,k),1.6+k*4.9,-T.MathUtils.lerp(lo.y,hi.y,k)],.035);}
  }
  const rail=roundedPath(21.55,30.25,13.55).getPoints(60);
  rail.forEach((p,i)=>{if(i) b.rod([rail[i-1].x,6.8,-rail[i-1].y],[p.x,6.8,-p.y],.04);if(i%3===0)b.rod([p.x,6,-p.y],[p.x,6.8,-p.y],.035);});
  // Lightweight shade hoods at the back of the stands.
  for(const s of [-1,1])for(const z of [-19,-9,3,15]){
    b.box(s*20,6.8,z,3.3,.16,5.3,'#ece9dd');
    for(const end of [-2.3,2.3]) b.rod([s*21.15,5.35,z+end],[s*21.15,6.75,z+end],.065);
  }
  for(const s of [-1,1])for(const x of [-6,3])b.box(x,6.8,s*29.4,6.5,.18,3,'#ece9dd');
  // Six floodlight masts with cross bracing and individually modelled luminaires.
  const lamps = new T.Group();
  for(const x of [-22.7,22.7])for(const z of [-23,0,23]) {
    b.rod([x,.1,z],[x,19.5,z],.14,'#737d7e');
    b.rod([x-1.7,19.2,z],[x+1.7,19.2,z],.09);
    b.rod([x,17.7,z],[x+1.65,19.2,z],.06);b.rod([x,17.7,z],[x-1.65,19.2,z],.06);
    for(let i=0;i<4;i++){
      b.box(x-1.35+i*.9,19.2,z,.63,.36,.5,'#384449');
      const light = new T.Mesh(new T.BoxGeometry(.52,.07,.42),new T.MeshStandardMaterial({color:'#fff4cf',emissive:'#ffe4a5',emissiveIntensity:.1}));light.position.set(x-1.35+i*.9,18.98,z);lamps.add(light);
    }
  }
  b.group.add(lamps);
  // Umpire chair and access ladder, player benches, umbrellas, bins, camera.
  for(const z of [-.55,.55]){
    b.rod([8.8,.1,z],[9.1,2.25,z],.035);b.rod([9.8,.1,z],[9.45,2.25,z],.035);
  }
  b.box(9.24,2.2,0,.72,.14,1.25,palette.dark);b.box(9.57,2.65,0,.13,.8,1.25,palette.dark);
  for(let y=.35;y<2.1;y+=.3)b.rod([9.7,y,-.5],[9.7,y,.5],.035);
  for(const z of [-7,7]){
    b.box(8.4,.52,z,.72,.14,2.7,palette.white);b.box(8.75,.9,z,.1,.65,2.7,palette.white);
    [-1,1].forEach(s=>b.box(8.4,.28,z+s,.45,.5,.15,palette.steel));
    b.rod([9.2,.1,z],[9.2,3.3,z],.045,palette.white);
    const umbrella=new T.ConeGeometry(1.9,.58,8);umbrella.translate(9.2,3.25,z);b.add(umbrella,'#ecdfc2');
    b.box(9.2,.45,z+2, .65,.7,.65,palette.dark);
  }
  const scoreboard = label('1573     •     MELBOURNE PARK',10.5,1.4,'#c8f586','#122d37');scoreboard.position.set(0,7.7,-29.7);b.group.add(scoreboard);
  b.box(0,7.7,-29.86,10.8,1.65,.3,palette.dark);
  b.rod([-4,5.3,-29.8],[-4,8.5,-29.8],.09);b.rod([4,5.3,-29.8],[4,8.5,-29.8],.09);

  // One shared geometry and one draw call for thousands of individual seats.
  const base=new T.BoxGeometry(.43,.115,.43);base.translate(0,0,0);
  const back=new T.BoxGeometry(.43,.43,.095);back.rotateX(-.12);back.translate(0,.22,.21);
  const seatGeometry=mergeGeometries([base,back])!;base.dispose();back.dispose();
  const seatMesh=new T.InstancedMesh(seatGeometry,new T.MeshStandardMaterial({color:palette.seat,roughness:.66}),seats.length);
  const dummy=new T.Object3D();
  seats.forEach((s,i)=>{dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(0,s.angle,0);dummy.updateMatrix();seatMesh.setMatrixAt(i,dummy.matrix);seatMesh.setColorAt(i,new T.Color(i%17===0?'#c5c7b6':i%7===0?'#a8bfc0':palette.seat));});
  seatMesh.castShadow=true;seatMesh.receiveShadow=true;b.group.add(seatMesh);
  const crowd=new T.Group();
  const bodies=new T.InstancedMesh(new T.CapsuleGeometry(.15,.3,3,5),new T.MeshStandardMaterial({roughness:.9}),Math.floor(seats.length/7));
  const heads=new T.InstancedMesh(new T.SphereGeometry(.125,6,5),new T.MeshStandardMaterial({color:'#c79c78'}),bodies.count);
  const shirts=['#e4dcc4','#40586e','#ece9e1','#4d7385','#cc6c4c','#677052'];
  for(let i=0;i<bodies.count;i++) { const s=seats[i*7];dummy.position.set(s.x,s.y+.36,s.z);dummy.rotation.set(0,s.angle,0);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);bodies.setColorAt(i,new T.Color(shirts[i%shirts.length]));dummy.position.y+=.39;dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);}
  crowd.add(bodies,heads);crowd.visible=false;b.group.add(crowd);
  return {group:b.finish(),lamps,crowd,seats:seats.length};
}

export function buildContext(data: ContextData) {
  const b=new Builder();
  b.box(37,-1.65,0,280,3,310,'#b9bbaa');
  b.box(2,-.11,1,62,.1,83,'#c7c5b6');
  // Paving joints around the arena make the pedestrian scale legible.
  for(let x=-30;x<=30;x+=3) b.box(x,-.045,0,.018,.02,80,'#a8ab9d');
  for(let z=-39;z<=39;z+=3)b.box(0,-.045,z,60,.02,.018,'#a8ab9d');
  for(const f of data.features){
    if(f.kind==='path'){
      for(let i=1;i<f.points.length;i++){
        const a=f.points[i-1], c=f.points[i], dx=c[0]-a[0],dz=c[1]-a[1];
        if(Math.abs((a[0]+c[0])/2)<24&&Math.abs((a[1]+c[1])/2)<33)continue;
        b.box((a[0]+c[0])/2,-.018,(a[1]+c[1])/2,Math.max(2,f.width),.035,Math.hypot(dx,dz),'#d7d4c5',Math.atan2(dx,dz));
      }
    }
    if(f.kind==='court'&&f.id!=='way/126844352'){
      const ps=f.points.slice(0,4),x=ps.reduce((s,p)=>s+p[0],0)/4,z=ps.reduce((s,p)=>s+p[1],0)/4;
      if(Math.abs(x)>155||Math.abs(z)>148)continue;
      // Indoor courts are occluded by the actual surrounding building tiers.
      court(b,x,z,0,false);
      for(const s of [-1,1]){
        b.rod([x+s*10.5,0,z-19],[x+s*10.5,3,z-19],.055);b.rod([x+s*10.5,0,z+19],[x+s*10.5,3,z+19],.055);
        b.rod([x+s*10.5,3,z-19],[x+s*10.5,3,z+19],.04);
      }
    }
  }
  data.buildings.forEach(building=>{
    const shape=new T.Shape(building.ring.map(p=>new T.Vector2(p[0],-p[1])));
    const g=new T.ExtrudeGeometry(shape,{depth:building.height,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,building.base,0);
    const cx=building.ring.reduce((s,p)=>s+p[0],0)/building.ring.length;
    const cz=building.ring.reduce((s,p)=>s+p[1],0)/building.ring.length;
    const copper=building.name==='Margaret Court Arena'||cx>22&&cx<103&&Math.abs(cz)<72;
    b.add(g,copper?palette.copper:'#aab0aa');
    // Roof outlines retain the surveyed footprint beneath the stylised surfaces.
    building.ring.forEach((p,i)=>{if(i)b.rod([building.ring[i-1][0],building.base+building.height+.03,building.ring[i-1][1]],[p[0],building.base+building.height+.03,p[1]],.09,copper?'#dac0a1':'#d3d4c8');});
  });
  // Clip each roof fold to the OSM footprint, so the copper roof's sawtooth
  // silhouette follows the irregular building without floating geometry.
  const mca=data.buildings.find(building=>building.name==='Margaret Court Arena');
  if(mca){
    const clip=(polygon:number[][],boundary:number,keepAbove:boolean)=>{
      const result:number[][]=[];
      for(let i=0;i<polygon.length;i++){
        const a=polygon[i],c=polygon[(i+1)%polygon.length];
        const inside=(p:number[])=>keepAbove?p[1]>=boundary:p[1]<=boundary;
        if(inside(a))result.push(a);
        if(inside(a)!==inside(c)){const t=(boundary-a[1])/(c[1]-a[1]);result.push([a[0]+(c[0]-a[0])*t,boundary]);}
      }return result;
    };
    for(let z=-52;z<116;z+=5.5){
      for(let half=0;half<2;half++){
        const low=z+half*2.75, high=low+2.75;
        const polygon=clip(clip(mca.ring.slice(0,-1),low,true),high,false);
        if(polygon.length<3)continue;
        const shape=new T.Shape(polygon.map(p=>new T.Vector2(p[0],-p[1])));
        const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);
        const pos=g.getAttribute('position');
        for(let i=0;i<pos.count;i++){
          const fraction=T.MathUtils.clamp((pos.getZ(i)-low)/2.75,0,1);
          pos.setY(i,15.12+(half===0?fraction:1-fraction)*1.65);
        }g.computeVertexNormals();
        const roof=new T.Mesh(g,new T.MeshStandardMaterial({color:half===0?'#a56c4b':'#ba8964',roughness:.76,side:T.DoubleSide}));roof.castShadow=true;roof.receiveShadow=true;b.group.add(roof);
        polygon.forEach((p,i)=>{const c=polygon[(i+1)%polygon.length];if(Math.abs(p[1]-high)<.01&&Math.abs(c[1]-high)<.01)b.rod([p[0],15.2+(half===0?1.65:0),p[1]],[c[0],15.2+(half===0?1.65:0),c[1]],.07,'#d8bb9b');});
      }
    }
    // Glazed foyer strip and repeated copper facade fins.
    b.box(25.41,5.3,0,.12,7.6,37,'#4e6669');
    for(let z=-18;z<19;z+=2.4)b.box(25.1,5.3,z,.42,8,.15,'#c59c78');
  }
  // Service pavilions, entry furniture and planting are interpretive details.
  for(let z=-18;z<=18;z+=12){
    b.box(-28,1.7,z,4,3.4,7,'#66756f');b.box(-28,3.5,z,4.5,.18,7.5,'#dedacb');
    b.box(-25.95,1.65,z,.04,1.4,4,'#324a4d');
  }
  for(let x=-16;x<19;x+=5){
    b.box(x,.42,37,2.8,.14,.65,'#807c63');b.box(x-1,.2,37,.14,.5,.55,palette.steel);b.box(x+1,.2,37,.14,.5,.55,palette.steel);
  }
  for(const x of [-23,23])for(const z of [-34,34]){
    b.box(x,1.8,z,.35,3.6,.45,palette.dark);
    const sign=label('1573  →',2.8,.65,'#e5f0c9');sign.position.set(x,3.35,z+.26);b.group.add(sign);
  }
  const trees: number[][]=[];
  for(let i=0;i<27;i++)trees.push([-37-Math.sin(i*.75)*5, -140+i*11]);
  for(let i=0;i<16;i++)trees.push([-81+i*13,-146+Math.sin(i)*4]);
  for(let i=0;i<14;i++)trees.push([-65+i*15,135+Math.sin(i)*6]);
  const leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#687b4d',roughness:1,flatShading:true}),trees.length*4);
  const o=new T.Object3D();
  trees.forEach(([x,z],i)=>{
    const height=5+(Math.sin(i*7)+1)*1.6;b.rod([x,0,z],[x,height,z],.28,'#83745b');
    b.box(x,.15,z,4,.3,4,'#999f7f');
    for(let j=0;j<4;j++){
      o.position.set(x+Math.sin(j*2.1)*1.7,height+j*.64,z+Math.cos(j*2.1)*1.5);o.scale.set(2.8,2.7,2.6);o.rotation.set(i,j,i*.3);o.updateMatrix();leaves.setMatrixAt(i*4+j,o.matrix);leaves.setColorAt(i*4+j,new T.Color(['#728455','#849365','#586e48','#9caa79'][i%4]));
    }
  });leaves.castShadow=true;leaves.receiveShadow=true;b.group.add(leaves);
  return b.finish();
}

export function disposeModel(group: T.Group) {
  group.traverse(obj=>{
    if(obj instanceof T.Mesh){obj.geometry.dispose();const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(m=>{if('map' in m && m.map instanceof T.Texture)m.map.dispose();m.dispose();});}
  });
}
