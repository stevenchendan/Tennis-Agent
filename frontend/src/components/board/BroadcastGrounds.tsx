"use client";
import {useEffect,useLayoutEffect,useMemo,useRef} from "react";
import {useLoader,useThree} from "@react-three/fiber";
import {Environment} from "@react-three/drei";
import * as T from "three";

function Perimeter() {
  const sign=useMemo(()=>{
    const c=document.createElement("canvas"); c.width=2048; c.height=160;
    const g=c.getContext("2d")!;
    g.fillStyle="#183533";g.fillRect(0,0,c.width,c.height);
    g.fillStyle="#bacbc2";g.textAlign="center";g.textBaseline="middle";g.font="600 47px Arial";
    for(const x of [475,1573]) g.fillText("T E N N I S    A G E N T",x,82);
    const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
    return texture;
  },[]);
  useEffect(()=>()=>sign.dispose(),[sign]);
  return <>{[-1,1].map(end=><group key={end} position={[0,0,end*18.4]} rotation={[0,end===1?Math.PI:0,0]}>
    <mesh position={[0,.85,0]} receiveShadow castShadow><boxGeometry args={[22.5,1.7,.16]}/><meshStandardMaterial color="#173a34" roughness={.94}/></mesh>
    <mesh position={[0,.85,.085]}><planeGeometry args={[21.7,1.6]}/><meshStandardMaterial map={sign} roughness={.95}/></mesh>
  </group>)}</>;
}

function GallerySeats() {
  const seats=useRef<T.InstancedMesh>(null);
  const count=2*3*48;
  // A continuous moulded seat shell with a raised rim, curved back and rolled lip.
  const shell=useMemo(()=>{
    const profile=[[-.22,.045],[-.20,.025],[-.12,.003],[.06,0],[.145,.025],[.18,.09],[.195,.23],[.23,.325],[.241,.33]];
    const positions:number[]=[],indices:number[]=[];
    for(let j=0;j<profile.length;j++) for(let i=0;i<=10;i++) {
      const u=i/5-1, [x,y]=profile[j];
      positions.push(x-Math.pow(Math.abs(u),2)*Math.max(0,y)*.28,y+.031*u*u,u*(.221-.022*y));
      if(j<profile.length-1 && i<10) {const a=j*11+i;indices.push(a,a+11,a+1,a+1,a+11,a+12);}
    }
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
  },[]);
  useEffect(()=>()=>shell.dispose(),[shell]);
  useLayoutEffect(()=>{
    if(!seats.current)return;
    const model=new T.Object3D(),color=new T.Color();
    let i=0;
    for(const side of [-1,1]) for(let row=0;row<3;row++) for(let seat=0;seat<48;seat++) {
      model.position.set(side*(11.55+row*.8),.51+row*.4,-15+seat*.595+Math.floor(seat/12)*.72);
      model.rotation.y=side===1?0:Math.PI;model.updateMatrix();
      seats.current.setMatrixAt(i,model.matrix);
      color.setHSL(.48,.21,.25+((seat*7+row*13)%11)*.006,T.SRGBColorSpace);
      seats.current.setColorAt(i++,color);
    }
    seats.current.instanceMatrix.needsUpdate=true;seats.current.computeBoundingSphere();
  },[]);
  return <>
    {[-1,1].map(side=><group key={side}>{Array.from({length:3},(_,r)=><mesh key={r} position={[side*(11.55+r*.8),.14+r*.2,0]} receiveShadow castShadow><boxGeometry args={[.8,.28+r*.4,33]}/><meshStandardMaterial color="#686e65" roughness={.98}/></mesh>)}
      <mesh position={[side*10.45,.52,0]} receiveShadow castShadow><boxGeometry args={[.14,1.04,36.9]}/><meshStandardMaterial color="#21413a"/></mesh>
    </group>)}
    <instancedMesh ref={seats} args={[shell,undefined,count]} castShadow receiveShadow><meshStandardMaterial side={T.DoubleSide} roughness={.56}/></instancedMesh>
  </>;
}

export default function BroadcastGrounds() {
  const back=useLoader(T.TextureLoader,"/models/tennis/club-sunrise.webp");
  const {scene}=useThree();
  useLayoutEffect(()=>{
    back.colorSpace=T.SRGBColorSpace;back.mapping=T.EquirectangularReflectionMapping;
    const previous=scene.background;
    scene.background=back;
    return ()=>{scene.background=previous;};
  },[back,scene]);
  // Reproject the photographed horizon from court level, so elevated cameras
  // see the stands beyond the back wall without looking into a floating field.
  const panorama=useMemo(()=>{
    const positions:number[]=[],uv:number[]=[],indices:number[]=[];
    const radius=42,columns=128,rows=36;
    for(let row=0;row<=rows;row++) for(let col=0;col<=columns;col++) {
      const az=(col/columns-.5)*2*Math.PI, el=-.18+row/rows*1.55;
      positions.push(radius*Math.cos(az),1.55+radius*Math.tan(el),radius*Math.sin(az));
      uv.push(col/columns,.5+el/Math.PI);
      if(row<rows && col<columns) {
        const a=row*(columns+1)+col;
        indices.push(a,a+1,a+columns+1,a+1,a+columns+2,a+columns+1);
      }
    }
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(positions,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
    return g;
  },[]);
  useEffect(()=>()=>panorama.dispose(),[panorama]);
  return <>
    <mesh geometry={panorama}><meshBasicMaterial map={back} side={T.DoubleSide} toneMapped={false}/></mesh>
    <Environment files="/models/tennis/club-light.hdr" environmentIntensity={.87}/>
    <hemisphereLight args={["#dce7fa","#7b826b",.52]}/>
    <directionalLight position={[12,8,18]} color="#ffe7ca" intensity={2.15} castShadow
      shadow-mapSize={[2048,2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-far={75} shadow-normalBias={.012} shadow-bias={-.00012}/>
    <Perimeter/><GallerySeats/>
  </>;
}
