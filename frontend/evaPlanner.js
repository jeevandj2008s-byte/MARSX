/**
 * ROVERSE EVA planner engine (ES module, no dependencies). Same logic as backend/eva_planner.py.
 * Use in the browser for live what-if edits, or in a Node backend if you do not run Python.
 *   import { plan, runScenarios, verify } from './evaPlanner.js';
 *   const result = plan(scenarioJson, { config: { tortuosity: 1.25 } });
 */
const rad = (d) => (d * Math.PI) / 180;

export function haversineM(lat1, lon1, lat2, lon2, R) {
  const p1 = rad(lat1), p2 = rad(lat2), dphi = p2 - p1, dl = rad(lon2 - lon1);
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export const distance3dM = (dh, dz) => Math.sqrt(dh * dh + dz * dz);
export const slopeDeg = (dz, dh) => (dh > 0 ? (Math.atan(Math.abs(dz) / dh) * 180) / Math.PI : 0);
export const gradePct = (dz, dh) => (dh > 0 ? (Math.abs(dz) / dh) * 100 : 0);
export const travelTimeMin = (dist, v) => dist / v / 60;
export const r1 = (x) => Math.floor(x * 10 + 0.5 + 1e-9) / 10; // half-up to 0.1
const roundMin = (m) => Math.floor(m + 0.5 + 1e-9);
export const fmtHM = (m) => `${Math.floor(roundMin(m) / 60)} h ${String(roundMin(m) % 60).padStart(2, '0')} min`;
export const fmtClock = (m) => `${String(Math.floor(roundMin(m) / 60)).padStart(2, '0')}:${String(roundMin(m) % 60).padStart(2, '0')}`;
const sum = (a) => a.reduce((x, y) => x + y, 0);

export function plan(scenario, overrides = {}) {
  const sc = structuredClone(scenario);
  Object.assign(sc.config, overrides.config || {});
  for (const k of ['waypoints', 'segments', 'science_stops_min', 'radius_m']) if (overrides[k]) sc[k] = overrides[k];
  const cfg = sc.config, R = sc.radius_m;
  const wp = Object.fromEntries(sc.waypoints.map((w) => [w.id, w]));
  const tau = cfg.tortuosity ?? 1, rnd = cfg.round_segment_minutes ?? true;
  let mode = cfg.contingency_mode ?? 'proportional';
  const errors = tau < 1 ? ['tortuosity must be >= 1.0'] : [];

  const segs = sc.segments.map((s, i) => {
    const a = wp[s.from], b = wp[s.to];
    if (!(s.speed_ms > 0)) throw new Error(`Segment ${i + 1}: speed must be > 0`);
    const dh = haversineM(a.lat, a.lon, b.lat, b.lon, R), dz = b.elevation_m - a.elevation_m, d3 = distance3dM(dh, dz);
    const t = travelTimeMin(d3 * tau, s.speed_ms);
    return {
      index: i + 1, from_id: s.from, to_id: s.to, from: a.name, to: b.name, terrain: s.terrain,
      terrain_class: s.class || s.terrain, speed_ms: s.speed_ms, speed_kmh: Math.round(s.speed_ms * 360) / 100,
      horizontal_m: dh, dz_m: dz, d3d_m: d3, walked_m: d3 * tau, slope_deg: slopeDeg(dz, dh), grade_pct: gradePct(dz, dh),
      walk_min: rnd ? r1(t) : t, science_min: Number(sc.science_stops_min[String(s.to)] ?? 0),
      _fixed: s.contingency_min, _o2: s.o2_rate_l_min, _risk: s.risk_weight ?? 1,
    };
  });
  const prep = Number(sc.science_stops_min[String(sc.segments[0].from)] ?? 0);
  const walkTotal = sum(segs.map((s) => s.walk_min));
  const sciTotal = sum(segs.map((s) => s.science_min)) + prep;
  const contTotal = cfg.contingency_fraction * (walkTotal + sciTotal);
  if (mode === 'fixed' && segs.every((s) => s._fixed != null)) segs.forEach((s) => (s.contingency_min = Number(s._fixed)));
  else {
    mode = 'proportional';
    const w = segs.map((s) => (s.walk_min + s.science_min) * s._risk), tw = sum(w) || 1;
    segs.forEach((s, i) => (s.contingency_min = (contTotal * w[i]) / tw));
  }
  const contUsed = sum(segs.map((s) => s.contingency_min));
  const met = [{ waypoint: wp[sc.segments[0].from].name, minutes: prep, clock: fmtClock(prep) }];
  let now = prep;
  for (const s of segs) {
    s.phase_total_min = s.walk_min + s.science_min + s.contingency_min;
    now += s.phase_total_min; s.met_min = now; s.met_clock = fmtClock(now);
    met.push({ waypoint: s.to, minutes: now, clock: s.met_clock });
    if (s._o2) s.o2_l_range = [Math.round(s._o2[0] * s.walk_min), Math.round(s._o2[1] * s.walk_min)];
    delete s._fixed; delete s._o2; delete s._risk;
  }
  const elev = sc.waypoints.map((w) => w.elevation_m), dhT = sum(segs.map((s) => s.horizontal_m)), d3T = sum(segs.map((s) => s.d3d_m));
  const total = walkTotal + sciTotal + contUsed, limit = cfg.eva_limit_min;
  const reach = met.filter((m) => m.minutes <= limit), last = reach[reach.length - 1];
  let d = 0;
  const profile = [{ distance_m: 0, elevation_m: sc.waypoints[0].elevation_m, name: sc.waypoints[0].name }];
  for (const s of segs) { d += s.horizontal_m; profile.push({ distance_m: d, elevation_m: wp[s.to_id].elevation_m, name: s.to }); }
  return {
    scenario_id: sc.id, name: sc.name, errors,
    assumptions: { radius_m: R, gravity_ms2: sc.gravity_ms2, tortuosity: tau, contingency_fraction: cfg.contingency_fraction,
      contingency_mode: mode, 'segment_minutes_rounded_to_0.1': rnd,
      slope_note: 'Regional slope = arctan(|dz|/Dh) over the whole segment; local pitches can be much steeper.' },
    segments: segs, preparation_min: prep,
    science_stops: Object.entries(sc.science_stops_min).sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ waypoint: wp[k].name, minutes: v, activity: sc.science_activities?.[k] || '' })),
    met,
    totals: { horizontal_m: dhT, d3d_m: d3T, d3d_minus_horizontal_m: d3T - dhT, ground_walked_m: sum(segs.map((s) => s.walked_m)),
      net_gain_m: elev[elev.length - 1] - elev[0], min_elevation_m: Math.min(...elev), max_elevation_m: Math.max(...elev),
      elevation_range_m: Math.max(...elev) - Math.min(...elev), walk_min: walkTotal, science_min: sciTotal,
      contingency_formula_min: contTotal, contingency_min: contUsed, total_min: total, total_hm: fmtHM(total),
      walk_hm: fmtHM(walkTotal), science_hm: fmtHM(sciTotal), contingency_hm: fmtHM(contUsed) },
    feasibility: { eva_limit_min: limit, reserve_min: cfg.reserve_min ?? 0, note: cfg.limit_note || '', within_limit: total <= limit,
      margin_min: limit - total, status: total <= limit ? 'WITHIN LIMIT' : 'EXCEEDS SINGLE-EVA LIMIT',
      two_sol_split: { latest_waypoint_within_limit: last?.waypoint ?? null, minutes_at_that_point: last?.minutes ?? null,
        remaining_minutes_day2: last ? total - last.minutes : null,
        note: 'Overnight shelter/bivouac must be placed at or before this waypoint for a single-EVA limit.' } },
    profile,
  };
}

export function runScenarios(scenario) {
  const cfg = scenario.config, limit = cfg.eva_limit_min, rows = [];
  const add = (label, res, note = '') => rows.push({ label, ground_km: res.totals.ground_walked_m / 1000, walk_min: res.totals.walk_min,
    total_min: res.totals.total_min, total_hm: res.totals.total_hm, within_limit: res.totals.total_min <= limit, margin_min: limit - res.totals.total_min, note });
  const base = plan(scenario);
  add('Baseline walk (report, tortuosity 1.00)', base);
  for (const tau of [1.25, 1.4]) add(`Walk with tortuosity ${tau.toFixed(2)}`, plan(scenario, { config: { tortuosity: tau, contingency_mode: 'proportional' } }), 'detours around boulders/megaripples');
  for (const v of cfg.rover_speed_kmh ?? [8, 10]) {
    const tr = (base.totals.d3d_m / (v * 1000)) * 60, tot = (tr + base.totals.science_min) * (1 + cfg.contingency_fraction);
    rows.push({ label: `Rover at ${v} km/h`, ground_km: base.totals.d3d_m / 1000, walk_min: tr, total_min: tot, total_hm: fmtHM(tot),
      within_limit: tot <= limit, margin_min: limit - tot, note: `transit ${tr.toFixed(1)} min (+20% contingency on transit and science)` });
  }
  const sp = base.feasibility.two_sol_split;
  rows.push({ label: 'Two-sol split', ground_km: base.totals.ground_walked_m / 1000, walk_min: base.totals.walk_min, total_min: sp.minutes_at_that_point,
    total_hm: fmtHM(sp.minutes_at_that_point || 0), within_limit: true, margin_min: limit - (sp.minutes_at_that_point || 0),
    note: `Sol 1 ends at ${sp.latest_waypoint_within_limit}; Sol 2 needs ${sp.remaining_minutes_day2.toFixed(1)} min` });
  return rows;
}

export function reportFindings(result, scenario) {
  const out = [];
  const R = scenario.radius_m;
  out.push(`Planet radius used: ${R.toLocaleString('en-US')} m (report). The Gale terrain pack used 3,396,190 m; the two differ by ~0.2% in distance. Keep one value project-wide.`);
  const tau_lo = 1.25, tau_hi = 1.40;
  const d3 = result.totals.d3d_m;
  out.push(`Report quotes 12.8-14.3 km for tortuosity 1.25-1.40; computed ${(d3*tau_lo/1000).toFixed(2)}-${(d3*tau_hi/1000).toFixed(2)} km. Its 612 min baseline uses tortuosity 1.00, so it is optimistic versus its own caveat.`);
  const v = 8.0;
  const tr = (d3 / (v * 1000)) * 60;
  out.push(`Report claims a rover at 8-10 km/h gives transit 'under 75 min': at 8 km/h it is ${tr.toFixed(1)} min; under 75 min needs >= ${(d3/1000/(75/60)).toFixed(2)} km/h.`);
  out.push("Per-phase contingency values in the report (7,10,18,7,14,15,8,23) are not reproducible from a stated rule; only their total (20% of walking + science = 102 min) is. 'fixed' mode reproduces them; 'proportional' mode derives them from segment time.");
  out.push("Terrain speeds and the xEMU 8 h + 30 min figures are assumptions copied from the report; verify against NASA sources before publishing. Waypoint coordinates/elevations also need checking against PLACES/USGS products.");
  return out;
}

export function verify(result, scenario) {
  const ref = scenario.reference, checks = [];
  const chk = (name, got, exp, tol) => checks.push({ check: name, computed: +got.toFixed(3), report: exp, tolerance: tol, pass: Math.abs(got - exp) <= tol });
  result.segments.forEach((s, i) => {
    const r = ref.segments[i], p = `Seg ${s.index}`;
    chk(`${p} horizontal m`, s.horizontal_m, r.horizontal_m, 0.06); chk(`${p} dz m`, s.dz_m, r.dz_m, 1e-9);
    chk(`${p} slope deg`, s.slope_deg, r.slope_deg, 0.006); chk(`${p} 3D m`, s.d3d_m, r.d3d_m, 0.06);
    chk(`${p} walk min`, s.walk_min, r.walk_min, 0.06); chk(`${p} science min`, s.science_min, r.science_min, 1e-9);
    chk(`${p} contingency min`, s.contingency_min, r.contingency_min, 1e-9); chk(`${p} phase total min`, s.phase_total_min, r.phase_total_min, 0.06);
  });
  for (const [k, tol] of [['horizontal_m', 0.3], ['d3d_m', 0.3], ['net_gain_m', 1e-9], ['elevation_range_m', 1e-9], ['walk_min', 0.06],
    ['science_min', 1e-9], ['contingency_min', 0.06], ['total_min', 0.06], ['d3d_minus_horizontal_m', 0.3]]) chk(`TOTAL ${k}`, result.totals[k], ref.totals[k], tol);
  chk('20% contingency formula', result.totals.contingency_formula_min, 0.2 * (ref.totals.walk_min + ref.totals.science_min), 0.06);
  result.met.forEach((m, i) => checks.push({ check: `MET ${m.waypoint}`, computed: m.clock, report: ref.met[i], tolerance: 'exact', pass: m.clock === ref.met[i] }));
  return {
    all_pass: checks.every((c) => c.pass),
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    checks,
    report_findings: reportFindings(result, scenario),
  };
}
