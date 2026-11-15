/**
 * ROVERSE EVA Route Planner View (Vanilla DOM + SVG, zero external framework dependencies)
 * Faithful implementation of Jezero Crater crewed EVA traverse report.
 * Inherits the ROVERSE theme via CSS variables: --eva-accent, --eva-ok, --eva-bad, --eva-panel, --eva-line.
 */
import { plan, runScenarios, verify, fmtHM } from './evaPlanner.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

const n = (x, d = 1) =>
  x == null
    ? 'No data'
    : Number(x).toLocaleString('en-US', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });

const css = `
.eva {
  display: grid;
  gap: 18px;
  font-family: inherit;
  color: inherit;
  font-size: 13px;
  line-height: 1.5;
}
.eva * {
  box-sizing: border-box;
}
.eva .panel {
  border: 1px solid var(--eva-line, rgba(255, 255, 255, 0.08));
  background: var(--eva-panel, rgba(20, 15, 13, 0.75));
  border-radius: 16px;
  padding: 16px 20px;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  overflow-x: auto;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
}
.eva h3 {
  margin: 0 0 12px;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted, #B8AEA2);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.eva .cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.eva .card {
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--eva-line, rgba(255, 255, 255, 0.06));
  border-radius: 12px;
  padding: 12px 14px;
  position: relative;
}
.eva .card b {
  display: block;
  font-size: 1.35rem;
  font-family: var(--font-mono, monospace);
  font-variant-numeric: tabular-nums;
  color: var(--text, #F7F2E8);
  font-weight: 600;
  letter-spacing: -0.02em;
}
.eva .card span {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-muted, #B8AEA2);
  line-height: 1.35;
}
.eva .card .badge {
  position: absolute;
  top: 8px;
  right: 8px;
}
.eva table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  font-family: inherit;
}
.eva th {
  padding: 8px 10px;
  text-align: right;
  border-bottom: 1px solid var(--eva-line, rgba(255, 255, 255, 0.12));
  color: var(--text-muted, #B8AEA2);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.eva td {
  padding: 8px 10px;
  text-align: right;
  border-bottom: 1px solid var(--eva-line, rgba(255, 255, 255, 0.06));
  white-space: nowrap;
  font-family: var(--font-mono, monospace);
  font-variant-numeric: tabular-nums;
  color: var(--text, #F7F2E8);
}
.eva th:first-child,
.eva td:first-child,
.eva td.l,
.eva th.l {
  text-align: left;
}
.eva tr:hover td {
  background: rgba(255, 255, 255, 0.035);
}
.eva tr.highlighted td {
  background: rgba(238, 88, 34, 0.18) !important;
  color: #fff;
}
.eva .bad {
  color: var(--eva-bad, #E5481B) !important;
}
.eva .ok {
  color: var(--eva-ok, #14B87F) !important;
}
.eva .warn {
  color: var(--secondary, #E8A838) !important;
}
.eva .controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}
.eva label {
  font-size: 11px;
  color: var(--text-muted, #B8AEA2);
  display: grid;
  gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.eva input,
.eva select {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text, #F7F2E8);
  border: 1px solid var(--eva-line, rgba(255, 255, 255, 0.16));
  border-radius: 8px;
  padding: 6px 10px;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  min-width: 100px;
}
.eva td input {
  width: 72px;
  min-width: 60px;
  padding: 4px 6px;
  font-size: 12px;
}
.eva button {
  background: var(--surface-2, rgba(255, 255, 255, 0.07));
  color: var(--text, #F7F2E8);
  border: 1px solid var(--eva-line, rgba(255, 255, 255, 0.15));
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}
.eva button:hover {
  background: var(--surface-3, rgba(255, 255, 255, 0.12));
  border-color: var(--eva-accent, #EE5822);
  color: #FFF;
}
.eva .bar {
  display: flex;
  height: 16px;
  border-radius: 6px;
  overflow: hidden;
  margin: 10px 0 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.eva .bar i {
  display: block;
  min-width: 2px;
  transition: flex 0.3s ease;
}
.eva .note {
  font-size: 11px;
  color: var(--text-muted, #B8AEA2);
  margin: 8px 0 0;
  line-height: 1.45;
}
.eva .badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.eva .badge.obs {
  background: rgba(20, 184, 127, 0.15);
  color: var(--eva-ok, #14B87F);
  border: 1px solid rgba(20, 184, 127, 0.3);
}
.eva .badge.der {
  background: rgba(59, 130, 246, 0.15);
  color: #60A5FA;
  border: 1px solid rgba(59, 130, 246, 0.3);
}
.eva .badge.asm {
  background: rgba(232, 168, 56, 0.15);
  color: var(--secondary, #E8A838);
  border: 1px solid rgba(232, 168, 56, 0.3);
}
.eva .legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted, #B8AEA2);
  margin: 8px 0;
  align-items: center;
}
.eva .legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.eva .legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}
.eva details summary {
  cursor: pointer;
  padding: 8px 0;
  color: var(--eva-accent, #EE5822);
  font-weight: 500;
  user-select: none;
}
.eva .findings-box {
  background: rgba(238, 88, 34, 0.08);
  border: 1px solid rgba(238, 88, 34, 0.25);
  border-radius: 12px;
  padding: 14px 16px;
  margin-top: 14px;
}
.eva .findings-box h4 {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--eva-accent, #EE5822);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.eva .findings-box ul {
  margin: 0;
  padding-left: 18px;
  color: var(--text-muted, #B8AEA2);
  font-size: 11px;
  line-height: 1.5;
}
.eva .map-container {
  width: 100%;
  position: relative;
  background: #0B0807;
  border: 1px solid var(--eva-line, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  overflow: hidden;
}
.eva .map-popup {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  max-width: 480px;
  background: rgba(16, 13, 11, 0.94);
  border: 1px solid var(--eva-accent, #EE5822);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
  z-index: 10;
  backdrop-filter: blur(10px);
  pointer-events: auto;
}
`;

function getSlopeColor(deg) {
  if (deg < 10) return '#14B87F'; // 0-10 Easy
  if (deg < 20) return '#E8A838'; // 10-20 Moderate
  if (deg < 30) return '#EE5822'; // 20-30 Difficult
  return '#991B1B'; // >30 Avoid
}

export function mountEvaPlanner(root, scenario, { compute } = {}) {
  const state = {
    overrides: { config: {}, speeds: {} },
    scenario,
    selectedSegmentIndex: null,
    selectedWaypointId: null,
  };

  if (!document.getElementById('eva-css')) {
    document.head.insertAdjacentHTML('beforeend', `<style id="eva-css">${css}</style>`);
  }

  const run = async () => {
    const sc = structuredClone(state.scenario);
    sc.segments.forEach((s, i) => {
      if (state.overrides.speeds[i] != null && state.overrides.speeds[i] > 0) {
        s.speed_ms = state.overrides.speeds[i];
      }
    });
    Object.assign(sc.config, state.overrides.config);

    // Edited speeds/config make report's fixed contingency invalid: switch to proportional
    const edited =
      Object.keys(state.overrides.speeds).length > 0 ||
      Object.keys(state.overrides.config).some((k) => k !== 'eva_limit_min');
    if (edited) {
      sc.config.contingency_mode = 'proportional';
    }

    let res;
    if (compute) {
      try {
        res = await compute(sc);
      } catch (e) {
        console.warn('Backend compute failed, falling back to client engine:', e);
        res = plan(sc);
      }
    } else {
      res = plan(sc);
    }

    draw(res, sc, edited);
  };

  function renderMap(res, sc) {
    const W = 880;
    const H = 340;
    const m = { l: 45, r: 45, t: 40, b: 40 };

    const wps = sc.waypoints;
    const lons = wps.map((w) => w.lon);
    const lats = wps.map((w) => w.lat);
    const minLon = Math.min(...lons) - 0.015;
    const maxLon = Math.max(...lons) + 0.015;
    const minLat = Math.min(...lats) - 0.01;
    const maxLat = Math.max(...lats) + 0.01;

    // Projection helpers (Mercator/Equirectangular for small regional tile)
    const X = (lon) => m.l + ((lon - minLon) / (maxLon - minLon)) * (W - m.l - m.r);
    const Y = (lat) => H - m.b - ((lat - minLat) / (maxLat - minLat)) * (H - m.t - m.b);

    // Polyline segments with slope colors and interactive click/hover
    const segmentsSvg = res.segments
      .map((s) => {
        const p1 = wps.find((w) => w.id === s.from_id);
        const p2 = wps.find((w) => w.id === s.to_id);
        if (!p1 || !p2) return '';
        const x1 = X(p1.lon).toFixed(1);
        const y1 = Y(p1.lat).toFixed(1);
        const x2 = X(p2.lon).toFixed(1);
        const y2 = Y(p2.lat).toFixed(1);
        const stroke = getSlopeColor(s.slope_deg);
        const isSel = state.selectedSegmentIndex === s.index;
        const width = isSel ? 6 : 3;
        const opacity = isSel ? 1 : 0.85;

        return `
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"
                data-seg-idx="${s.index}" style="cursor:pointer; transition: stroke-width 0.15s ease;">
            <title>Seg ${s.index}: ${esc(s.from)} → ${esc(s.to)} (${n(s.slope_deg, 2)}° slope, ${n(s.d3d_m, 1)} m)</title>
          </line>
        `;
      })
      .join('');

    // Numbered Waypoint markers
    const wpMap = Object.fromEntries(wps.map((w) => [w.id, w]));
    const markersSvg = wps
      .map((w, idx) => {
        const cx = X(w.lon).toFixed(1);
        const cy = Y(w.lat).toFixed(1);
        const isSel = state.selectedWaypointId === w.id;
        const r = isSel ? 11 : 9;
        const fill = isSel ? 'var(--eva-accent, #EE5822)' : 'rgba(25, 18, 15, 0.9)';
        const stroke = isSel ? '#FFF' : 'var(--eva-accent, #EE5822)';
        const textFill = isSel ? '#000' : 'var(--text, #F7F2E8)';

        return `
          <g data-wp-id="${w.id}" style="cursor:pointer;" class="wp-node">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
            <text x="${cx}" y="${Number(cy) + 3.5}" text-anchor="middle" font-size="10" font-weight="700" 
                  fill="${textFill}" font-family="var(--font-mono, monospace)">${w.id}</text>
            <text x="${cx}" y="${Number(cy) - 13}" text-anchor="middle" font-size="9" 
                  fill="var(--text-muted, #B8AEA2)" font-family="var(--font-mono, monospace)" opacity="0.85">WP-${w.id}</text>
          </g>
        `;
      })
      .join('');

    // Background grid lines (lat & lon references)
    const latGrid = [18.42, 18.44, 18.46, 18.48]
      .filter((l) => l >= minLat && l <= maxLat)
      .map((lat) => {
        const y = Y(lat);
        return `
        <line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3"/>
        <text x="${m.l - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="rgba(255,255,255,0.4)" font-family="var(--font-mono, monospace)">${lat.toFixed(2)}°N</text>
      `;
      })
      .join('');

    const lonGrid = [77.30, 77.35, 77.40, 77.45]
      .filter((l) => l >= minLon && l <= maxLon)
      .map((lon) => {
        const x = X(lon);
        return `
        <line x1="${x}" x2="${x}" y1="${m.t}" y2="${H - m.b}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3"/>
        <text x="${x}" y="${H - m.b + 15}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.4)" font-family="var(--font-mono, monospace)">${lon.toFixed(2)}°E</text>
      `;
      })
      .join('');

    // Active popup card content if a waypoint is selected
    let popupHtml = '';
    if (state.selectedWaypointId != null) {
      const sw = wpMap[state.selectedWaypointId];
      if (sw) {
        const metEntry = res.met.find((m) => m.waypoint === sw.name || m.waypoint === sw.id);
        const metClock = metEntry ? metEntry.clock : '--:--';
        const sciMin = sc.science_stops_min[String(sw.id)] ?? 0;
        const sciAct = sc.science_activities[String(sw.id)] || 'Traverse navigation datum.';

        popupHtml = `
          <div class="map-popup">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
              <div>
                <span class="badge obs">Observed</span>
                <span style="font-size:13px; font-weight:600; color:var(--text, #F7F2E8); margin-left:6px;">WP-${sw.id}: ${esc(sw.name)}</span>
              </div>
              <button type="button" data-close-popup style="background:transparent; border:none; padding:0; color:var(--text-muted, #B8AEA2); font-size:16px; cursor:pointer;">&times;</button>
            </div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin:8px 0; font-family:var(--font-mono, monospace); font-size:11px;">
              <div><span style="color:var(--text-muted); display:block; font-size:10px;">COORDS</span>${sw.lat.toFixed(4)}°N, ${sw.lon.toFixed(4)}°E</div>
              <div><span style="color:var(--text-muted); display:block; font-size:10px;">ELEVATION</span>${sw.elevation_m} m</div>
              <div><span style="color:var(--text-muted); display:block; font-size:10px;">CUMULATIVE MET</span>${metClock}</div>
            </div>
            <div style="font-size:11px; margin-top:6px; color:var(--text-muted);">
              <b>Geology:</b> ${esc(sw.unit)}
            </div>
            <div style="font-size:11px; margin-top:4px; color:var(--eva-accent, #EE5822);">
              <b>Science Stop (${sciMin} min):</b> ${esc(sciAct)}
            </div>
          </div>
        `;
      }
    }

    return `
      <div class="map-container">
        <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Jezero Crater EVA Route Map" style="display:block;">
          <!-- Martian surface subtle background tint -->
          <rect width="${W}" height="${H}" fill="#100D0B"/>
          <!-- Grid lines -->
          ${latGrid}
          ${lonGrid}
          <!-- Traverse route polyline -->
          ${segmentsSvg}
          <!-- Waypoint markers -->
          ${markersSvg}
        </svg>
        ${popupHtml}
      </div>
      <div class="legend-row">
        <span style="font-weight:600; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Slope bands:</span>
        <div class="legend-item"><span class="legend-color" style="background:#14B87F"></span> 0–10° Easy</div>
        <div class="legend-item"><span class="legend-color" style="background:#E8A838"></span> 10–20° Moderate</div>
        <div class="legend-item"><span class="legend-color" style="background:#EE5822"></span> 20–30° Difficult</div>
        <div class="legend-item"><span class="legend-color" style="background:#991B1B"></span> &gt;30° Avoid</div>
        <span style="opacity:0.6; font-size:10px; margin-left:auto;">*Prototype thresholds, not official NASA limits. Click segment/marker to inspect.</span>
      </div>
    `;
  }

  function chart(res) {
    const P = res.profile;
    const W = 880;
    const H = 200;
    const m = { l: 60, r: 24, t: 16, b: 32 };
    const xs = P.map((p) => p.distance_m);
    const ys = P.map((p) => p.elevation_m);
    const x0 = 0;
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys) - 30;
    const y1 = Math.max(...ys) + 30;

    const X = (v) => m.l + ((v - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
    const Y = (v) => H - m.b - ((v - y0) / (y1 - y0 || 1)) * (H - m.t - m.b);

    const path = P.map((p, i) => `${i ? 'L' : 'M'}${X(p.distance_m).toFixed(1)},${Y(p.elevation_m).toFixed(1)}`).join('');
    const area = `${path} L${X(x1).toFixed(1)},${H - m.b} L${X(0).toFixed(1)},${H - m.b} Z`;

    const grid = [0, 1, 2, 3]
      .map((k) => {
        const v = y0 + ((y1 - y0) * k) / 3;
        return `
        <line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" opacity=".12"/>
        <text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="currentColor" opacity=".7" font-family="var(--font-mono, monospace)">${Math.round(v)} m</text>
      `;
      })
      .join('');

    const dots = P.map((p, i) => {
      const cx = X(p.distance_m).toFixed(1);
      const cy = Y(p.elevation_m).toFixed(1);
      return `
        <circle cx="${cx}" cy="${cy}" r="4" fill="var(--eva-accent, #EE5822)" stroke="#140F0D" stroke-width="2">
          <title>WP-${i + 1} ${esc(p.name)}: ${n(p.elevation_m, 0)} m at ${n(p.distance_m / 1000, 2)} km</title>
        </circle>
        <text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".7" font-family="var(--font-mono, monospace)">WP-${i + 1}</text>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Traverse Elevation profile" style="display:block;">
        <defs>
          <linearGradient id="eva-elev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--eva-accent, #EE5822)" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="var(--eva-accent, #EE5822)" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        ${grid}
        <path d="${area}" fill="url(#eva-elev-grad)"/>
        <path d="${path}" fill="none" stroke="var(--eva-accent, #EE5822)" stroke-width="2.5" stroke-linecap="round"/>
        ${dots}
      </svg>
    `;
  }

  function draw(res, sc, edited) {
    const t = res.totals;
    const f = res.feasibility;
    const sp = f.two_sol_split;
    const v = verify(res, state.scenario);
    const sceneRows = runScenarios(sc);

    const col = ['#14B87F', '#E8A838', '#EE5822'];
    const bar = ['walk_min', 'science_min', 'contingency_min']
      .map(
        (k, i) =>
          `<i title="${k.replace('_min', '')}: ${n(t[k])} min" style="flex:${t[k]}; background:${col[i]}"></i>`
      )
      .join('');

    root.innerHTML = `
      <div class="eva">
        <!-- Site & Rigor Meta Header -->
        <div class="panel" style="border-left: 3px solid var(--eva-accent, #EE5822);">
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px;">
            <div>
              <span class="badge obs" style="margin-right:6px;">Target Site</span>
              <span style="font-weight:600; color:var(--text, #F7F2E8); font-size:14px;">Jezero Crater Traverse (~18.4°N, 77.4°E)</span>
              <p class="note" style="margin-top:2px;">
                ${esc(sc.region_note || 'Jezero Crater is a distinct planetary site. Gale Crater boundaries and validators do not apply.')}
              </p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <span class="badge obs" title="Ground truth from cited NASA archive products">Observed: Coordinates / DTM</span>
              <span class="badge der" title="Calculated mathematically via IAU spherical formulas">Derived: Distances / Slopes / MET</span>
              <span class="badge asm" title="Simulation models and operational guidelines">Assumed: Speeds / Limits</span>
            </div>
          </div>
        </div>

        <!-- Mission Summary Panel -->
        <div class="panel">
          <h3>
            <span>Mission Summary Telemetry</span>
            <span class="badge der">Derived &amp; Assumed</span>
          </h3>
          <div class="cards">
            <div class="card">
              <span class="badge der">Derived</span>
              <b>${n(t.d3d_m / 1000, 2)} km</b>
              <span>3D Surface Distance (2D: ${n(t.horizontal_m, 1)} m)</span>
            </div>
            <div class="card">
              <span class="badge der">Derived</span>
              <b>${t.net_gain_m >= 0 ? '+' : ''}${n(t.net_gain_m, 0)} m</b>
              <span>Net Elevation (Range: ${n(t.elevation_range_m, 0)} m)</span>
            </div>
            <div class="card">
              <span class="badge der">Derived</span>
              <b>${t.walk_hm}</b>
              <span>Walking Traverse (${n(t.walk_min)} min)</span>
            </div>
            <div class="card">
              <span class="badge asm">Assumed</span>
              <b>${t.science_hm}</b>
              <span>Science Stops (incl. ${n(res.preparation_min, 0)} min prep)</span>
            </div>
            <div class="card">
              <span class="badge asm">Assumed</span>
              <b>${t.contingency_hm}</b>
              <span>Contingency (${(res.assumptions.contingency_fraction * 100).toFixed(0)}%)</span>
            </div>
            <div class="card">
              <span class="badge der">Derived</span>
              <b class="${f.within_limit ? 'ok' : 'bad'}">${t.total_hm}</b>
              <span>Total EVA Duration (${n(t.total_min)} min)</span>
            </div>
          </div>

          <div style="margin:16px 0 6px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center;">
            <div>
              <span class="badge ${f.within_limit ? 'ok' : 'bad'}" style="font-size:11px; padding:3px 8px;">
                ${esc(f.status)}
              </span>
              <span style="margin-left:8px; font-family:var(--font-mono, monospace); font-size:12px; color:var(--text);">
                Nominal limit: <b>${f.eva_limit_min} min</b> &middot; Margin: 
                <b class="${f.margin_min >= 0 ? 'ok' : 'bad'}">${n(f.margin_min, 0)} min</b>
                ${f.reserve_min ? ` &middot; (Reserve: ${f.reserve_min} min)` : ''}
              </span>
            </div>
            <div style="font-size:11px; color:var(--text-muted);">
              Split: Sol 1 ends at <b>${esc(sp.latest_waypoint_within_limit ?? 'None')}</b> (MET ${sp.minutes_at_that_point == null ? '-' : fmtHM(sp.minutes_at_that_point)})
            </div>
          </div>

          <div class="bar">${bar}</div>
          <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted); font-family:var(--font-mono, monospace);">
            <span>Traverse: ${n(t.walk_min)} min</span>
            <span>Science: ${n(t.science_min)} min</span>
            <span>Contingency: ${n(t.contingency_min)} min</span>
          </div>
          <p class="note">
            Single-EVA Split Strategy: ${esc(sp.note)} Remaining on Sol 2: <b>${n(sp.remaining_minutes_day2)} min</b>.
          </p>
        </div>

        <!-- What-If Controls -->
        <div class="panel">
          <h3>
            <span>Simulation Parameters (What-If Analysis)</span>
            <span class="badge asm">Operational Inputs</span>
          </h3>
          <div class="controls">
            <label>
              Tortuosity (&tau;)
              <select data-cfg="tortuosity">
                ${[1, 1.25, 1.4].map((x) => `<option value="${x}" ${x === res.assumptions.tortuosity ? 'selected' : ''}>${x.toFixed(2)} ${x === 1 ? '(Report Baseline)' : ''}</option>`).join('')}
              </select>
            </label>
            <label>
              Contingency %
              <input type="number" min="0" max="100" step="1" data-cfg="contingency_fraction" value="${Math.round(res.assumptions.contingency_fraction * 100)}">
            </label>
            <label>
              EVA Limit (min)
              <input type="number" min="60" step="10" data-cfg="eva_limit_min" value="${f.eva_limit_min}">
            </label>
            <button data-reset type="button" style="margin-bottom:1px;">
              Reset to Report Baseline
            </button>
          </div>
          ${
            edited
              ? `<p class="note" style="color:var(--secondary, #E8A838);">
                  &bull; User overrides active: contingency calculation transitioned to <b>proportional mode</b> (distributed across segments by active duration) instead of the reference report's published fixed per-phase values.
                </p>`
              : ''
          }
        </div>

        <!-- Interactive Map Panel -->
        <div class="panel">
          <h3>
            <span>Jezero Crater Traverse Vector Map</span>
            <span class="badge obs">Coordinates: IAU 2000 Mars</span>
          </h3>
          ${renderMap(res, sc)}
        </div>

        <!-- Route Segments Breakdown Table -->
        <div class="panel">
          <h3>
            <span>Segment-by-Segment Traverse Telemetry</span>
            <span class="badge der">Rigorous IAU Formulation</span>
          </h3>
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th class="l">Leg</th>
                  <th class="l">Traverse Segment</th>
                  <th>Dh (m) <span class="badge der">Der</span></th>
                  <th>&Delta;z (m) <span class="badge obs">Obs</span></th>
                  <th>Slope &deg; <span class="badge der">Der</span></th>
                  <th>Grade % <span class="badge der">Der</span></th>
                  <th>3D dist (m) <span class="badge der">Der</span></th>
                  <th>Speed (m/s) <span class="badge asm">Asm</span></th>
                  <th>Walk (min) <span class="badge der">Der</span></th>
                  <th>Science <span class="badge asm">Asm</span></th>
                  <th>Cont. <span class="badge asm">Asm</span></th>
                  <th>Phase Total <span class="badge der">Der</span></th>
                  <th>Cumul. MET <span class="badge der">Der</span></th>
                </tr>
              </thead>
              <tbody>
                ${res.segments
                  .map(
                    (s, i) => `
                  <tr class="${state.selectedSegmentIndex === s.index ? 'highlighted' : ''}" data-row-idx="${s.index}" style="cursor:pointer;">
                    <td>#${String(s.index).padStart(2, '0')}</td>
                    <td class="l">
                      <b>${esc(s.from)} &rarr; ${esc(s.to)}</b><br>
                      <small style="color:var(--text-muted); font-size:11px;">${esc(s.terrain_class)}</small>
                    </td>
                    <td>${n(s.horizontal_m, 1)}</td>
                    <td>${s.dz_m > 0 ? '+' : ''}${n(s.dz_m, 0)}</td>
                    <td style="color:${getSlopeColor(s.slope_deg)}; font-weight:600;">${n(s.slope_deg, 2)}&deg;</td>
                    <td>${n(s.grade_pct, 2)}%</td>
                    <td>${n(s.d3d_m, 1)}</td>
                    <td onclick="event.stopPropagation();">
                      <input type="number" step="0.05" min="0.05" data-speed="${i}" value="${s.speed_ms}">
                    </td>
                    <td>${n(s.walk_min, 1)}</td>
                    <td>${n(s.science_min, 0)}</td>
                    <td>${n(s.contingency_min, 1)}</td>
                    <td style="font-weight:600;">${n(s.phase_total_min, 1)}</td>
                    <td style="font-weight:600; color:var(--eva-accent, #EE5822);">${s.met_clock}</td>
                  </tr>`
                  )
                  .join('')}
                <tr style="border-top:2px solid var(--eva-line, rgba(255,255,255,0.2)); font-weight:700;">
                  <td></td>
                  <td class="l"><b>Total / Summary</b></td>
                  <td><b>${n(t.horizontal_m, 1)}</b></td>
                  <td><b>${t.net_gain_m > 0 ? '+' : ''}${n(t.net_gain_m, 0)}</b></td>
                  <td colspan="2"></td>
                  <td><b>${n(t.d3d_m, 1)}</b></td>
                  <td></td>
                  <td><b>${n(t.walk_min, 1)}</b></td>
                  <td><b>${n(t.science_min, 0)}</b></td>
                  <td><b>${n(t.contingency_min, 1)}</b></td>
                  <td style="color:var(--text);"><b>${n(t.total_min, 1)}</b></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="note">
            ${esc(res.assumptions.slope_note)}
            Terrain speeds are estimated from analog and simulation figures. Indicative O&sub2; consumption for final segment 8 climb: <b>149&ndash;182 L</b> (1.8&ndash;2.2 L/min walking rate as published in report, unverified).
          </p>
        </div>

        <!-- Elevation Profile -->
        <div class="panel">
          <h3>
            <span>Traverse Elevation Profile</span>
            <span class="badge obs">DTM Archive Datum</span>
          </h3>
          ${chart(res)}
        </div>

        <!-- Science Stops Schedule -->
        <div class="panel">
          <h3>
            <span>Science Stops Schedule (${res.science_stops.length} Stations)</span>
            <span class="badge asm">Assumed Protocol</span>
          </h3>
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th class="l">Waypoint Station</th>
                  <th>Duration (min)</th>
                  <th class="l">Scheduled Activity</th>
                </tr>
              </thead>
              <tbody>
                ${res.science_stops
                  .map(
                    (s) => `
                  <tr>
                    <td class="l"><b>${esc(s.waypoint)}</b></td>
                    <td>${s.minutes}</td>
                    <td class="l" style="white-space:normal; font-family:inherit; color:var(--text-muted);">
                      ${esc(s.activity)}
                    </td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Mission Scenarios Comparison -->
        <div class="panel">
          <h3>
            <span>Operational Scenario Trade Study</span>
            <span class="badge der">Simulated Modalities</span>
          </h3>
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th class="l">Scenario Description</th>
                  <th>Ground Dist (km)</th>
                  <th>Transit (min)</th>
                  <th>Total Duration</th>
                  <th>Status</th>
                  <th>Margin (min)</th>
                  <th class="l">Mission Planning Notes</th>
                </tr>
              </thead>
              <tbody>
                ${sceneRows
                  .map(
                    (r) => `
                  <tr>
                    <td class="l"><b>${esc(r.label)}</b></td>
                    <td>${n(r.ground_km, 2)}</td>
                    <td>${n(r.walk_min, 1)}</td>
                    <td style="font-weight:600;">${esc(r.total_hm)}</td>
                    <td class="${r.within_limit ? 'ok' : 'bad'}" style="font-weight:700;">${r.within_limit ? 'OK' : 'OVER'}</td>
                    <td class="${r.margin_min >= 0 ? 'ok' : 'bad'}">${n(r.margin_min, 0)}</td>
                    <td class="l" style="white-space:normal; font-family:inherit; color:var(--text-muted);">${esc(r.note)}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Verification & Quality Review -->
        <div class="panel">
          <h3>
            <span>Verification Against Reference Report</span>
            <span class="badge ${v.all_pass ? 'ok' : 'warn'}">${v.passed}/${v.total} Checks Passed</span>
          </h3>
          <p style="margin:0 0 10px;">
            <b class="${v.all_pass ? 'ok' : 'bad'}">${v.passed} of ${v.total} verification checks passed</b>
            ${edited ? ' <span style="color:var(--secondary);">(Inputs edited: variations from original report expected)</span>' : ''}
          </p>
          <details>
            <summary>Inspect all 83 numerical validation checks</summary>
            <div style="overflow-x:auto; margin-top:8px;">
              <table>
                <thead>
                  <tr>
                    <th class="l">Parameter Check</th>
                    <th>Computed</th>
                    <th>Published Report</th>
                    <th>Tolerance</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  ${v.checks
                    .map(
                      (c) => `
                    <tr>
                      <td class="l">${esc(c.check)}</td>
                      <td>${c.computed}</td>
                      <td>${c.report}</td>
                      <td>${c.tolerance}</td>
                      <td class="${c.pass ? 'ok' : 'bad'}" style="font-weight:600;">${c.pass ? 'PASS' : 'DIFF'}</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </details>

          <!-- Findings to Review Notice -->
          <div class="findings-box">
            <h4>Findings to Review (Report Analysis &amp; Assumptions)</h4>
            <ul>
              ${(v.report_findings || []).map((f) => `<li>${esc(f)}</li>`).join('')}
            </ul>
          </div>
          <p class="note">
            Real vs simulated distinction: coordinates and elevations are taken directly from the report's cited archive products (HiRISE, CTX, MOLA DTMs). Walking speeds, science stop times, contingency buffers, and suit telemetry limits represent unverified planning assumptions.
          </p>
        </div>
      </div>
    `;

    // Bind What-If controls
    root.querySelectorAll('[data-cfg]').forEach((el) =>
      el.addEventListener('change', () => {
        const k = el.dataset.cfg;
        const val = Number(el.value);
        if (Number.isFinite(val)) {
          state.overrides.config[k] = k === 'contingency_fraction' ? val / 100 : val;
          run();
        }
      })
    );

    root.querySelectorAll('[data-speed]').forEach((el) =>
      el.addEventListener('change', () => {
        const val = Number(el.value);
        if (Number.isFinite(val) && val > 0) {
          state.overrides.speeds[el.dataset.speed] = val;
          run();
        }
      })
    );

    root.querySelector('[data-reset]')?.addEventListener('click', () => {
      state.overrides = { config: {}, speeds: {} };
      state.selectedSegmentIndex = null;
      state.selectedWaypointId = null;
      run();
    });

    // Map and Table interactive links
    root.querySelectorAll('[data-seg-idx]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.segIdx);
        state.selectedSegmentIndex = state.selectedSegmentIndex === idx ? null : idx;
        const row = root.querySelector(`[data-row-idx="${idx}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        run();
      });
    });

    root.querySelectorAll('[data-row-idx]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.rowIdx);
        state.selectedSegmentIndex = state.selectedSegmentIndex === idx ? null : idx;
        run();
      });
    });

    root.querySelectorAll('[data-wp-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(el.dataset.wpId);
        state.selectedWaypointId = state.selectedWaypointId === id ? null : id;
        run();
      });
    });

    root.querySelector('[data-close-popup]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      state.selectedWaypointId = null;
      run();
    });
  }

  return run();
}
