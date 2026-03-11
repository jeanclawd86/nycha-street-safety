/**
 * NYCHA Street Safety - Data Pipeline v3 (LION block-face segments)
 * 
 * Uses LION centerline dataset for proper block-face granularity
 * + speed limits and lane counts.
 */

const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");

const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const PAGE_SIZE = 50000;

const URLS = {
  nycha: "https://data.cityofnewyork.us/resource/phvi-damg.json",
  streets: "https://data.cityofnewyork.us/resource/inkn-q76z.json",
  truckRoutes: "https://data.cityofnewyork.us/resource/jjja-shxy.json",
  collisions: "https://data.cityofnewyork.us/resource/h9gi-nx95.json",
};

// ---- Fetch helpers ----

async function fetchAllPages(url, params = {}) {
  const results = [];
  let offset = 0;
  while (true) {
    const qp = new URLSearchParams({ $limit: String(PAGE_SIZE), $offset: String(offset), ...params });
    const fullUrl = `${url}?${qp}`;
    console.log(`  Fetching offset=${offset}...`);
    const res = await fetch(fullUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (data.length === 0) break;
    results.push(...data);
    console.log(`  Got ${data.length} rows (total: ${results.length})`);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return results;
}

function makeFeature(geom, properties) {
  if (!geom || !geom.type || !geom.coordinates) return null;
  return turf.feature(geom, properties);
}

// ---- Grid spatial index ----

function buildGridIndex(features, cellSize = 0.005) {
  const grid = {};
  for (let i = 0; i < features.length; i++) {
    const bbox = turf.bbox(features[i]);
    const minCX = Math.floor(bbox[0] / cellSize);
    const minCY = Math.floor(bbox[1] / cellSize);
    const maxCX = Math.floor(bbox[2] / cellSize);
    const maxCY = Math.floor(bbox[3] / cellSize);
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = `${cx},${cy}`;
        if (!grid[key]) grid[key] = [];
        grid[key].push(i);
      }
    }
  }
  return { grid, cellSize };
}

function queryGrid(index, bbox) {
  const { grid, cellSize } = index;
  const minCX = Math.floor(bbox[0] / cellSize);
  const minCY = Math.floor(bbox[1] / cellSize);
  const maxCX = Math.floor(bbox[2] / cellSize);
  const maxCY = Math.floor(bbox[3] / cellSize);
  const results = new Set();
  for (let cx = minCX; cx <= maxCX; cx++) {
    for (let cy = minCY; cy <= maxCY; cy++) {
      const key = `${cx},${cy}`;
      if (grid[key]) for (const idx of grid[key]) results.add(idx);
    }
  }
  return Array.from(results);
}

// Helper: distance from point to MultiLineString or LineString
function distToFeature(pt, feature) {
  const geom = feature.geometry;
  if (geom.type === "LineString") {
    return turf.pointToLineDistance(pt, feature, { units: "meters" });
  }
  if (geom.type === "MultiLineString") {
    let minDist = Infinity;
    for (const coords of geom.coordinates) {
      if (coords.length < 2) continue;
      try {
        const line = turf.lineString(coords);
        const d = turf.pointToLineDistance(pt, line, { units: "meters" });
        if (d < minDist) minDist = d;
      } catch { /* skip */ }
    }
    return minDist;
  }
  return Infinity;
}

// ---- Borough code mapping ----
const BOROUGH_NAMES = { "1": "MANHATTAN", "2": "BRONX", "3": "BROOKLYN", "4": "QUEENS", "5": "STATEN ISLAND" };

// ---- Fetch steps ----

async function fetchNYCHA() {
  console.log("\n📍 Fetching NYCHA properties...");
  const raw = await fetchAllPages(URLS.nycha);
  const features = [];
  for (const r of raw) {
    const f = makeFeature(r.the_geom, {
      name: r.developmen || "Unknown",
      borough: r.borough || "",
      tds_num: r.tds_num || "",
    });
    if (f) features.push(f);
  }
  console.log(`  ✓ ${features.length} NYCHA properties`);
  return turf.featureCollection(features);
}

async function fetchWideStreets() {
  console.log("\n🛣️  Fetching LION block-face segments (>60ft wide)...");
  const raw = await fetchAllPages(URLS.streets, {
    $where: "streetwidth >= '60' AND shape_length > 0",
    $select: "physicalid,full_street_name,streetwidth,number_travel_lanes,number_total_lanes,posted_speed,boroughcode,shape_length,the_geom,trafdir,rw_type,snow_priority",
  });
  console.log(`  Raw: ${raw.length} segments`);

  const features = [];
  for (const r of raw) {
    const width = parseFloat(r.streetwidth);
    if (isNaN(width) || width < 60) continue;
    const f = makeFeature(r.the_geom, {
      street_name: r.full_street_name || "",
      width,
      physicalid: r.physicalid || "",
      travel_lanes: parseInt(r.number_travel_lanes) || 0,
      total_lanes: parseInt(r.number_total_lanes) || 0,
      speed_limit: parseInt(r.posted_speed) || 0,
      borough: BOROUGH_NAMES[r.boroughcode] || "",
      shape_length: parseFloat(r.shape_length) || 0,
      trafdir: r.trafdir || "",
      rw_type: r.rw_type || "",
    });
    if (f) features.push(f);
  }
  console.log(`  ✓ ${features.length} valid block-face segments`);

  // Log length stats
  const lengths = features.map(f => f.properties.shape_length).sort((a, b) => a - b);
  console.log(`  Length stats: min=${lengths[0]?.toFixed(0)}ft median=${lengths[Math.floor(lengths.length/2)]?.toFixed(0)}ft max=${lengths[lengths.length-1]?.toFixed(0)}ft`);

  return turf.featureCollection(features);
}

async function fetchTruckRoutes() {
  console.log("\n🚛 Fetching truck routes...");
  const raw = await fetchAllPages(URLS.truckRoutes);
  const streetNames = new Set();
  const features = [];
  for (const r of raw) {
    const name = (r.street || "").toUpperCase().trim();
    if (name) streetNames.add(name);
    const f = makeFeature(r.the_geom, { street: name });
    if (f) features.push(f);
  }
  console.log(`  ✓ ${raw.length} truck route segments, ${streetNames.size} unique street names`);
  return { features: turf.featureCollection(features), streetNames };
}

async function fetchCollisions() {
  console.log("\n💥 Fetching pedestrian collisions...");
  const raw = await fetchAllPages(URLS.collisions, {
    $where: "(number_of_pedestrians_injured > 0 OR number_of_pedestrians_killed > 0) AND latitude IS NOT NULL",
    $select: "latitude,longitude,number_of_pedestrians_injured,number_of_pedestrians_killed,on_street_name",
  });
  console.log(`  ✓ ${raw.length} pedestrian collision records`);
  return raw;
}

// ---- Processing ----

function excludeTruckRoutes(streets, truckData) {
  console.log("\n🚫 Excluding truck route segments...");
  const { streetNames, features: truckFC } = truckData;
  const truckIndex = buildGridIndex(truckFC.features, 0.002);
  const before = streets.features.length;

  const filtered = streets.features.filter((seg) => {
    const segName = (seg.properties.street_name || "").toUpperCase().trim();
    if (segName && streetNames.has(segName)) return false;

    // Spatial proximity: midpoint within 15m of truck route
    try {
      const midpoint = turf.pointOnFeature(seg);
      const midBbox = [
        midpoint.geometry.coordinates[0] - 0.0002,
        midpoint.geometry.coordinates[1] - 0.0002,
        midpoint.geometry.coordinates[0] + 0.0002,
        midpoint.geometry.coordinates[1] + 0.0002,
      ];
      const candidates = queryGrid(truckIndex, midBbox);
      for (const ci of candidates) {
        try {
          const dist = distToFeature(midpoint, truckFC.features[ci]);
          if (dist < 15) return false;
        } catch { /* skip */ }
      }
    } catch { /* keep */ }

    return true;
  });

  console.log(`  ✓ ${before} → ${filtered.length} (removed ${before - filtered.length} truck/bus routes)`);
  return turf.featureCollection(filtered);
}

function findSegmentsNearNYCHA(streets, nychaFC) {
  console.log("\n🏘️  Finding block-face segments near NYCHA (50m buffer)...");

  const buffered = [];
  for (const f of nychaFC.features) {
    try {
      const buf = turf.buffer(f, 0.05, { units: "kilometers" });
      if (buf) { buf.properties = { ...f.properties }; buffered.push(buf); }
    } catch { /* skip */ }
  }
  console.log(`  Buffered ${buffered.length} NYCHA polygons`);

  const nychaIndex = buildGridIndex(buffered, 0.003);
  const qualifying = [];
  let tested = 0;

  for (const seg of streets.features) {
    const segBbox = turf.bbox(seg);
    const candidates = queryGrid(nychaIndex, segBbox);
    const adjacentNYCHA = [];

    for (const ci of candidates) {
      try {
        if (turf.booleanIntersects(seg, buffered[ci])) {
          adjacentNYCHA.push(buffered[ci].properties.name);
        }
      } catch { /* skip */ }
    }

    if (adjacentNYCHA.length > 0) {
      seg.properties.adjacent_nycha = [...new Set(adjacentNYCHA)];
      qualifying.push(seg);
    }

    tested++;
    if (tested % 500 === 0) console.log(`  Processed ${tested}/${streets.features.length}...`);
  }

  console.log(`  ✓ ${qualifying.length} block-face segments adjacent to NYCHA`);
  return turf.featureCollection(qualifying);
}

function assignCollisions(segments, collisions) {
  console.log("\n🔗 Assigning collisions to block-face segments...");

  for (const seg of segments.features) {
    seg.properties.pedestrian_injuries = 0;
    seg.properties.pedestrian_deaths = 0;
    seg.properties.crash_count = 0;
  }

  const segIndex = buildGridIndex(segments.features, 0.001);
  let assigned = 0;
  let skipped = 0;

  for (let i = 0; i < collisions.length; i++) {
    const c = collisions[i];
    const lat = parseFloat(c.latitude);
    const lng = parseFloat(c.longitude);
    if (isNaN(lat) || isNaN(lng)) { skipped++; continue; }

    const searchBbox = [lng - 0.0006, lat - 0.0006, lng + 0.0006, lat + 0.0006];
    const candidates = queryGrid(segIndex, searchBbox);
    if (candidates.length === 0) continue;

    const pt = turf.point([lng, lat]);
    let bestDist = 50;
    let bestIdx = -1;

    for (const ci of candidates) {
      try {
        const dist = distToFeature(pt, segments.features[ci]);
        if (dist < bestDist) { bestDist = dist; bestIdx = ci; }
      } catch { /* skip */ }
    }

    if (bestIdx >= 0) {
      segments.features[bestIdx].properties.pedestrian_injuries += parseInt(c.number_of_pedestrians_injured) || 0;
      segments.features[bestIdx].properties.pedestrian_deaths += parseInt(c.number_of_pedestrians_killed) || 0;
      segments.features[bestIdx].properties.crash_count++;
      assigned++;
    }

    if (i > 0 && i % 50000 === 0) console.log(`  Processed ${i}/${collisions.length} (${assigned} assigned)...`);
  }

  console.log(`  ✓ Assigned ${assigned} collisions to block-face segments (skipped ${skipped})`);
  return segments;
}

function buildDevTable(segments, nychaFC) {
  console.log("\n📊 Building development rankings...");

  const nychaBoroughs = {};
  for (const f of nychaFC.features) nychaBoroughs[f.properties.name] = f.properties.borough;

  const devMap = {};
  for (const seg of segments.features) {
    const names = seg.properties.adjacent_nycha || [];
    for (const name of names) {
      if (!devMap[name]) {
        devMap[name] = {
          name, borough: nychaBoroughs[name] || "",
          adjacent_wide_streets: 0,
          total_pedestrian_injuries: 0, total_pedestrian_deaths: 0, total_crashes: 0,
        };
      }
      devMap[name].adjacent_wide_streets++;
      devMap[name].total_pedestrian_injuries += seg.properties.pedestrian_injuries || 0;
      devMap[name].total_pedestrian_deaths += seg.properties.pedestrian_deaths || 0;
      devMap[name].total_crashes += seg.properties.crash_count || 0;
    }
  }

  const table = Object.values(devMap).sort((a, b) => b.total_pedestrian_injuries - a.total_pedestrian_injuries);
  console.log(`  ✓ ${table.length} developments with qualifying block-face segments`);
  return table;
}

// ---- Main ----

async function main() {
  console.log("🏗️  NYCHA Street Safety Data Pipeline v3 (LION block-face)");
  console.log("==========================================================\n");
  const t0 = Date.now();

  const [nychaFC, allStreets, truckData, collisions] = await Promise.all([
    fetchNYCHA(), fetchWideStreets(), fetchTruckRoutes(), fetchCollisions(),
  ]);
  console.log(`\n⏱️  Fetch complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Tag segments that are truck routes (but don't exclude them)
  console.log("\n🚛 Tagging truck route segments...");
  const { streetNames: truckNames, features: truckFC } = truckData;
  const truckIndex = buildGridIndex(truckFC.features, 0.002);
  let taggedTruck = 0;
  for (const seg of allStreets.features) {
    const segName = (seg.properties.street_name || "").toUpperCase().trim();
    let isTruck = false;
    if (segName && truckNames.has(segName)) isTruck = true;
    if (!isTruck) {
      try {
        const midpoint = turf.pointOnFeature(seg);
        const midBbox = [
          midpoint.geometry.coordinates[0] - 0.0002,
          midpoint.geometry.coordinates[1] - 0.0002,
          midpoint.geometry.coordinates[0] + 0.0002,
          midpoint.geometry.coordinates[1] + 0.0002,
        ];
        const candidates = queryGrid(truckIndex, midBbox);
        for (const ci of candidates) {
          try {
            const dist = distToFeature(midpoint, truckFC.features[ci]);
            if (dist < 15) { isTruck = true; break; }
          } catch {}
        }
      } catch {}
    }
    seg.properties.is_truck_route = isTruck;
    if (isTruck) taggedTruck++;
  }
  console.log(`  ✓ Tagged ${taggedTruck} of ${allStreets.features.length} segments as truck routes`);

  const nearNYCHA = findSegmentsNearNYCHA(allStreets, nychaFC);
  const withCrashes = assignCollisions(nearNYCHA, collisions);
  const devTable = buildDevTable(withCrashes, nychaFC);

  // Enrich NYCHA polygons
  const devLookup = {};
  for (const d of devTable) devLookup[d.name] = d;
  for (const f of nychaFC.features) {
    const stats = devLookup[f.properties.name];
    if (stats) {
      f.properties.adjacent_wide_streets = stats.adjacent_wide_streets;
      f.properties.total_pedestrian_injuries = stats.total_pedestrian_injuries;
      f.properties.total_pedestrian_deaths = stats.total_pedestrian_deaths;
      f.properties.total_crashes = stats.total_crashes;
      f.properties.has_qualifying_streets = true;
    } else {
      f.properties.has_qualifying_streets = false;
    }
  }

  // Serialize arrays for GeoJSON
  for (const seg of withCrashes.features) {
    if (Array.isArray(seg.properties.adjacent_nycha))
      seg.properties.adjacent_nycha = JSON.stringify(seg.properties.adjacent_nycha);
  }

  // Write output
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, "nycha.geojson"), JSON.stringify(nychaFC));
  console.log(`\n✅ nycha.geojson (${nychaFC.features.length} features)`);
  fs.writeFileSync(path.join(OUTPUT_DIR, "segments.geojson"), JSON.stringify(withCrashes));
  console.log(`✅ segments.geojson (${withCrashes.features.length} block-face segments)`);
  fs.writeFileSync(path.join(OUTPUT_DIR, "developments.json"), JSON.stringify(devTable, null, 2));
  console.log(`✅ developments.json (${devTable.length} developments)`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n🎉 Pipeline complete in ${elapsed}s`);
}

main().catch((err) => { console.error("❌ Pipeline failed:", err); process.exit(1); });
