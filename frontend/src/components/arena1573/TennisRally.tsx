'use client';
import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as T from 'three';
import {rallyFrame} from './rallyMotion';

function player(shirt:string,cap:boolean){
  const group=new T.Group();
  const skin=new T.MeshStandardMaterial({color:'#c99472',roughness:.85});
  const cloth=new T.MeshStandardMaterial({color:shirt,roughness:.9});
  const white=new T.MeshStandardMaterial({color:'#efeee1',roughness:.8});
  const dark=new T.MeshStandardMaterial({color:'#303b3c',roughness:.75});
  function mesh(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;}
  const torso=mesh(new T.CapsuleGeometry(.23,.38,4,10),cloth,0,1.28,0);torso.scale.z=.65;
  mesh(new T.BoxGeometry(.45,.27,.29),white,0,.93,0);
  mesh(new T.SphereGeometry(.145,12,10),skin,0,1.76,-.035);
  if(cap){const hat=mesh(new T.SphereGeometry(.153,12,8,0,Math.PI*2,0,Math.PI/2),white,0,1.80,-.035);hat.scale.y=.55;mesh(new T.BoxGeometry(.27,.026,.18),white,0,1.82,-.18);}
  else {const hair=mesh(new T.SphereGeometry(.15,10,8,0,Math.PI*2,0,Math.PI/2),dark,0,1.81,0);hair.scale.y=.6;}
  const limbs=Array.from({length:8},(_,i)=>mesh(new T.CylinderGeometry(i<4?.065:.052,i<4?.08:.065,1,8),skin));
  const shoes=[-1,1].map(x=>mesh(new T.BoxGeometry(.15,.12,.30),white,x*.2,.19,-.04));
  const racket=new T.Group();group.add(racket);
  const rm=new T.MeshStandardMaterial({color:cap?'#ac4165':'#d6b446',roughness:.55});
  const hoop=new T.Mesh(new T.TorusGeometry(.225,.018,6,28),rm);hoop.scale.y=1.32;racket.add(hoop);
  const grip=new T.Mesh(new T.CylinderGeometry(.026,.03,.30,8),dark);grip.position.y=-.43;racket.add(grip);
  const strings:number[]=[];
  for(let n=-4;n<=4;n++){const v=n*.045,edge=Math.sqrt(.225*.225-v*v);strings.push(v,-edge*1.32,0,v,edge*1.32,0,-edge,v*1.32,0,edge,v*1.32,0);}
  const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(strings,3));racket.add(new T.LineSegments(sg,new T.LineBasicMaterial({color:'#d8dbd5'})));
  const up=new T.Vector3(0,1,0),v1=new T.Vector3(),v2=new T.Vector3();
  function bone(i:number,a:number[],b:number[]){v1.set(...a as [number,number,number]);v2.set(...b as [number,number,number]);const length=v1.distanceTo(v2);limbs[i].position.copy(v1).add(v2).multiplyScalar(.5);limbs[i].scale.y=length;limbs[i].quaternion.setFromUnitVectors(up,v2.sub(v1).normalize());}
  function pose(p:ReturnType<typeof rallyFrame>['players'][number],time:number){
    group.position.set(p.x,.02,p.z);group.rotation.y=p.side===1?0:Math.PI;
    const stride=p.moving?Math.sin(time*13)*.22:0;
    torso.rotation.y=p.swing*.6;torso.rotation.x=.10;
    for(let leg=0;leg<2;leg++){const side=leg===0?-1:1,step=stride*side;
      const ankle=[side*(.25+Math.abs(stride)*.35),.22+Math.max(0,step)*.3,step];
      const knee=[side*.23,.56,-.16+step*.45];bone(leg*2,[side*.16,.94,0],knee);bone(leg*2+1,knee,ankle);shoes[leg].position.set(ankle[0],ankle[1]-.05,ankle[2]-.06);
    }
    // Racket centre coincides with the authored contact point at each hit.
    const angle=p.swing*1.75;
    racket.position.set(.78*Math.cos(angle)-.12*Math.sin(angle),1.08+Math.abs(p.swing)*.35,-.3-.75*Math.sin(angle));racket.rotation.set(0,angle,.18*p.swing);
    const hand=[racket.position.x,racket.position.y-.43,racket.position.z];
    bone(4,[.23,1.48,0],[.43,1.13,.04]);bone(5,[.43,1.13,.04],hand);
    bone(6,[-.23,1.48,0],[-.39,1.18,-.15]);bone(7,[-.39,1.18,-.15],[-.18,1.12,-.43]);
  }
  return {group,pose};
}

export default function TennisRally({active}:{active:boolean}){
  const clock=useRef(0);
  const figures=useMemo(()=>[player('#637c78',true),player('#edb532',false)],[]);
  const ball=useRef<T.Mesh>(null);
  useEffect(()=>()=>{figures.forEach(f=>{const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();f.group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());});},[figures]);
  useFrame((_,delta)=>{if(active)clock.current+=Math.min(delta,.05);const frame=rallyFrame(clock.current);figures.forEach((f,i)=>f.pose(frame.players[i],clock.current));ball.current?.position.set(...frame.ball);});
  return <group>{figures.map((f,i)=><primitive key={i} object={f.group}/>)}<mesh ref={ball} castShadow><sphereGeometry args={[.085,12,10]}/><meshStandardMaterial color="#ddea42" emissive="#b2c630" emissiveIntensity={.22}/></mesh></group>;
}
