// Derive a compact, court-aligned context from the project's existing public data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'public/data/melbourne-park-open-data.json'), 'utf8'));
const origin = { latitude: -37.8207577, longitude: 144.97696165 };
const angle = 0.142;
function project(lon, lat) {
  const x = (lon - origin.longitude) * 111320 * Math.cos(origin.latitude * Math.PI / 180);
  const z = -(lat - origin.latitude) * 110540;
  return [+(x * Math.cos(angle) + z * Math.sin(angle)).toFixed(2), +(-x * Math.sin(angle) + z * Math.cos(angle)).toFixed(2)];
}
const near = ([x,z]) => x > -260 && x < 910 && z > -310 && z < 330;
const john = source.osmFeatures.find(f => f.tags.name === 'John Cain Arena');
const johnRing = john.geometry.map(p => project(p.lon,p.lat));
function inside(point, ring) {
  let result = false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>point[1])!==(b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) result=!result;
  }
  return result;
}
const buildings = source.buildings.flatMap(b => {
  // This city record combines MCA and RLA into one solid footprint; replace it
  // below with separate OSM outlines to preserve their distinct roof heights.
  if (b.structureId === '812708') return [];
  const polygons = b.geometry.type === 'MultiPolygon' ? b.geometry.coordinates : [b.geometry.coordinates];
  return polygons.flatMap((rings, i) => {
    const ring = rings[0].map(([lon, lat]) => project(lon, lat));
    if (!ring.some(near)) return [];
    const center = ring.reduce((a,p) => [a[0]+p[0]/ring.length,a[1]+p[1]/ring.length],[0,0]);
    if (inside(center,johnRing)) return [];
    if (Math.abs(center[0]) < 25 && Math.abs(center[1]) < 34) return [];
    return [{id:b.id+'-'+i, ring, height:Math.max(1,b.extrusion), base:Math.max(0,b.minElevation-6), roof:b.roofType,structureType:b.type}];
  });
});
// Use the individual arena outlines in place of the compound city footprint.
for (const name of ['Margaret Court Arena', 'Rod Laver Arena', 'John Cain Arena', 'Centrepiece Melbourne']) {
  const f = source.osmFeatures.find(f => f.tags.name === name && f.geometry);
  if (f) buildings.push({id:f.id, name, ring:f.geometry.map(p=>project(p.lon,p.lat)), height:name.startsWith('Margaret')?15:30, base:0, roof:'Landmark'});
}
const features = source.osmFeatures.flatMap(f => {
  if (!f.geometry || !(f.tags.highway || f.tags.railway === 'rail' || f.tags.leisure === 'pitch' || f.tags.natural === 'wood' || f.tags.landuse === 'grass')) return [];
  const points = f.geometry.map(p => project(p.lon,p.lat));
  if (!points.every(p=>p[0]>-350&&p[0]<960&&p[1]>-400&&p[1]<420) || !points.some(near)) return [];
  return [{id:f.id, name:f.tags.name || '', kind:f.tags.leisure === 'pitch' ? 'court' : f.tags.highway ? 'path' : f.tags.railway==='rail'?'rail':'green', highway:f.tags.highway||'', width:Number.parseFloat(f.tags.width)||3, surface:f.tags.surface||'', layer:Number(f.tags.layer)||0, points}];
});
fs.writeFileSync(path.join(root,'public/data/1573-context.json'),JSON.stringify({origin,angle,attribution:source.attribution,buildings,features}));
console.log(`Extracted ${buildings.length} building tiers and ${features.length} context features.`);
