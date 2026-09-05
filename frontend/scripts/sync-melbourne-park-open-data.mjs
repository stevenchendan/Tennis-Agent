import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(HERE, "../public/data/melbourne-park-open-data.json");
const ORIGIN = { latitude: -37.823074, longitude: 144.9819796 };
const BOUNDS = {
  south: -37.8297,
  west: 144.9742,
  north: -37.8157,
  east: 144.9914,
};

const CITY_API =
  "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/2020-building-footprints/records";
const OVERPASS_APIS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

function insideBounds(point) {
  return (
    point &&
    point.lat >= BOUNDS.south &&
    point.lat <= BOUNDS.north &&
    point.lon >= BOUNDS.west &&
    point.lon <= BOUNDS.east
  );
}

async function getBuildingFootprints() {
  const radius = "1.15km";
  const where = `within_distance(geo_point_2d,geom'POINT(${ORIGIN.longitude} ${ORIGIN.latitude})',${radius})`;
  const pageSize = 100;
  let offset = 0;
  let total = Infinity;
  const records = [];

  while (offset < total) {
    const url = new URL(CITY_API);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("where", where);
    url.searchParams.set("order_by", "structure_id,tier");
    const page = await fetchJson(url);
    total = page.total_count;
    records.push(...page.results.filter((record) => insideBounds(record.geo_point_2d)));
    offset += pageSize;
    process.stdout.write(`\rCity building records: ${Math.min(offset, total)}/${total}`);
  }

  process.stdout.write("\n");
  return records.map((record) => ({
    id: `${record.structure_id}-${record.tier}`,
    structureId: record.structure_id,
    tier: record.tier,
    type: record.footprint_type,
    roofType: record.roof_type,
    minElevation: record.footprint_min_elevation,
    maxElevation: record.footprint_max_elevation,
    extrusion: record.footprint_extrusion,
    geometry: record.geo_shape.geometry,
  }));
}

async function getOpenStreetMapFeatures() {
  const bbox = `${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east}`;
  const query = `[out:json][timeout:90];
(
  way["leisure"="pitch"]["sport"~"tennis"](${bbox});
  relation["leisure"="pitch"]["sport"~"tennis"](${bbox});
  nwr["name"~"Rod Laver Arena|Margaret Court Arena|John Cain Arena|Kia Arena|1573 Arena|Melbourne Park|CENTREPIECE",i](${bbox});
  way["highway"](${bbox});
  way["railway"="rail"](${bbox});
  way["waterway"](${bbox});
  way["natural"="water"](${bbox});
  node["natural"="tree"](${bbox});
  node["highway"="street_lamp"](${bbox});
  node["entrance"](${bbox});
);
out tags center geom;`;

  const body = new URLSearchParams({ data: query });
  let data;
  let lastError;
  for (const endpoint of OVERPASS_APIS) {
    try {
      data = await fetchJson(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "Tennis-Agent-Melbourne-Park/1.0 (open-data build script)",
        },
        body,
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!data) throw lastError;

  return data.elements
    .filter((element) => element.geometry || element.center || (element.lat && element.lon))
    .map((element) => ({
      id: `${element.type}/${element.id}`,
      type: element.type,
      tags: element.tags ?? {},
      center: element.center ?? (element.lat && element.lon ? { lat: element.lat, lon: element.lon } : null),
      geometry: element.geometry ?? null,
    }));
}

const [buildings, osmFeatures] = await Promise.all([
  getBuildingFootprints(),
  getOpenStreetMapFeatures(),
]);

const payload = {
  generatedAt: new Date().toISOString(),
  origin: ORIGIN,
  bounds: BOUNDS,
  attribution: [
    {
      label: "City of Melbourne Open Data",
      license: "CC BY 4.0",
      url: "https://data.melbourne.vic.gov.au/explore/dataset/2020-building-footprints/information/",
    },
    {
      label: "OpenStreetMap contributors",
      license: "ODbL 1.0",
      url: "https://www.openstreetmap.org/copyright",
    },
  ],
  buildings,
  osmFeatures,
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(payload)}\n`, "utf8");
console.log(`Wrote ${buildings.length} building tiers and ${osmFeatures.length} OSM features to ${OUTPUT}`);
