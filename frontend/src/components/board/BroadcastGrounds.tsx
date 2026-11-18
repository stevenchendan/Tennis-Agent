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
  const seats=useRef<T.InstancedMesh>(null), backs=useRef<T.InstancedMesh>(null);
  const count=2*5*52;
  useLayoutEffect(()=>{
    if(!seats.current || !backs.current) return;
    const model=new T.Object3D(), color=new T.Color();
    let i=0;
    for(const side of [-1,1]) for(let row=0;row<5;row++) for(let seat=0;seat<52;seat++) {
      const aisle=Math.floor(seat/13)*.7, z=-15.9+seat*.58+aisle;
      const x=side*(11.55+row*.8), y=.64+row*.42;
      model.position.set(x,y,z);model.rotation.set(0,0,0);model.updateMatrix();
      seats.current.setMatrixAt(i,model.matrix);
      model.position.set(x+side*.195,y+.19,z);model.rotation.z=-side*.09;model.updateMatrix();
      backs.current.setMatrixAt(i,model.matrix);
      color.setHSL(.49+(seat%7)*.002,.14,.30+((seat*7+row*13)%11)*.007,T.SRGBColorSpace);
      seats.current.setColorAt(i,color);backs.current.setColorAt(i,color);i++;
    }
    for(const mesh of [seats.current,backs.current]) {mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  },[]);
  return <>
    {[-1,1].map(side=><group key={side}>{Array.from({length:5},(_,r)=><mesh key={r} position={[side*(11.55+r*.8),.1+r*.21,0]} receiveShadow><boxGeometry args={[.8,.24+r*.42,34]}/><meshStandardMaterial color="#747c74" roughness={.98}/></mesh>)}
      <mesh position={[side*10.45,.56,0]} receiveShadow castShadow><boxGeometry args={[.14,1.12,36.9]}/><meshStandardMaterial color="#23443e"/></mesh>
    </group>)}
    <instancedMesh ref={seats} args={[undefined,undefined,count]} receiveShadow><boxGeometry args={[.44,.065,.46]}/><meshStandardMaterial roughness={.65}/></instancedMesh>
    <instancedMesh ref={backs} args={[undefined,undefined,count]} receiveShadow><boxGeometry args={[.07,.34,.46]}/><meshStandardMaterial roughness={.65}/></instancedMesh>
  </>;
}

export default function BroadcastGrounds() {
  const back=useLoader(T.TextureLoader,"/models/tennis/stadium-sunrise.webp");
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
    const radius=58,columns=128,rows=36;
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
    <Environment files="/models/tennis/stadium-light.hdr" environmentIntensity={.62}/>
    <hemisphereLight args={["#dce7fa","#9b9070",.85]}/>
    <directionalLight position={[-14,15,-11]} color="#ffe3b9" intensity={2.35} castShadow
      shadow-mapSize={[2048,2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-far={75} shadow-normalBias={.012} shadow-bias={-.00012}/>
    <Perimeter/><GallerySeats/>
  </>;
}
