/**
 * NYCHA Street Safety - Data Pipeline (v2 - spatial indexed)
 * 
 * Uses bbox-based spatial indexing for fast lookups instead of O(n²) brute force.
 */

const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");

const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const PAGE_SIZE = 50000;

const URLS = {
  nycha: "https://data.cityofnewyork.us/resource/phvi-damg.json",
  streets: "https://data.cityofnewyork.us/resource/g6zj-tzgn.json",
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

// ---- Simple bbox spatial index ----

function bboxOf(feature) {
  return turf.bbox(feature); // [minX, minY, maxX, maxY]
}

function bboxesOverlap(a, b) {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

// Build a grid-based spatial index
function buildGridIndex(features, cellSize = 0.005) { // ~500m cells
  const grid = {};
  
  for (let i = 0; i < features.length; i++) {
    const bbox = bboxOf(features[i]);
    const minCellX = Math.floor(bbox[0] / cellSize);
    const minCellY = Math.floor(bbox[1] / cellSize);
    const maxCellX = Math.floor(bbox[2] / cellSize);
    const maxCellY = Math.floor(bbox[3] / cellSize);
    
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
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
  const minCellX = Math.floor(bbox[0] / cellSize);
  const minCellY = Math.floor(bbox[1] / cellSize);
  const maxCellX = Math.floor(bbox[2] / cellSize);
  const maxCellY = Math.floor(bbox[3] / cellSize);
  
  const resultSet = new Set();
  for (let cx = minCellX; cx <= maxCellX; cx++) {
    for (let cy = minCellY; cy <= maxCellY; cy++) {
      const key = `${cx},${cy}`;
      if (grid[key]) {
        for (const idx of grid[key]) resultSet.add(idx);
      }
    }
  }
  return [...resultSet];
}

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
  console.log("\n🛣️  Fetching wide streets (>60ft)...");
  const raw = await fetchAllPages(URLS.streets, { $where: "streetwidt > '60'" });
  const features = [];
  for (const r of raw) {
    const width = parseFloat(r.streetwidt);
    if (isNaN(width) || width <= 60) continue;
    const f = makeFeature(r.the_geom, {
      street_name: r.street_nm || "",
      width,
      route_type: r.route_type || "",
      borough: r.borough || "",
    });
    if (f) features.push(f);
  }
  console.log(`  ✓ ${features.length} wide street segments`);
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

// Helper: compute distance from point to a feature that may be MultiLineString
function distToFeature(pt, feature) {
  const geom = feature.geometry;
  if (geom.type === "LineString") {
    return turf.pointToLineDistance(pt, feature, { units: "meters" });
  }
  if (geom.type === "MultiLineString") {
    let minDist = Infinity;
    for (const coords of geom.coordinates) {
      try {
        const line = turf.lineString(coords);
        const d = turf.pointToLineDistance(pt, line, { units: "meters" });
        if (d < minDist) minDist = d;
      } catch { /* skip degenerate lines */ }
    }
    return minDist;
  }
  return Infinity;
}

function excludeTruckRoutes(streets, truckData) {
  console.log("\n🚫 Excluding truck route segments...");
  const { streetNames, features: truckFC } = truckData;
  
  // Build grid index of truck routes for spatial check
  const truckIndex = buildGridIndex(truckFC.features, 0.002);
  
  const before = streets.features.length;
  const filtered = streets.features.filter((seg) => {
    // Name-based exclusion
    const segName = (seg.properties.street_name || "").toUpperCase().trim();
    if (segName && streetNames.has(segName)) return false;
    
    // Route type exclusion
    const rt = (seg.properties.route_type || "").toUpperCase();
    if (rt.includes("TRUCK") || rt.includes("BUS")) return false;
    
    // Spatial proximity check: is segment midpoint within 15m of any truck route?
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
        const truckSeg = truckFC.features[ci];
        try {
          const dist = distToFeature(midpoint, truckSeg);
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
  console.log("\n🏘️  Finding segments near NYCHA (50m buffer)...");
  
  // Buffer each NYCHA polygon by 50m and build index
  const buffered = [];
  for (const f of nychaFC.features) {
    try {
      const buf = turf.buffer(f, 0.05, { units: "kilometers" });
      if (buf) {
        buf.properties = { ...f.properties };
        buffered.push(buf);
      }
    } catch { /* skip invalid */ }
  }
  console.log(`  Buffered ${buffered.length} NYCHA polygons`);
  
  // Build grid index of buffered NYCHA polygons
  const nychaIndex = buildGridIndex(buffered, 0.003);
  
  const qualifying = [];
  let tested = 0;
  
  for (const seg of streets.features) {
    const segBbox = bboxOf(seg);
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
    if (tested % 5000 === 0) console.log(`  Processed ${tested}/${streets.features.length}...`);
  }
  
  console.log(`  ✓ ${qualifying.length} segments adjacent to NYCHA developments`);
  return turf.featureCollection(qualifying);
}

function assignCollisions(segments, collisions) {
  console.log("\n🔗 Assigning collisions to segments...");
  
  // Init crash counts
  for (const seg of segments.features) {
    seg.properties.pedestrian_injuries = 0;
    seg.properties.pedestrian_deaths = 0;
    seg.properties.crash_count = 0;
  }
  
  // Build grid index of segments
  const segIndex = buildGridIndex(segments.features, 0.001);
  
  let assigned = 0;
  let skipped = 0;
  
  for (let i = 0; i < collisions.length; i++) {
    const c = collisions[i];
    const lat = parseFloat(c.latitude);
    const lng = parseFloat(c.longitude);
    if (isNaN(lat) || isNaN(lng)) { skipped++; continue; }
    
    // Search within ~50m radius (wider to catch more)
    const searchBbox = [lng - 0.0006, lat - 0.0006, lng + 0.0006, lat + 0.0006];
    const candidates = queryGrid(segIndex, searchBbox);
    
    if (candidates.length === 0) continue;
    
    const pt = turf.point([lng, lat]);
    let bestDist = 50; // max 50m (street width can be 60ft+ so crashes on the road may be ~30m from centerline)
    let bestIdx = -1;
    
    for (const ci of candidates) {
      try {
        const dist = distToFeature(pt, segments.features[ci]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = ci;
        }
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
  
  console.log(`  ✓ Assigned ${assigned} collisions to segments (skipped ${skipped})`);
  return segments;
}

function buildDevTable(segments, nychaFC) {
  console.log("\n📊 Building development rankings...");
  
  const devMap = {};
  
  // Get borough info from NYCHA features
  const nychaBoroughs = {};
  for (const f of nychaFC.features) {
    nychaBoroughs[f.properties.name] = f.properties.borough;
  }
  
  for (const seg of segments.features) {
    const names = seg.properties.adjacent_nycha || [];
    for (const name of names) {
      if (!devMap[name]) {
        devMap[name] = {
          name,
          borough: nychaBoroughs[name] || "",
          adjacent_wide_streets: 0,
          total_pedestrian_injuries: 0,
          total_pedestrian_deaths: 0,
          total_crashes: 0,
        };
      }
      devMap[name].adjacent_wide_streets++;
      devMap[name].total_pedestrian_injuries += seg.properties.pedestrian_injuries || 0;
      devMap[name].total_pedestrian_deaths += seg.properties.pedestrian_deaths || 0;
      devMap[name].total_crashes += seg.properties.crash_count || 0;
    }
  }
  
  const table = Object.values(devMap).sort((a, b) => b.total_pedestrian_injuries - a.total_pedestrian_injuries);
  console.log(`  ✓ ${table.length} developments with qualifying streets`);
  return table;
}

// ---- Main ----

async function main() {
  console.log("🏗️  NYCHA Street Safety Data Pipeline v2 (spatial-indexed)");
  console.log("==========================================================\n");
  const t0 = Date.now();
  
  // Parallel fetch
  const [nychaFC, allStreets, truckData, collisions] = await Promise.all([
    fetchNYCHA(),
    fetchWideStreets(),
    fetchTruckRoutes(),
    fetchCollisions(),
  ]);
  
  console.log(`\n⏱️  Fetch complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  
  // Process
  const noTrucks = excludeTruckRoutes(allStreets, truckData);
  const nearNYCHA = findSegmentsNearNYCHA(noTrucks, nychaFC);
  const withCrashes = assignCollisions(nearNYCHA, collisions);
  const devTable = buildDevTable(withCrashes, nychaFC);
  
  // Enrich NYCHA polygons with stats
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
  
  // Serialize adjacent_nycha arrays to JSON strings for GeoJSON compatibility
  for (const seg of withCrashes.features) {
    if (Array.isArray(seg.properties.adjacent_nycha)) {
      seg.properties.adjacent_nycha = JSON.stringify(seg.properties.adjacent_nycha);
    }
  }
  
  // Write output
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  fs.writeFileSync(path.join(OUTPUT_DIR, "nycha.geojson"), JSON.stringify(nychaFC));
  console.log(`\n✅ nycha.geojson (${nychaFC.features.length} features)`);
  
  fs.writeFileSync(path.join(OUTPUT_DIR, "segments.geojson"), JSON.stringify(withCrashes));
  console.log(`✅ segments.geojson (${withCrashes.features.length} features)`);
  
  fs.writeFileSync(path.join(OUTPUT_DIR, "developments.json"), JSON.stringify(devTable, null, 2));
  console.log(`✅ developments.json (${devTable.length} developments)`);
  
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n🎉 Pipeline complete in ${elapsed}s`);
}

main().catch((err) => { console.error("❌ Pipeline failed:", err); process.exit(1); });
