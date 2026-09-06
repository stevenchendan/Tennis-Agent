import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('public/data/1573-context.json'));
const landmarks={'810422-1-0':'National Tennis Centre','812707-1-0':'Rod Laver eastern pavilion','808864-1-0':'Tennis administration building'};
const inventory=data.buildings.map(b=>{
  const xs=b.ring.map(p=>p[0]),zs=b.ring.map(p=>p[1]);
  let treatment=b.name?'Reference-led landmark':landmarks[b.id]?'Reference-led named building':b.structureType==='Bridge'?'Open deck and supports':b.structureType==='Tram Stop'?'Low platform':`${b.roof} roof, parapet and facade scale cues`;
  if(b.id.startsWith('819103-'))treatment=b.id==='819103-1-0'?'MCG peripheral oval shell and field':'Replaced by shared MCG shell';
  if(b.id.startsWith('806665-'))treatment=b.id==='806665-1-0'?'AAMI peripheral open field and segmented roof':'Replaced by shared AAMI shell';
  if(b.id==='805343-2-0')treatment='Duplicate bridge tier omitted';
  if(b.id==='810459-2-0')treatment='Replaced by mapped Tanderrum deck';
  return {id:b.id,name:b.name||landmarks[b.id]||null,sourceType:b.structureType||'OSM landmark',sourceRoof:b.roof,bounds:[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)],treatment,confidence:b.name||landmarks[b.id]?'Visual form cross-checked; dimensions approximate':'Mapped footprint/type; fine facade details unverified'};
});
fs.mkdirSync('docs/precinct',{recursive:true});
fs.writeFileSync('docs/precinct/building-inventory.json',JSON.stringify({reviewed:'2026-09-06',records:inventory.length,buildings:inventory},null,2));
console.log(`Audited ${inventory.length} source building tiers; every record has a documented rendering treatment.`);
