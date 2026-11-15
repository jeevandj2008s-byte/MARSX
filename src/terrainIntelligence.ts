/**
 * MARS X MISSION terrain intelligence (framework-agnostic TypeScript module)
 * Reads the static files produced by scripts/process_dem.py. No live NASA calls.
 */

export const MARS_RADIUS_M = 3396190;
export const REGION = { west: 77.0, east: 78.0, south: 18.0, north: 19.0 };

// Prototype GAME thresholds - not official NASA rover safety limits.
export const SLOPE_BANDS = [
  { id: 'easy', min: 0, max: 10, label: 'Easy', color: '#3fb27f' },
  { id: 'moderate', min: 10, max: 20, label: 'Moderate', color: '#e0b43a' },
  { id: 'difficult', min: 20, max: 30, label: 'Difficult', color: '#e2762b' },
  { id: 'avoid', min: 30, max: 91, label: 'Avoid', color: '#d9412f' },
] as const;

export const BAND_NOTE = 'Prototype game thresholds, not official NASA rover safety limits.';

// Honest status labels shown next to every value in the UI.
export const STATUS = {
  elevation: 'Observed (DEM product)',
  slope: 'Derived from DEM',
  roughness: 'Derived from DEM',
  terrain: 'Interpreted (rule-based candidate)',
  difficulty: 'Simulated (game score)',
} as const;

export const THERMAL_LABEL = 'Brightness temperature (K), observed, not a forecast.';

const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const insideRegion = (lon: number, lat: number): boolean =>
  lon >= REGION.west && lon <= REGION.east && lat >= REGION.south && lat <= REGION.north;

export const slopeBand = (deg: number | null) =>
  deg == null
    ? null
    : SLOPE_BANDS.find((b) => deg >= b.min && deg < b.max) || SLOPE_BANDS[3];

export interface LayerMetadata {
  name: string;
  source: string;
  instrument: string;
  date_range: string;
  url: string;
  resolution_m: number;
  units: string;
  crs: string;
  status: string;
  limitations: string;
  processed_on?: string;
  processing?: string;
}

export interface TerrainGridData {
  bounds: { west: number; east: number; south: number; north: number };
  width: number;
  height: number;
  origin: string;
  crs: string;
  classes: Record<string, { type: string; name: string; caution: string }>;
  thresholds: Record<string, number>;
  note: string;
  layers: {
    elevation: Array<number | null>;
    slope: Array<number | null>;
    roughness: Array<number | null>;
    hillshade: Array<number | null>;
    terrain: Array<number | null>;
  };
}

export interface NearestScienceTarget {
  id: string;
  name: string;
  category: string;
  distance_m: number;
  coordinate_confidence: string;
  details: any;
}

export interface TerrainQueryResult {
  status: 'ok' | 'no_data' | 'outside_region';
  lon: number;
  lat: number;
  elevation_m: number | null;
  slope_deg: number | null;
  roughness_m: number | null;
  roughness_method: string | null;
  terrain_type: string | null;
  terrain_name: string;
  terrain_caution: string;
  terrain_confidence: 'high' | 'medium' | 'low' | 'unknown';
  difficulty: {
    id: string;
    label: string;
    color: string;
    note: string;
  } | null;
  status_labels: typeof STATUS;
  source: {
    elevation: {
      id: string;
      url: string;
      instrument: string;
      resolution_m: number;
    } | null;
    limitations: string[];
  };
  nearest_target: NearestScienceTarget | null;
  grid_note: string;
  message?: string;
}

export interface TerrainProfileSample {
  distance_m: number;
  lon: number;
  lat: number;
  elevation_m: number | null;
  slope_deg: number | null;
}

export interface TerrainProfileResult {
  samples: TerrainProfileSample[];
  summary: {
    total_distance_m: number;
    min_elevation_m: number | null;
    max_elevation_m: number | null;
    gain_m: number;
    loss_m: number;
    max_slope_deg: number | null;
    slope_band_percent: Record<string, number>;
    nodata_samples: number;
    status: string;
    note: string;
  };
}

export interface TerrainOverlayResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  bounds: { south: number; west: number; north: number; east: number };
}

export interface RadiationDisplayResult {
  available: boolean;
  text?: string;
  dataset?: string;
  location?: string;
  measurement_type?: string;
  value?: number | null;
  unit?: string;
  period?: string;
  source_publication?: string;
  source_url?: string;
  limitations?: string;
  label?: string;
}

async function fetchJson<T = any>(url: string, optional = false): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

export async function loadTerrainEngine({ baseUrl = '/data' } = {}): Promise<TerrainEngine> {
  const [grid, meta, targets, details, radiation] = await Promise.all([
    fetchJson<TerrainGridData>(`${baseUrl}/terrain_grid.json`, true),
    fetchJson<LayerMetadata[]>(`${baseUrl}/layers_metadata.json`, true),
    fetchJson(`${baseUrl}/science/science_targets.geojson`, true),
    fetchJson(`${baseUrl}/science/science_target_details.json`, true),
    fetchJson(`${baseUrl}/radiation/radiation_summary.json`, true),
  ]);
  return new TerrainEngine({
    grid: grid || null,
    meta: meta || [],
    targets,
    details,
    radiation,
  });
}

export class TerrainEngine {
  grid: TerrainGridData | null;
  meta: LayerMetadata[];
  targets: any;
  details: any;
  radiation: any;

  constructor({
    grid,
    meta,
    targets,
    details,
    radiation,
  }: {
    grid: TerrainGridData | null;
    meta: LayerMetadata[];
    targets: any;
    details: any;
    radiation: any;
  }) {
    this.grid = grid;
    this.meta = meta;
    this.targets = targets;
    this.details = details;
    this.radiation = radiation;
  }

  layerMeta(name: string): LayerMetadata | null {
    return this.meta.find((m) => m.name === name) || null;
  }

  /** Column/row of the grid cell for a lon/lat, or null outside the region or if grid not loaded. */
  cell(lon: number, lat: number): { col: number; row: number; idx: number } | null {
    if (!this.grid || !this.grid.width || !this.grid.height || !this.grid.bounds) return null;
    const { bounds: b, width, height } = this.grid;
    if (!insideRegion(lon, lat)) return null;
    const col = Math.min(
      width - 1,
      Math.max(0, Math.floor(((lon - b.west) / (b.east - b.west)) * width))
    );
    const row = Math.min(
      height - 1,
      Math.max(0, Math.floor(((b.north - lat) / (b.north - b.south)) * height))
    );
    return { col, row, idx: row * width + col };
  }

  /** Everything the terrain panel needs for one map click. Missing data is null, never 0. */
  query(lon: number, lat: number): TerrainQueryResult {
    if (!insideRegion(lon, lat)) {
      return {
        status: 'outside_region',
        lon,
        lat,
        elevation_m: null,
        slope_deg: null,
        roughness_m: null,
        roughness_method: null,
        terrain_type: null,
        terrain_name: 'Outside region',
        terrain_caution: 'Outside the MARS X MISSION project region (77.0°E - 78.0°E, 18.0°N - 19.0°N).',
        terrain_confidence: 'unknown',
        difficulty: null,
        status_labels: STATUS,
        source: {
          elevation: null,
          limitations: ['Outside project region'],
        },
        nearest_target: null,
        grid_note: 'Coordinates fall outside the Jezero Crater project bounds.',
        message: 'Outside the MARS X MISSION project region.',
      };
    }

    const c = this.cell(lon, lat);
    const L = this.grid?.layers;
    const elevation = c && L?.elevation ? L.elevation[c.idx] ?? null : null;
    const slope = c && L?.slope ? L.slope[c.idx] ?? null : null;
    const roughness = c && L?.roughness ? L.roughness[c.idx] ?? null : null;
    const code = c && L?.terrain ? L.terrain[c.idx] ?? null : null;
    const cls = code ? this.grid?.classes?.[String(code)] ?? null : null;
    const band = slopeBand(slope);
    const meta = {
      elevation: this.layerMeta('elevation'),
      slope: this.layerMeta('slope'),
      terrain: this.layerMeta('terrain_classes'),
    };
    const nearest = this.nearestTarget(lon, lat, 5);

    return {
      status: elevation == null ? 'no_data' : 'ok',
      lon,
      lat,
      elevation_m: elevation,
      slope_deg: slope,
      roughness_m: roughness,
      roughness_method: this.layerMeta('roughness')?.limitations || null,
      terrain_type: cls ? cls.type : null,
      terrain_name: cls ? cls.name : 'No data',
      terrain_caution: cls ? cls.caution : 'No valid DEM data available for this location.',
      terrain_confidence: code === 5 ? 'medium' : code ? 'low' : 'unknown',
      difficulty: band
        ? { id: band.id, label: band.label, color: band.color, note: BAND_NOTE }
        : null,
      status_labels: STATUS,
      source: {
        elevation: meta.elevation && {
          id: meta.elevation.source,
          url: meta.elevation.url,
          instrument: meta.elevation.instrument,
          resolution_m: meta.elevation.resolution_m,
        },
        limitations: [
          meta.elevation?.limitations,
          meta.slope?.limitations,
          meta.terrain?.limitations,
        ].filter(Boolean) as string[],
      },
      nearest_target: nearest,
      grid_note: this.grid
        ? `Query grid cell ~${Math.round(this.cellSizeM())} m; source DEM resolution may be finer.`
        : 'Grid pending DEM clipping.',
    };
  }

  cellSizeM(): number {
    if (!this.grid) return 0;
    const { bounds: b, width } = this.grid;
    const midLat = (b.north + b.south) / 2;
    return haversineM(b.west, midLat, b.east, midLat) / width;
  }

  nearestTarget(lon: number, lat: number, maxKm = 5): NearestScienceTarget | null {
    const feats = this.targets?.features || [];
    let best: NearestScienceTarget | null = null;
    for (const f of feats) {
      if (f.geometry?.type !== 'Point') continue;
      const [tl, tt] = f.geometry.coordinates; // GeoJSON order: lon, lat
      const d = haversineM(lon, lat, tl, tt);
      if (d <= maxKm * 1000 && (!best || d < best.distance_m)) {
        const id = f.properties.id;
        best = {
          id,
          name: f.properties.name,
          category: f.properties.category,
          distance_m: Math.round(d),
          coordinate_confidence: f.properties.coordinate_confidence,
          details: this.details?.[id] || null,
        };
      }
    }
    return best;
  }

  /** route: [[lon,lat], ...]. Returns samples plus an honest summary. */
  profile(route: Array<[number, number]>, stepM = 100): TerrainProfileResult {
    const samples: TerrainProfileSample[] = [];
    let dist = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const [a, b] = [route[i], route[i + 1]];
      const seg = haversineM(a[0], a[1], b[0], b[1]);
      const n = Math.max(1, Math.round(seg / stepM));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n;
        const lon = a[0] + (b[0] - a[0]) * t;
        const lat = a[1] + (b[1] - a[1]) * t;
        const q = this.cell(lon, lat);
        samples.push({
          distance_m: Math.round(dist + seg * t),
          lon,
          lat,
          elevation_m:
            q && this.grid?.layers?.elevation
              ? this.grid.layers.elevation[q.idx] ?? null
              : null,
          slope_deg:
            q && this.grid?.layers?.slope ? this.grid.layers.slope[q.idx] ?? null : null,
        });
      }
      dist += seg;
    }
    const valid = samples.filter((s) => s.elevation_m != null);
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1].elevation_m;
      const b = samples[i].elevation_m;
      if (a == null || b == null) continue; // never bridge gaps with zeros
      if (b > a) gain += b - a;
      else loss += a - b;
    }
    const slopes = samples.map((s) => s.slope_deg).filter((s): s is number => s != null);
    const bandShare: Record<string, number> = Object.fromEntries(
      SLOPE_BANDS.map((b) => [b.id, 0])
    );
    slopes.forEach((s) => {
      const band = slopeBand(s);
      if (band) bandShare[band.id] += 1;
    });
    Object.keys(bandShare).forEach((k) => {
      bandShare[k] = slopes.length
        ? +((bandShare[k] / slopes.length) * 100).toFixed(1)
        : 0;
    });
    return {
      samples,
      summary: {
        total_distance_m: Math.round(dist),
        min_elevation_m: valid.length ? Math.min(...valid.map((s) => s.elevation_m!)) : null,
        max_elevation_m: valid.length ? Math.max(...valid.map((s) => s.elevation_m!)) : null,
        gain_m: Math.round(gain),
        loss_m: Math.round(loss),
        max_slope_deg: slopes.length ? Math.max(...slopes) : null,
        slope_band_percent: bandShare,
        nodata_samples: samples.length - valid.length,
        status: STATUS.difficulty,
        note: `Terrain summary only, not proof of traversability. ${BAND_NOTE} Sample interval ${stepM} m; DEM-limited detail.`,
      },
    };
  }

  /** Canvas overlay for a map library. layer: 'slope' | 'elevation' | 'hillshade' | 'terrain'. */
  renderOverlay(
    layer: 'slope' | 'elevation' | 'hillshade' | 'terrain' = 'slope'
  ): TerrainOverlayResult | null {
    if (!this.grid || !this.grid.layers || !this.grid.layers[layer]) return null;
    const { width, height, layers } = this.grid;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(width, height);
    const arr = layers[layer];
    const valid =
      layer === 'elevation'
        ? (arr.filter((v) => v != null) as number[])
        : null;
    const eMin = valid && valid.length ? Math.min(...valid) : 0;
    const eMax = valid && valid.length ? Math.max(...valid) : 1;
    const palette: Record<number, string> = {
      1: '#4f8f6b',
      2: '#c9a24a',
      3: '#9a5a3a',
      4: '#7b6aa8',
      5: '#d9412f',
    };
    const hex = (h: string): [number, number, number] => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];

    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      let rgba: [number, number, number, number] = [0, 0, 0, 0]; // no data stays transparent, never zero-coloured
      if (v != null && !(layer === 'terrain' && v === 0)) {
        if (layer === 'slope') {
          const b = slopeBand(v);
          rgba = [...hex(b ? b.color : '#d9412f'), 170];
        } else if (layer === 'hillshade') {
          rgba = [v, v, v, 150];
        } else if (layer === 'terrain') {
          const color = palette[v] || '#888888';
          rgba = [...hex(color), 160];
        } else {
          const t = (v - eMin) / (eMax - eMin || 1);
          rgba = [
            Math.round(60 + 190 * t),
            Math.round(40 + 120 * t),
            Math.round(30 + 60 * t),
            170,
          ];
        }
      }
      img.data.set(rgba, i * 4);
    }
    ctx.putImageData(img, 0, 0);
    const b = this.grid.bounds;
    return {
      canvas,
      dataUrl: canvas.toDataURL('image/png'),
      bounds: { south: b.south, west: b.west, north: b.north, east: b.east },
    };
  }

  radiationDisplay(): RadiationDisplayResult {
    const r = this.radiation;
    const unverified =
      !r ||
      r.value == null ||
      Object.values(r).some((v) => typeof v === 'string' && v.includes('REPLACE_WITH'));
    return unverified
      ? {
          available: false,
          text: 'Data unavailable',
          label: 'Historical rover measurement',
          limitations: 'Historical rover measurement; not a prediction for an astronaut.',
        }
      : { available: true, label: 'Historical rover measurement', ...r };
  }
}
