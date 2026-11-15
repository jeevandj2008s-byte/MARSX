#!/usr/bin/env python3
"""
ROVERSE EVA Route Planner engine (standard library only).

Implements every calculation in the Jezero EVA report:
  haversine horizontal distance -> 3D distance -> slope/grade -> walking time (terrain speeds)
  -> science stops -> contingency (20 %) -> phase totals -> cumulative MET -> feasibility
  -> scenarios (tortuosity, rover, two-sol split) -> verification against the report.

CLI:
  python backend/eva_planner.py report      # full human-readable report
  python backend/eva_planner.py verify      # compare with the PDF's published numbers
  python backend/eva_planner.py scenarios   # what-if comparison table
  python backend/eva_planner.py json        # full result as JSON (what the API returns)
  python backend/eva_planner.py serve       # optional FastAPI server (pip install fastapi uvicorn)
"""
import copy
import json
import math
import sys
from pathlib import Path

DEFAULT_SCENARIO = Path(__file__).resolve().parent.parent / "scenarios" / "jezero_reference.json"


# ------------------------------------------------------------------ formulas
def haversine_m(lat1, lon1, lat2, lon2, radius_m):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dlmb = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return radius_m * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def distance_3d_m(dh, dz):
    return math.sqrt(dh * dh + dz * dz)


def slope_deg(dz, dh):
    return math.degrees(math.atan(abs(dz) / dh)) if dh > 0 else 0.0


def grade_pct(dz, dh):
    return abs(dz) / dh * 100.0 if dh > 0 else 0.0


def travel_time_min(dist_m, speed_ms):
    return dist_m / speed_ms / 60.0


def r1(x):
    """Round half up to 1 decimal (the report rounds each segment to 0.1 before summing)."""
    return math.floor(x * 10 + 0.5 + 1e-9) / 10


def fmt_hm(minutes):
    m = int(math.floor(minutes + 0.5 + 1e-9))
    return f"{m // 60} h {m % 60:02d} min"


def fmt_clock(minutes):
    m = int(math.floor(minutes + 0.5 + 1e-9))
    return f"{m // 60:02d}:{m % 60:02d}"


# ---------------------------------------------------------------------- plan
def plan(scenario, overrides=None):
    """Compute the whole EVA plan. `overrides` may patch config / speeds (shallow merge on config)."""
    sc = copy.deepcopy(scenario)
    if overrides:
        sc["config"].update(overrides.get("config", {}))
        for k in ("waypoints", "segments", "science_stops_min", "radius_m"):
            if k in overrides:
                sc[k] = overrides[k]
    cfg, R = sc["config"], sc["radius_m"]
    wp = {w["id"]: w for w in sc["waypoints"]}
    tau = cfg.get("tortuosity", 1.0)
    rnd = cfg.get("round_segment_minutes", True)
    mode = cfg.get("contingency_mode", "proportional")
    errors = []
    if tau < 1.0:
        errors.append("tortuosity must be >= 1.0")

    segs = []
    for i, s in enumerate(sc["segments"], start=1):
        a, b = wp[s["from"]], wp[s["to"]]
        if s["speed_ms"] <= 0:
            raise ValueError(f"Segment {i}: speed must be > 0")
        dh = haversine_m(a["lat"], a["lon"], b["lat"], b["lon"], R)
        dz = b["elevation_m"] - a["elevation_m"]
        d3 = distance_3d_m(dh, dz)
        d_walk = d3 * tau
        t = travel_time_min(d_walk, s["speed_ms"])
        walk = r1(t) if rnd else t
        sci = float(sc["science_stops_min"].get(str(s["to"]), 0))
        segs.append({
            "index": i, "from_id": s["from"], "to_id": s["to"], "from": a["name"], "to": b["name"],
            "terrain": s["terrain"], "terrain_class": s.get("class", s["terrain"]), "speed_ms": s["speed_ms"],
            "speed_kmh": round(s["speed_ms"] * 3.6, 2),
            "horizontal_m": dh, "dz_m": dz, "d3d_m": d3, "walked_m": d_walk,
            "slope_deg": slope_deg(dz, dh), "grade_pct": grade_pct(dz, dh),
            "walk_min": walk, "science_min": sci,
            "_fixed_cont": s.get("contingency_min"), "_o2": s.get("o2_rate_l_min"),
        })

    prep = float(sc["science_stops_min"].get(str(sc["segments"][0]["from"]), 0))
    walk_total = sum(s["walk_min"] for s in segs)
    sci_total = sum(s["science_min"] for s in segs) + prep
    cont_total = cfg["contingency_fraction"] * (walk_total + sci_total)

    # contingency distribution: fixed (report's published values) or proportional to segment time x risk weight
    if mode == "fixed" and all(s["_fixed_cont"] is not None for s in segs):
        for s in segs:
            s["contingency_min"] = float(s["_fixed_cont"])
    else:
        mode = "proportional"
        w = [(s["walk_min"] + s["science_min"]) * sc["segments"][s["index"] - 1].get("risk_weight", 1.0) for s in segs]
        tw = sum(w) or 1.0
        for s, wi in zip(segs, w):
            s["contingency_min"] = cont_total * wi / tw
    cont_used = sum(s["contingency_min"] for s in segs)

    met, t_now = [{"waypoint": wp[sc["segments"][0]["from"]]["name"], "minutes": prep, "clock": fmt_clock(prep)}], prep
    for s in segs:
        s["phase_total_min"] = s["walk_min"] + s["science_min"] + s["contingency_min"]
        t_now += s["phase_total_min"]
        s["met_min"], s["met_clock"] = t_now, fmt_clock(t_now)
        met.append({"waypoint": s["to"], "minutes": t_now, "clock": s["met_clock"]})
        if s["_o2"]:
            s["o2_l_range"] = [round(s["_o2"][0] * s["walk_min"]), round(s["_o2"][1] * s["walk_min"])]

    elevs = [w["elevation_m"] for w in sc["waypoints"]]
    first, last = sc["waypoints"][0]["elevation_m"], sc["waypoints"][-1]["elevation_m"]
    dh_total = sum(s["horizontal_m"] for s in segs)
    d3_total = sum(s["d3d_m"] for s in segs)
    total = walk_total + sci_total + cont_used
    limit = cfg["eva_limit_min"]

    # latest waypoint reachable inside one EVA limit (two-sol split suggestion)
    reach = [m for m in met if m["minutes"] <= limit]
    split = {
        "latest_waypoint_within_limit": reach[-1]["waypoint"] if reach else None,
        "minutes_at_that_point": reach[-1]["minutes"] if reach else None,
        "remaining_minutes_day2": total - reach[-1]["minutes"] if reach else None,
        "note": "Overnight shelter/bivouac must be placed at or before this waypoint for a single-EVA limit.",
    }
    for s in segs:
        s.pop("_fixed_cont"), s.pop("_o2")

    return {
        "scenario_id": sc["id"], "name": sc["name"], "errors": errors,
        "assumptions": {
            "radius_m": R, "gravity_ms2": sc.get("gravity_ms2"), "tortuosity": tau,
            "contingency_fraction": cfg["contingency_fraction"], "contingency_mode": mode,
            "segment_minutes_rounded_to_0.1": rnd, "terrain_speeds": "assumed per terrain class (report values)",
            "slope_note": "Regional slope = arctan(|dz|/Dh) over the whole segment; local pitches can be much steeper.",
        },
        "segments": segs,
        "preparation_min": prep,
        "science_stops": [{"waypoint": wp[int(k)]["name"], "minutes": v, "activity": sc.get("science_activities", {}).get(k, "")}
                          for k, v in sorted(sc["science_stops_min"].items(), key=lambda kv: int(kv[0]))],
        "met": met,
        "totals": {
            "horizontal_m": dh_total, "d3d_m": d3_total, "d3d_minus_horizontal_m": d3_total - dh_total,
            "ground_walked_m": sum(s["walked_m"] for s in segs),
            "net_gain_m": last - first, "min_elevation_m": min(elevs), "max_elevation_m": max(elevs),
            "elevation_range_m": max(elevs) - min(elevs),
            "walk_min": walk_total, "science_min": sci_total,
            "contingency_formula_min": cont_total, "contingency_min": cont_used, "total_min": total,
            "total_hm": fmt_hm(total), "walk_hm": fmt_hm(walk_total), "science_hm": fmt_hm(sci_total),
            "contingency_hm": fmt_hm(cont_used),
        },
        "feasibility": {
            "eva_limit_min": limit, "reserve_min": cfg.get("reserve_min", 0), "note": cfg.get("limit_note", ""),
            "within_limit": total <= limit, "margin_min": limit - total,
            "status": "WITHIN LIMIT" if total <= limit else "EXCEEDS SINGLE-EVA LIMIT",
            "two_sol_split": split,
        },
        "profile": [{"distance_m": d, "elevation_m": e, "name": n} for d, e, n in _profile(sc, segs)],
    }


def _profile(sc, segs):
    pts, d = [(0.0, sc["waypoints"][0]["elevation_m"], sc["waypoints"][0]["name"])], 0.0
    wp = {w["id"]: w for w in sc["waypoints"]}
    for s in segs:
        d += s["horizontal_m"]
        pts.append((d, wp[s["to_id"]]["elevation_m"], s["to"]))
    return pts


# ----------------------------------------------------------------- scenarios
def rover_option(result, speed_kmh, fraction):
    transit = result["totals"]["d3d_m"] / (speed_kmh * 1000.0) * 60.0
    sci = result["totals"]["science_min"]
    total = (transit + sci) * (1 + fraction)
    return transit, total


def run_scenarios(scenario):
    cfg = scenario["config"]
    frac, limit = cfg["contingency_fraction"], cfg["eva_limit_min"]
    rows = []

    def add(label, res, note=""):
        t = res["totals"]
        rows.append({"label": label, "ground_km": t["ground_walked_m"] / 1000, "walk_min": t["walk_min"],
                     "total_min": t["total_min"], "total_hm": t["total_hm"], "within_limit": t["total_min"] <= limit,
                     "margin_min": limit - t["total_min"], "note": note})

    base = {"config": {"contingency_mode": "proportional"}}
    add("Baseline walk (report, tortuosity 1.00)", plan(scenario))
    for tau in (1.25, 1.40):
        add(f"Walk with tortuosity {tau:.2f}", plan(scenario, {"config": {"tortuosity": tau, "contingency_mode": "proportional"}}),
            "detours around boulders/megaripples")
    base_res = plan(scenario)
    for v in cfg.get("rover_speed_kmh", [8, 10]):
        tr, tot = rover_option(base_res, v, frac)
        rows.append({"label": f"Rover at {v} km/h", "ground_km": base_res["totals"]["d3d_m"] / 1000, "walk_min": tr,
                     "total_min": tot, "total_hm": fmt_hm(tot), "within_limit": tot <= limit, "margin_min": limit - tot,
                     "note": f"transit {tr:.1f} min (+20% contingency on transit and science)"})
    sp = base_res["feasibility"]["two_sol_split"]
    rows.append({"label": "Two-sol split", "ground_km": base_res["totals"]["ground_walked_m"] / 1000,
                 "walk_min": base_res["totals"]["walk_min"], "total_min": sp["minutes_at_that_point"],
                 "total_hm": fmt_hm(sp["minutes_at_that_point"] or 0), "within_limit": True,
                 "margin_min": limit - (sp["minutes_at_that_point"] or 0),
                 "note": f"Sol 1 ends at {sp['latest_waypoint_within_limit']}; Sol 2 needs {sp['remaining_minutes_day2']:.1f} min"})
    return rows


# -------------------------------------------------------------- verification
def verify(result, reference, scenario):
    checks, ok_all = [], True

    def chk(name, got, exp, tol):
        nonlocal ok_all
        ok = abs(got - exp) <= tol
        ok_all &= ok
        checks.append({"check": name, "computed": round(got, 3), "report": exp, "tolerance": tol, "pass": ok})

    for s, r in zip(result["segments"], reference["segments"]):
        p = f"Seg {s['index']}"
        chk(p + " horizontal m", s["horizontal_m"], r["horizontal_m"], 0.06)
        chk(p + " dz m", s["dz_m"], r["dz_m"], 1e-9)
        chk(p + " slope deg", s["slope_deg"], r["slope_deg"], 0.006)
        chk(p + " 3D m", s["d3d_m"], r["d3d_m"], 0.06)
        chk(p + " walk min", s["walk_min"], r["walk_min"], 0.06)
        chk(p + " science min", s["science_min"], r["science_min"], 1e-9)
        chk(p + " contingency min", s["contingency_min"], r["contingency_min"], 1e-9)
        chk(p + " phase total min", s["phase_total_min"], r["phase_total_min"], 0.06)
    t, rt = result["totals"], reference["totals"]
    for key, tol in (("horizontal_m", 0.3), ("d3d_m", 0.3), ("net_gain_m", 1e-9), ("elevation_range_m", 1e-9),
                     ("walk_min", 0.06), ("science_min", 1e-9), ("contingency_min", 0.06),
                     ("total_min", 0.06), ("d3d_minus_horizontal_m", 0.3)):
        chk("TOTAL " + key, t[key], rt[key], tol)
    chk("20% contingency formula", t["contingency_formula_min"], 0.2 * (rt["walk_min"] + rt["science_min"]), 0.06)
    for m, exp in zip(result["met"], reference["met"]):
        ok = m["clock"] == exp
        ok_all &= ok
        checks.append({"check": "MET " + m["waypoint"], "computed": m["clock"], "report": exp, "tolerance": "exact", "pass": ok})
    return {"all_pass": ok_all, "passed": sum(c["pass"] for c in checks), "total": len(checks), "checks": checks,
            "report_findings": report_findings(result, scenario)}


def report_findings(result, scenario):
    """Things in the source report that deserve a human look (computed, not assumed)."""
    out = []
    R = scenario["radius_m"]
    out.append(f"Planet radius used: {R:,} m (report). The Gale terrain pack used 3,396,190 m; "
               "the two differ by ~0.2% in distance. Keep one value project-wide.")
    tau_lo, tau_hi = 1.25, 1.40
    d3 = result["totals"]["d3d_m"]
    out.append(f"Report quotes 12.8-14.3 km for tortuosity 1.25-1.40; computed {d3*tau_lo/1000:.2f}-{d3*tau_hi/1000:.2f} km. "
               "Its 612 min baseline uses tortuosity 1.00, so it is optimistic versus its own caveat.")
    fr = scenario["config"]["contingency_fraction"]
    v = 8.0
    tr = d3 / (v * 1000) * 60
    out.append(f"Report claims a rover at 8-10 km/h gives transit 'under 75 min': at 8 km/h it is {tr:.1f} min; "
               f"under 75 min needs >= {d3/1000/(75/60):.2f} km/h.")
    out.append("Per-phase contingency values in the report (7,10,18,7,14,15,8,23) are not reproducible from a stated rule; "
               "only their total (20% of walking + science = 102 min) is. 'fixed' mode reproduces them; "
               "'proportional' mode derives them from segment time.")
    out.append("Terrain speeds and the xEMU 8 h + 30 min figures are assumptions copied from the report; verify against "
               "NASA sources before publishing. Waypoint coordinates/elevations also need checking against PLACES/USGS products.")
    return out


# ------------------------------------------------------------------- output
def load(path=None):
    return json.loads(Path(path or DEFAULT_SCENARIO).read_text(encoding="utf-8"))


def text_report(res):
    t, f = res["totals"], res["feasibility"]
    L = [f"{res['name']}", "=" * 78, ""]
    L.append(f"Distance (2D)  {t['horizontal_m']:>10,.1f} m   3D {t['d3d_m']:>10,.1f} m  (+{t['d3d_minus_horizontal_m']:.1f} m)")
    L.append(f"Net gain       {t['net_gain_m']:>+10.1f} m   range {t['elevation_range_m']:.0f} m  ({t['min_elevation_m']:.0f} to {t['max_elevation_m']:.0f} m)")
    L.append(f"Walking {t['walk_hm']}  | Science {t['science_hm']}  | Contingency {t['contingency_hm']}  | TOTAL {t['total_hm']} ({t['total_min']:.1f} min)")
    L.append(f"Feasibility: {f['status']}  (limit {f['eva_limit_min']} min, margin {f['margin_min']:+.1f} min)")
    L += ["", f"{'#':<2} {'Segment':<46}{'Dh m':>8}{'dz m':>7}{'Slope':>7}{'3D m':>9}{'v m/s':>6}{'Walk':>7}{'Sci':>6}{'Cont':>6}{'Total':>7}{'MET':>7}"]
    for s in res["segments"]:
        name = f"{s['from']} -> {s['to']}"[:45]
        L.append(f"{s['index']:<2} {name:<46}{s['horizontal_m']:>8.1f}{s['dz_m']:>+7.0f}{s['slope_deg']:>6.2f}°{s['d3d_m']:>9.1f}"
                 f"{s['speed_ms']:>6.2f}{s['walk_min']:>7.1f}{s['science_min']:>6.1f}{s['contingency_min']:>6.1f}"
                 f"{s['phase_total_min']:>7.1f}{s['met_clock']:>7}")
    sp = f["two_sol_split"]
    L += ["", f"Single-EVA split: latest waypoint within limit = {sp['latest_waypoint_within_limit']} "
          f"(MET {fmt_clock(sp['minutes_at_that_point'] or 0)}); remaining {sp['remaining_minutes_day2']:.1f} min on Sol 2."]
    for s in res["segments"]:
        if "o2_l_range" in s:
            L.append(f"Indicative O2 for segment {s['index']} walking: {s['o2_l_range'][0]}-{s['o2_l_range'][1]} L (rate from report).")
    return "\n".join(L)


def text_scenarios(rows, limit):
    L = [f"{'Scenario':<40}{'Ground km':>10}{'Move min':>10}{'Total':>12}{'vs limit':>11}  Note"]
    for r in rows:
        L.append(f"{r['label']:<40}{r['ground_km']:>10.2f}{r['walk_min']:>10.1f}{r['total_hm']:>12}"
                 f"{('OK' if r['within_limit'] else 'OVER'):>6} {r['margin_min']:+6.0f}  {r['note']}")
    return "\n".join(L)


def create_app():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    app = FastAPI(title="ROVERSE EVA Route Planner")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    sc = load()

    @app.get("/api/eva/scenario")
    def scenario():
        return {k: v for k, v in sc.items() if k != "reference"}

    @app.post("/api/eva/plan")
    def plan_route(body: dict = None):
        return plan(sc, body or {})

    @app.get("/api/eva/scenarios")
    def scenarios():
        return run_scenarios(sc)

    @app.get("/api/eva/verify")
    def verify_route():
        return verify(plan(sc), sc["reference"], sc)
    return app


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "report"
    sc = load(sys.argv[2] if len(sys.argv) > 2 else None)
    if cmd == "report":
        print(text_report(plan(sc)))
    elif cmd == "scenarios":
        print(text_scenarios(run_scenarios(sc), sc["config"]["eva_limit_min"]))
    elif cmd == "verify":
        v = verify(plan(sc), sc["reference"], sc)
        for c in v["checks"]:
            print(("PASS " if c["pass"] else "FAIL ") + f"{c['check']:<34} computed={c['computed']}  report={c['report']}")
        print(f"\n{v['passed']}/{v['total']} checks passed")
        print("\nFindings to review:")
        for f in v["report_findings"]:
            print(" -", f)
        sys.exit(0 if v["all_pass"] else 1)
    elif cmd == "json":
        print(json.dumps({"plan": plan(sc), "scenarios": run_scenarios(sc)}, indent=2, default=float))
    elif cmd == "serve":
        import uvicorn
        uvicorn.run(create_app(), host="0.0.0.0", port=8000)
    else:
        sys.exit(__doc__)
