'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as T from 'three';
import { Component, ComponentRef, ReactNode, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { buildArena, buildContext, ContextData, disposeModel } from './model';
import styles from './arena.module.css';
import { getTranslator, Language } from './i18n';

type View = 'hero' | 'plan' | 'seat' | 'court' | 'precinct';
type Light = 'day' | 'golden' | 'night';
type Shot = {view:View;serial:number};
const views: {id:View;label:string;en:string;icon:string}[] = [
  {id:'hero',label:'场馆全景',en:'ORBIT',icon:'◈'},
  {id:'plan',label:'垂直俯瞰',en:'PLAN',icon:'⊞'},
  {id:'seat',label:'看台视角',en:'SEAT',icon:'▤'},
  {id:'court',label:'走进球场',en:'COURT',icon:'⌖'},
  {id:'precinct',label:'周边区域',en:'PRECINCT',icon:'⌘'},
];
const cameras: Record<View,{position:[number,number,number];target:[number,number,number]}> = {
  hero:{position:[-57,58,73],target:[4,1,-1]},
  plan:{position:[0,105,.01],target:[0,0,0]},
  seat:{position:[-16.2,5.4,9],target:[0,1,0]},
  court:{position:[-2,1.75,16.6],target:[0,1,-6]},
  precinct:{position:[-118,147,165],target:[32,0,-27]},
};
const points = [
  {id:'court',title:'蓝色中心球场',en:'THE PLAYING SURFACE',position:[0,.3,0] as [number,number,number],view:'court' as View,description:'23.77 × 10.97 米标准双打场地。单打边线、发球区、中心标记，以及中部下垂的球网，均以米为单位建模。'},
  {id:'seat',title:'环抱式看台',en:'A SEAT IN THE ARENA',position:[-16,5,9] as [number,number,number],view:'seat' as View,description:'十二排逐级抬升的独立座椅，沿圆角矩形环绕球场。靠背、径向通道、扶手和后排遮阳棚均为实体几何；排数与细节为视觉近似。'},
  {id:'precinct',title:'Margaret Court Arena',en:'THE COPPER NEIGHBOUR',position:[59,19,20] as [number,number,number],view:'precinct' as View,description:'东侧紧邻的铜色屋顶是这片区域的视觉地标。周边建筑底图来自墨尔本开放数据，屋顶折线为参考卫星图的示意细化。'},
];

class SceneBoundary extends Component<{children:ReactNode;language:Language},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){const tr=getTranslator(this.props.language);return this.state.failed?<div className={styles.error}><h2>{tr('3D 场景暂时无法启动')}</h2><p>{tr('请开启浏览器硬件加速，或使用支持 WebGL 2 的浏览器。')}</p><button onClick={()=>window.location.reload()}>{tr('重新加载')}</button></div>:this.props.children;}
}

function World({data,light,context,crowd,onReady}:{data:ContextData;light:Light;context:boolean;crowd:boolean;onReady:(seats:number)=>void}) {
  const root=useRef<T.Group>(null);
  const models=useRef<{arena:ReturnType<typeof buildArena>;context:T.Group}|null>(null);
  useEffect(()=>{
    const arena=buildArena(), surroundings=buildContext(data), parent=root.current!;
    models.current={arena,context:surroundings};parent.add(arena.group,surroundings);onReady(arena.seats);
    return ()=>{parent.remove(arena.group,surroundings);disposeModel(arena.group);disposeModel(surroundings);models.current=null;};
  },[data,onReady]);
  useEffect(()=>{
    if(!models.current)return;
    models.current.context.visible=context;
    models.current.arena.crowd.visible=crowd;
    models.current.arena.lamps.traverse(o=>{if(o instanceof T.Mesh)(o.material as T.MeshStandardMaterial).emissiveIntensity=light==='night'?5:light==='golden'?1:.08;});
  },[light,context,crowd,data]);
  return <group ref={root}/>;
}

function Rig({shot,rotate,onInteract,canvasRef}:{shot:Shot;rotate:boolean;onInteract:()=>void;canvasRef:React.RefObject<HTMLCanvasElement|null>}) {
  const {camera,gl,invalidate,size}=useThree();
  const controls=useRef<ComponentRef<typeof OrbitControls>>(null);
  const transitioning=useRef(true);
  useEffect(()=>{transitioning.current=true;invalidate();},[shot,invalidate,size.width,size.height]);
  useEffect(()=>{canvasRef.current=gl.domElement;return()=>{canvasRef.current=null;};},[gl,canvasRef]);
  useFrame((_,delta)=>{
    if(!controls.current||!transitioning.current)return;
    const preset=cameras[shot.view], p=new T.Vector3(...preset.position), t=new T.Vector3(...preset.target);
    if(size.width<760&&['hero','plan','precinct'].includes(shot.view))p.sub(t).multiplyScalar(1.65).add(t);
    const a=1-Math.exp(-Math.min(delta,.05)*4.5);
    camera.position.lerp(p,a);controls.current.target.lerp(t,a);controls.current.update();
    if(camera.position.distanceTo(p)<.025){camera.position.copy(p);controls.current.target.copy(t);transitioning.current=false;}
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.075} minDistance={1.5} maxDistance={330} maxPolarAngle={Math.PI*.488} autoRotate={rotate} autoRotateSpeed={.45} zoomSpeed={.7} target={[4,1,-1]} onStart={()=>{transitioning.current=false;onInteract();}}/>;
}

function Rally({active}:{active:boolean}) {
  const ball=useRef<T.Mesh>(null);const elapsed=useRef(0);
  useFrame((_,delta)=>{if(!active||!ball.current)return;elapsed.current+=delta;const t=(elapsed.current%2.6)/2.6;ball.current.position.set(Math.sin(t*Math.PI*2)*3.1,.28+Math.sin(t*Math.PI)*3.1,14-28*t);});
  return <mesh ref={ball} visible={active} castShadow><sphereGeometry args={[.12,16,12]}/><meshStandardMaterial color="#d6ec49" emissive="#a4b22a" emissiveIntensity={.2}/></mesh>;
}

function Scene({data,shot,light,rotate,context,crowd,markers,rally,onSelect,onReady,onInteract,canvasRef,language}:{data:ContextData;shot:Shot;light:Light;rotate:boolean;context:boolean;crowd:boolean;markers:boolean;rally:boolean;onSelect:(id:string)=>void;onReady:(seats:number)=>void;onInteract:()=>void;canvasRef:React.RefObject<HTMLCanvasElement|null>;language:Language}){
  const tr=getTranslator(language);
  const night=light==='night',golden=light==='golden';
  const bg=night?'#172b38':golden?'#d6c5ab':'#dedfd3';
  return <>
    <color attach="background" args={[bg]}/><fog attach="fog" args={[bg,190,480]}/>
    <hemisphereLight args={[night?'#8299c3':'#e4eff8',night?'#26362e':'#b1a788',night?.85:2.1]}/>
    <directionalLight position={golden?[-65,24,38]:[-40,80,-30]} color={golden?'#ffcb8d':'#fff5df'} intensity={night?.1:golden?3.3:2.7} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-85} shadow-camera-right={85} shadow-camera-top={85} shadow-camera-bottom={-85} shadow-camera-far={250} shadow-normalBias={.08} shadow-bias={-.00008}/>
    {night&&<><pointLight position={[-18,18,0]} intensity={1600} distance={85} decay={2} color="#e7f2ff"/><pointLight position={[18,18,0]} intensity={1600} distance={85} decay={2} color="#fff0d6"/><pointLight position={[0,17,-22]} intensity={1100} distance={65} decay={2}/><pointLight position={[0,17,22]} intensity={1100} distance={65} decay={2}/></>}
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-3.2,0]} receiveShadow><planeGeometry args={[3000,3000]}/><meshStandardMaterial color={bg} roughness={1}/></mesh>
    <World data={data} light={light} context={context} crowd={crowd} onReady={onReady}/>
    <Rally active={rally}/>
    {markers&&points.filter(p=>context||p.id!=='precinct').map((p,i)=><Html key={p.id} position={p.position} center zIndexRange={[10,0]}><button className={styles.pin} title={tr(p.title)} aria-label={`${tr('探索')}${tr(p.title)}`} onClick={()=>onSelect(p.id)}><span>{String(i+1).padStart(2,'0')}</span><b>{tr(p.title)}</b></button></Html>)}
    <Rig shot={shot} rotate={rotate} onInteract={onInteract} canvasRef={canvasRef}/>
  </>;
}

export default function ArenaExperience(){
  const [language,setLanguage]=useState<Language>('zh');
  const tr=getTranslator(language);
  useEffect(()=>{
    try {const saved=localStorage.getItem('1573-arena-language');if(saved==='en'||saved==='zh')setLanguage(saved);} catch {/* Storage may be disabled; switching still works. */}
  },[]);
  useEffect(()=>{
    const previous=document.documentElement.lang;
    document.documentElement.lang=language==='zh'?'zh-CN':'en';
    return()=>{document.documentElement.lang=previous;};
  },[language]);
  function changeLanguage(next:Language){
    setLanguage(next);
    try {localStorage.setItem('1573-arena-language',next);} catch {/* Keep the preference in memory when storage is unavailable. */}
  }
  const [data,setData]=useState<ContextData|null>(null),[loadError,setLoadError]=useState(false),[ready,setReady]=useState(false),[seats,setSeats]=useState(0);
  const [shot,setShot]=useState<Shot>({view:'hero',serial:0}),[light,setLight]=useState<Light>('day');
  const [rotate,setRotate]=useState(false),[context,setContext]=useState(true),[crowd,setCrowd]=useState(false),[markers,setMarkers]=useState(true),[rally,setRally]=useState(false);
  const [selected,setSelected]=useState<string|null>(null),[info,setInfo]=useState(false),[panel,setPanel]=useState(false),[toast,setToast]=useState('');
  const container=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement|null>(null);
  useEffect(()=>{
    const abort=new AbortController();fetch('/data/1573-context.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('Context unavailable');return r.json();}).then(setData).catch(e=>{if(e.name!=='AbortError')setLoadError(true);});
    return()=>abort.abort();
  },[]);
  const choose=useCallback((view:View)=>{setShot(s=>({view,serial:s.serial+1}));setRotate(false);},[]);
  const onReady=useCallback((count:number)=>{setReady(true);setSeats(count);},[]);
  const onInteract=useCallback(()=>setRotate(false),[]);
  const onSelect=useCallback((id:string)=>{setSelected(id);setMarkers(false);const p=points.find(p=>p.id===id);if(p)choose(p.view);},[choose]);
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLElement&&['INPUT','BUTTON','SELECT','TEXTAREA','A'].includes(e.target.tagName))return;
      const index=Number(e.key)-1;if(index>=0&&index<views.length){choose(views[index].id);}
      if(e.key.toLowerCase()==='r')choose('hero');
      if(e.key.toLowerCase()==='h')setMarkers(v=>!v);
      if(e.code==='Space'){e.preventDefault();setRotate(v=>!v);}
      if(e.key==='Escape'){setSelected(null);setInfo(false);setPanel(false);}
    };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[choose]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(timer);},[toast]);
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await container.current?.requestFullscreen();}catch{setToast('当前浏览器不支持全屏，请使用浏览器的全屏功能。');}}
  function capture(){if(!canvas.current||!ready)return;try{const a=document.createElement('a');a.download=`1573-arena-${light}.png`;a.href=canvas.current.toDataURL('image/png');a.click();setToast('已保存当前 3D 画面');}catch{setToast('画面暂时无法保存，请重试。');}}
  const detail=points.find(p=>p.id===selected);
  return <main lang={language==='zh'?'zh-CN':'en'} ref={container} className={`${styles.experience} ${light==='night'?styles.night:''}`}>
    <div className={styles.viewport} aria-label={tr("1573 Arena 可交互三维场景")}>
      {data&&<SceneBoundary language={language}><Suspense fallback={null}><Canvas shadows camera={{position:cameras.hero.position,fov:43,near:.1,far:2000}} dpr={[1,1.6]} gl={{antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'}} fallback={<div className={styles.error}>{tr("当前浏览器不支持 WebGL 2。请开启硬件加速后重试。")}</div>} onCreated={({gl})=>{gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1;}}><Scene {...{data,shot,light,rotate,context,crowd,markers,rally,onSelect,onReady,onInteract,language}} canvasRef={canvas}/></Canvas></Suspense></SceneBoundary>}
    </div>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label={tr("返回 Tennis-Agent 首页")}><span className={styles.brandMark}>◉</span> COURT ATLAS<span className={styles.brandDivider}/><small>{tr("A TENNIS-AGENT EXPLORATION")}</small></Link>
      <div className={styles.headerActions}><div className={styles.languageSwitch} role="group" aria-label={tr('页面语言')}><button lang="en" aria-pressed={language==='en'} onClick={()=>changeLanguage('en')}>English</button><button lang="zh-CN" aria-pressed={language==='zh'} onClick={()=>changeLanguage('zh')}>中文</button></div><span className={styles.live}><i/>  {tr("INTERACTIVE 3D")}</span><button onClick={()=>setInfo(v=>!v)} aria-expanded={info}>{tr("关于模型 ↗")}</button><button onClick={fullscreen} aria-label={tr("切换全屏")} title={tr("全屏")}>⛶</button></div>
    </header>
    <section className={styles.title}>
      <p className={styles.eyebrow}><span>{tr("AUSTRALIA")}</span><i/>  {tr("MELBOURNE PARK")}</p>
      <h1>1573<span>Arena.</span></h1>
      <p className={styles.subtitle}>{tr("离球场，更近一点。")}</p>
      <div className={styles.coordinates}>37°49′14.7″ S &nbsp; 144°58′37.1″ E</div>
    </section>
    <button className={styles.mobileSettings} aria-expanded={panel} onClick={()=>setPanel(v=>!v)}>{tr("场景设置")} {panel?'−':'+'}</button>
    <aside className={`${styles.settings} ${panel?styles.settingsOpen:''}`}>
      <div className={styles.panelHeading}><span>{tr("YOUR PERSPECTIVE")}</span><span>↗</span></div>
      <h2>{tr("此刻的球场")}</h2>
      <div className={styles.controlLabel}><span>{tr("光线氛围")}</span><small>{tr("LIGHT & TIME")}</small></div>
      <div className={styles.lights}>{(['day','golden','night'] as Light[]).map((l,i)=><button key={l} aria-pressed={light===l} className={light===l?styles.activeLight:''} onClick={()=>setLight(l)}><span>{['☀','◒','☾'][i]}</span>{[tr("日间"),tr("日落"),tr("夜场")][i]}</button>)}</div>
      <div className={styles.divider}/>
      {[{label:tr("周边建筑"),sub:tr("Precinct context"),value:context,set:setContext},{label:tr("场景热点"),sub:tr("Points of interest"),value:markers,set:setMarkers},{label:tr("看台观众"),sub:tr("A little match-day life"),value:crowd,set:setCrowd}].map(c=><label key={c.label} className={styles.toggleRow}><span>{c.label}<small>{c.sub}</small></span><input type="checkbox" checked={c.value} onChange={e=>c.set(e.target.checked)}/><i/></label>)}
      <div className={styles.divider}/>
      <button className={`${styles.orbitButton} ${rotate?styles.engaged:''}`} aria-pressed={rotate} onClick={()=>setRotate(v=>!v)}><span>{rotate?'Ⅱ':'▷'}</span>{rotate?tr("暂停环绕"):tr("自动环绕")}<small>{tr("SPACE")}</small></button>
      <button className={styles.rallyButton} aria-pressed={rally} onClick={()=>setRally(v=>!v)}>{rally?'●':'○'} {rally?tr("暂停网球轨迹"):tr("播放网球轨迹")} <span>↗</span></button>
    </aside>
    <div className={styles.north} title={tr("北向相对球场长轴约偏转 8°")}><span>N</span><svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true"><path d="M17 3 L29 34 L17 27 L5 34 Z" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M17 3 L17 27 L5 34 Z" fill="currentColor"/></svg><small>{tr("地理北向参考 · 8°")}</small></div>
    <section className={styles.caption}><div className={styles.captionNumber}>01<span> / {tr('FIELD NOTES')}</span></div><h2>{tr("一座开放的网球剧场。")}</h2><p>{tr("蓝色硬地、层叠看台与铜色屋顶，")}<br/>{tr("在墨尔本公园的一隅相遇。")}</p><div className={styles.metrics}><div><b>{seats?seats.toLocaleString():'—'}</b><span>{tr("模型座椅")}</span></div><div><b>23.77<span> m</span></b><span>{tr("标准场地长度")}</span></div></div></section>
    <nav className={styles.viewDock} aria-label={tr("相机视角")}><span className={styles.dockLabel}>{tr("EXPLORE")}</span><div>{views.map((v,i)=><button key={v.id} aria-pressed={shot.view===v.id} className={shot.view===v.id?styles.activeView:''} onClick={()=>{choose(v.id);setSelected(null);}} title={`${tr(v.label)} · ${tr('快捷键')} ${i+1}`}><span>{v.icon}</span><b>{tr(v.label)}</b><small>{v.en}</small></button>)}</div></nav>
    <div className={styles.utilities}><button onClick={()=>choose('hero')} title={tr("重置视角 · R")} aria-label={tr("重置视角")}>↺</button><button onClick={capture} disabled={!ready} title={tr("保存画面")} aria-label={tr("保存画面")}>⌑</button></div>
    <footer className={styles.footer}><span><i/> {ready?tr("场景已就绪"):tr("正在构建场景")}</span><span>{tr("拖动旋转")} <b>·</b>  {tr("滚轮缩放")} <b>·</b>  {tr("右键平移")} <b>·</b>  {tr("双指操作")}</span><span>{tr("VISUAL STUDY")} <b> / </b> 01</span></footer>
    {!ready&&!loadError&&<div className={styles.loading} role="status"><span className={styles.spinner}/><strong>{tr("正在构建你的场边视角")}</strong><small>{tr("球场 · 看台 · 墨尔本公园")}</small></div>}
    {loadError&&<div className={styles.error} role="alert"><h2>{tr("场景数据加载失败")}</h2><p>{tr("请检查连接后重试。")}</p><button onClick={()=>window.location.reload()}>{tr("重新加载")}</button></div>}
    {detail&&<section className={styles.detail} aria-live="polite"><button className={styles.close} onClick={()=>setSelected(null)} aria-label={tr("关闭热点详情")}>×</button><p className={styles.eyebrow}>{tr(detail.en)}</p><h2>{tr(detail.title)}</h2><p>{tr(detail.description)}</p><button className={styles.detailBack} onClick={()=>{setSelected(null);setMarkers(true);choose('hero');}}>{tr("返回场馆全景 ↗")}</button></section>}
    {info&&<section className={styles.about} aria-label={tr("关于模型")}><button className={styles.close} onClick={()=>setInfo(false)} aria-label={tr("关闭模型说明")}>×</button><p className={styles.eyebrow}>{tr("THE MAKING OF THIS PLACE")}</p><h2>{tr("真实位置，手工重建。")}</h2><p>{tr("1573 Arena 的标准球场与周边地理位置采用米制建模；圆角看台、座椅、遮阳棚、灯架和屋顶细节依据卫星图与公开场馆资料做视觉近似。不是测绘模型，也不代表最新的现场设施。")}</p><p>{tr("日落与夜场为艺术灯光预设，网球轨迹为演示动画。树木、观众和街道家具是示意布置。")}</p><div className={styles.sourceLinks}><a href="https://www.google.com/maps/place/1573+Arena/@-37.8208432,144.9768967,113m/data=!3m1!1e3" target="_blank" rel="noreferrer">{tr("卫星图参考 · Google Maps ↗")}</a><a href="https://officiating.tennis.com.au/pdf/ImportantlocationsAO21.pdf" target="_blank" rel="noreferrer">{tr("场馆位置参考 · Tennis Australia ↗")}</a><a href="https://data.melbourne.vic.gov.au/explore/dataset/2020-building-footprints/information/" target="_blank" rel="noreferrer">{tr("建筑轮廓 · City of Melbourne · CC BY 4.0 ↗")}</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{tr("球场与道路 · © OpenStreetMap contributors · ODbL ↗")}</a><a href="/data/1573-context.json" download>{tr("下载衍生地理数据 · ODbL / CC BY 4.0 ↓")}</a></div><small>{tr("快捷键：1–5 切换视角 · R 重置 · H 热点 · 空格环绕")}</small></section>}
    {toast&&<div className={styles.toast} role="status">{tr(toast)}</div>}
  </main>;
}
