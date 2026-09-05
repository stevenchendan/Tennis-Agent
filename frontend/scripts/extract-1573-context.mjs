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
const near = ([x,z]) => x > -105 && x < 180 && z > -160 && z < 160;
const buildings = source.buildings.flatMap(b => {
  // This city record combines MCA and RLA into one solid footprint; replace it
  // below with separate OSM outlines to preserve their distinct roof heights.
  if (b.structureId === '812708') return [];
  const polygons = b.geometry.type === 'MultiPolygon' ? b.geometry.coordinates : [b.geometry.coordinates];
  return polygons.flatMap((rings, i) => {
    const ring = rings[0].map(([lon, lat]) => project(lon, lat));
    if (!ring.some(near)) return [];
    const center = ring.reduce((a,p) => [a[0]+p[0]/ring.length,a[1]+p[1]/ring.length],[0,0]);
    if (Math.abs(center[0]) < 25 && Math.abs(center[1]) < 34) return [];
    return [{id:b.id+'-'+i, ring, height:Math.max(1,b.extrusion), base:Math.max(0,b.minElevation-6), roof:b.roofType}];
  });
});
// Use the individual arena outlines in place of the compound city footprint.
for (const name of ['Margaret Court Arena', 'Rod Laver Arena']) {
  const f = source.osmFeatures.find(f => f.tags.name === name && f.geometry);
  if (f) buildings.push({id:f.id, name, ring:f.geometry.map(p=>project(p.lon,p.lat)), height:name.startsWith('Margaret')?15:30, base:0, roof:'Landmark'});
}
const features = source.osmFeatures.flatMap(f => {
  if (!f.geometry || !(f.tags.highway || f.tags.leisure === 'pitch' || f.tags.natural === 'wood' || f.tags.landuse === 'grass')) return [];
  const points = f.geometry.map(p => project(p.lon,p.lat));
  if (!points.every(p=>Math.abs(p[0])<300&&Math.abs(p[1])<300) || !points.some(near)) return [];
  return [{id:f.id, name:f.tags.name || '', kind:f.tags.leisure === 'pitch' ? 'court' : f.tags.highway ? 'path' : 'green', width:Number.parseFloat(f.tags.width)||3, points}];
});
fs.writeFileSync(path.join(root,'public/data/1573-context.json'),JSON.stringify({origin,angle,attribution:source.attribution,buildings,features}));
console.log(`Extracted ${buildings.length} building tiers and ${features.length} context features.`);
