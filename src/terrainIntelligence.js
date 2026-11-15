/**
 * MARS X MISSION terrain intelligence (framework-agnostic ES module)
 * Reads the static files produced by scripts/process_dem.py. No live NASA calls.
 *
 *   import { loadTerrainEngine } from './terrainIntelligence.js';
 *   const engine = await loadTerrainEngine({ baseUrl: '/data' });
 *   const info = engine.query(137.4, -5.1);       // click -> panel data
 *   const prof = engine.profile(routeLonLatArray); // elevation profile
 */

export const MARS_RADIUS_M = 3396190;
export const REGION = { west: 77.0, east: 78.0, south: 18.0, north: 19.0 };

// Prototype GAME thresholds - not official NASA rover safety limits.
export const SLOPE_BANDS = [
  { id: 'easy', min: 0, max: 10, label: 'Easy', color: '#3fb27f' },
  { id: 'moderate', min: 10, max: 20, label: 'Moderate', color: '#e0b43a' },
  { id: 'difficult', min: 20, max: 30, label: 'Difficult', color: '#e2762b' },
  { id: 'avoid', min: 30, max: 91, label: 'Avoid', color: '#d9412f' },
];
export const BAND_NOTE = 'Prototype game thresholds, not official NASA rover safety limits.';

// Honest status labels shown next to every value in the UI.
export const STATUS = {
  elevation: 'Observed (DEM product)',
  slope: 'Derived from DEM',
  roughness: 'Derived from DEM',
  terrain: 'Interpreted (rule-based candidate)',
  difficulty: 'Simulated (game score)',
};

const toRad = (d) => (d * Math.PI) / 180;

export function haversineM(lon1, lat1, lon2, lat2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const insideRegion = (lon, lat) =>
  lon >= REGION.west && lon <= REGION.east && lat >= REGION.south && lat <= REGION.north;

export const slopeBand = (deg) => (deg == null ? null : SLOPE_BANDS.find((b) => deg >= b.min && deg < b.max) || SLOPE_BANDS[3]);

async function fetchJson(url, optional = false) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

export async function loadTerrainEngine({ baseUrl = '/data' } = {}) {
  const [grid, meta, targets, details, radiation] = await Promise.all([
    fetchJson(`${baseUrl}/terrain_grid.json`),
    fetchJson(`${baseUrl}/layers_metadata.json`, true),
    fetchJson(`${baseUrl}/science/science_targets.geojson`, true),
    fetchJson(`${baseUrl}/science/science_target_details.json`, true),
    fetchJson(`${baseUrl}/radiation/radiation_summary.json`, true),
  ]);
  return new TerrainEngine({ grid, meta: meta || [], targets, details, radiation });
}

export class TerrainEngine {
  constructor({ grid, meta, targets, details, radiation }) {
    this.grid = grid;
    this.meta = meta;
    this.targets = targets;
    this.details = details;
    this.radiation = radiation;
  }

  layerMeta(name) {
    return this.meta.find((m) => m.name === name) || null;
  }

  /** Column/row of the grid cell for a lon/lat, or null outside the region. */
  cell(lon, lat) {
    const { bounds: b, width, height } = this.grid;
    if (!insideRegion(lon, lat)) return null;
    const col = Math.min(width - 1, Math.floor(((lon - b.west) / (b.east - b.west)) * width));
    const row = Math.min(height - 1, Math.floor(((b.north - lat) / (b.north - b.south)) * height));
    return { col, row, idx: row * width + col };
  }

  /** Everything the terrain panel needs for one map click. Missing data is null, never 0. */
  query(lon, lat) {
    const c = this.cell(lon, lat);
    if (!c) return { status: 'outside_region', lon, lat, message: 'Outside the MARS X MISSION project region.' };
    const L = this.grid.layers;
    const elevation = L.elevation[c.idx];
    const slope = L.slope[c.idx];
    const roughness = L.roughness[c.idx];
    const code = L.terrain[c.idx];
    const cls = code ? this.grid.classes[String(code)] : null;
    const band = slopeBand(slope);
    const meta = { elevation: this.layerMeta('elevation'), slope: this.layerMeta('slope'), terrain: this.layerMeta('terrain_classes') };
    const nearest = this.nearestTarget(lon, lat, 5);
    return {
      status: elevation == null ? 'no_data' : 'ok',
      lon, lat,
      elevation_m: elevation,
      slope_deg: slope,
      roughness_m: roughness,
      roughness_method: this.layerMeta('roughness')?.limitations || null,
      terrain_type: cls ? cls.type : null,
      terrain_name: cls ? cls.name : 'No data',
      terrain_caution: cls ? cls.caution : 'No valid data for this location.',
      terrain_confidence: code === 5 ? 'medium' : code ? 'low' : 'unknown',
      difficulty: band ? { id: band.id, label: band.label, color: band.color, note: BAND_NOTE } : null,
      status_labels: STATUS,
      source: {
        elevation: meta.elevation && { id: meta.elevation.source, url: meta.elevation.url, instrument: meta.elevation.instrument, resolution_m: meta.elevation.resolution_m },
        limitations: [meta.elevation?.limitations, meta.slope?.limitations, meta.terrain?.limitations].filter(Boolean),
      },
      nearest_target: nearest,
      grid_note: `Query grid cell ~${Math.round(this.cellSizeM())} m; source DEM resolution may be finer.`,
    };
  }

  cellSizeM() {
    const { bounds: b, width } = this.grid;
    const midLat = (b.north + b.south) / 2;
    return haversineM(b.west, midLat, b.east, midLat) / width;
  }

  nearestTarget(lon, lat, maxKm = 5) {
    const feats = this.targets?.features || [];
    let best = null;
    for (const f of feats) {
      if (f.geometry?.type !== 'Point') continue;
      const [tl, tt] = f.geometry.coordinates; // GeoJSON order: lon, lat
      const d = haversineM(lon, lat, tl, tt);
      if (d <= maxKm * 1000 && (!best || d < best.distance_m)) {
        const id = f.properties.id;
        best = { id, name: f.properties.name, category: f.properties.category, distance_m: Math.round(d),
          coordinate_confidence: f.properties.coordinate_confidence, details: this.details?.[id] || null };
      }
    }
    return best;
  }

  /** route: [[lon,lat], ...]. Returns samples plus an honest summary. */
  profile(route, stepM = 100) {
    const samples = [];
    let dist = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const [a, b] = [route[i], route[i + 1]];
      const seg = haversineM(a[0], a[1], b[0], b[1]);
      const n = Math.max(1, Math.round(seg / stepM));
      for (let k = (i === 0 ? 0 : 1); k <= n; k++) {
        const t = k / n;
        const lon = a[0] + (b[0] - a[0]) * t;
        const lat = a[1] + (b[1] - a[1]) * t;
        const q = this.cell(lon, lat);
        samples.push({
          distance_m: Math.round(dist + seg * t), lon, lat,
          elevation_m: q ? this.grid.layers.elevation[q.idx] : null,
          slope_deg: q ? this.grid.layers.slope[q.idx] : null,
        });
      }
      dist += seg;
    }
    const valid = samples.filter((s) => s.elevation_m != null);
    let gain = 0, loss = 0;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1].elevation_m, b = samples[i].elevation_m;
      if (a == null || b == null) continue; // never bridge gaps with zeros
      if (b > a) gain += b - a; else loss += a - b;
    }
    const slopes = samples.map((s) => s.slope_deg).filter((s) => s != null);
    const bandShare = Object.fromEntries(SLOPE_BANDS.map((b) => [b.id, 0]));
    slopes.forEach((s) => { bandShare[slopeBand(s).id] += 1; });
    Object.keys(bandShare).forEach((k) => { bandShare[k] = slopes.length ? +(bandShare[k] / slopes.length * 100).toFixed(1) : 0; });
    return {
      samples,
      summary: {
        total_distance_m: Math.round(dist),
        min_elevation_m: valid.length ? Math.min(...valid.map((s) => s.elevation_m)) : null,
        max_elevation_m: valid.length ? Math.max(...valid.map((s) => s.elevation_m)) : null,
        gain_m: Math.round(gain), loss_m: Math.round(loss),
        max_slope_deg: slopes.length ? Math.max(...slopes) : null,
        slope_band_percent: bandShare,
        nodata_samples: samples.length - valid.length,
        status: STATUS.difficulty,
        note: `Terrain summary only, not proof of traversability. ${BAND_NOTE} Sample interval ${stepM} m; DEM-limited detail.`,
      },
    };
  }

  /** Canvas overlay for a map library. layer: 'slope' | 'elevation' | 'hillshade' | 'terrain'. */
  renderOverlay(layer = 'slope') {
    const { width, height, layers } = this.grid;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(width, height);
    const arr = layers[layer];
    const valid = layer === 'elevation' ? arr.filter((v) => v != null) : null;
    const eMin = valid ? Math.min(...valid) : 0, eMax = valid ? Math.max(...valid) : 1;
    const palette = { 1: '#4f8f6b', 2: '#c9a24a', 3: '#9a5a3a', 4: '#7b6aa8', 5: '#d9412f' };
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      let rgba = [0, 0, 0, 0]; // no data stays transparent, never zero-coloured
      if (v != null && !(layer === 'terrain' && v === 0)) {
        if (layer === 'slope') rgba = [...hex(slopeBand(v).color), 170];
        else if (layer === 'hillshade') rgba = [v, v, v, 150];
        else if (layer === 'terrain') rgba = [...hex(palette[v]), 160];
        else { const t = (v - eMin) / (eMax - eMin || 1); rgba = [Math.round(60 + 190 * t), Math.round(40 + 120 * t), Math.round(30 + 60 * t), 170]; }
      }
      img.data.set(rgba, i * 4);
    }
    ctx.putImageData(img, 0, 0);
    const b = this.grid.bounds;
    return { canvas, dataUrl: canvas.toDataURL('image/png'), bounds: { south: b.south, west: b.west, north: b.north, east: b.east } };
  }

  radiationDisplay() {
    const r = this.radiation;
    const unverified = !r || r.value == null || Object.values(r).some((v) => typeof v === 'string' && v.includes('REPLACE_WITH'));
    return unverified ? { available: false, text: 'Data unavailable' } : { available: true, ...r };
  }
}

export const THERMAL_LABEL = 'Brightness temperature (K), observed, not a forecast.';
