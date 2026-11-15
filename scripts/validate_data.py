#!/usr/bin/env python3
"""
ROVERSE data validation. Run: python scripts/validate_data.py [data_dir]
Exit code 1 if any ERROR is found. Writes documentation/validation_report.md.
Automation cannot prove a geological interpretation is right; human review is still required.
"""
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import transform_bounds

DATA = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
BBOX = (137.0, -6.0, 138.0, -4.0)  # west, south, east, north
GEO = CRS.from_string("+proj=longlat +R=3396190 +no_defs")
REQUIRED_META = ["name", "source", "instrument", "date_range", "resolution_m", "units", "crs", "limitations", "url"]
REQUIRED = [
    "elevation/dem_gale.tif", "elevation/slope_gale.tif", "elevation/roughness_gale.tif",
    "terrain/terrain_classes.geojson", "science/science_targets.geojson",
    "layers_metadata.json", "terrain_grid.json",
]
report, errors = [], 0


def log(level, msg):
    global errors
    if level == "ERROR":
        errors += 1
    report.append(f"- **{level}**: {msg}")
    print(f"[{level}] {msg}")


def has_placeholder(value):
    return isinstance(value, str) and "REPLACE_WITH" in value


def walk_coords(c):
    if c and isinstance(c[0], (int, float)):
        yield c
    else:
        for item in c or []:
            yield from walk_coords(item)


def check_files():
    for rel in REQUIRED:
        log("OK" if (DATA / rel).exists() else "ERROR", f"file {'found' if (DATA / rel).exists() else 'MISSING'}: {rel}")


def check_metadata():
    p = DATA / "layers_metadata.json"
    if not p.exists():
        return
    try:
        layers = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        log("ERROR", f"layers_metadata.json is not valid JSON: {e}")
        return
    for layer in layers:
        name = layer.get("name", "UNKNOWN")
        missing = [k for k in REQUIRED_META if layer.get(k) in (None, "")]
        todo = [k for k, v in layer.items() if has_placeholder(v)]
        if missing:
            log("ERROR", f"metadata '{name}' missing {missing}")
        if todo:
            log("ERROR", f"metadata '{name}' still has placeholders in {todo} (fill exact product ID, URL, dates)")
        if not missing and not todo:
            log("OK", f"metadata '{name}' complete")


def check_raster(rel, lo=None, hi=None):
    p = DATA / rel
    if not p.exists():
        return
    with rasterio.open(p) as src:
        if src.crs is None:
            log("ERROR", f"{rel}: no CRS")
        if src.nodata is None:
            log("ERROR", f"{rel}: nodata not defined (missing data must not become zero)")
        if src.crs is not None:
            w, s, e, n = transform_bounds(src.crs, GEO, *src.bounds)
            tol = 0.05
            if w < BBOX[0] - tol or e > BBOX[2] + tol or s < BBOX[1] - tol or n > BBOX[3] + tol:
                log("ERROR", f"{rel}: bounds {round(w,3),round(s,3),round(e,3),round(n,3)} fall outside project region")
        arr = src.read(1, masked=True)
        valid = arr.compressed()
        if valid.size == 0:
            log("ERROR", f"{rel}: no valid cells")
            return
        log("OK", f"{rel}: {src.width}x{src.height}, res={src.res}, range=({valid.min():.2f}, {valid.max():.2f}), "
                  f"nodata cells={arr.mask.sum() if np.ndim(arr.mask) else 0}")
        if lo is not None and (valid.min() < lo or valid.max() > hi):
            log("ERROR", f"{rel}: values outside expected range {lo}..{hi}")


def check_geojson(rel, id_keys):
    p = DATA / rel
    if not p.exists():
        return
    try:
        geo = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        log("ERROR", f"{rel}: invalid JSON: {e}")
        return
    if geo.get("type") != "FeatureCollection":
        log("ERROR", f"{rel}: not a FeatureCollection")
        return
    bad, seen = 0, set()
    for f in geo.get("features", []):
        props = f.get("properties", {})
        fid = next((props[k] for k in id_keys if props.get(k)), None)
        if not fid:
            bad += 1; log("ERROR", f"{rel}: feature without stable id ({id_keys})")
        elif fid in seen:
            bad += 1; log("ERROR", f"{rel}: duplicate id {fid}")
        seen.add(fid)
        if not props.get("source_url") or has_placeholder(props.get("source_url")):
            bad += 1; log("ERROR", f"{rel}: {fid} missing real source_url")
        if "science" in rel and not props.get("coordinate_confidence"):
            bad += 1; log("ERROR", f"{rel}: {fid} missing coordinate_confidence")
        if f.get("geometry") is None:
            bad += 1; log("ERROR", f"{rel}: {fid} has no geometry"); continue
        for c in walk_coords(f["geometry"]["coordinates"]):
            lon, lat = c[0], c[1]
            if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
                bad += 1
                hint = " (lon/lat may be swapped)" if (BBOX[1] <= lon <= BBOX[3]) else ""
                log("ERROR", f"{rel}: {fid} coordinate {c[:2]} outside region{hint}")
                break
    log("OK" if not bad else "WARN", f"{rel}: {len(geo.get('features', []))} features checked")


def check_grid():
    p = DATA / "terrain_grid.json"
    if not p.exists():
        return
    g = json.loads(p.read_text(encoding="utf-8"))
    n = g["width"] * g["height"]
    for name, arr in g["layers"].items():
        if len(arr) != n:
            log("ERROR", f"terrain_grid.json layer '{name}' length {len(arr)} != {n}")
    log("OK", f"terrain_grid.json {g['width']}x{g['height']} layers={list(g['layers'])}")


def check_radiation():
    p = DATA / "radiation" / "radiation_summary.json"
    if not p.exists():
        log("WARN", "radiation_summary.json absent: UI must show 'Data unavailable'")
        return
    r = json.loads(p.read_text(encoding="utf-8"))
    if r.get("value") is None or any(has_placeholder(v) for v in r.values()):
        log("WARN", "radiation not verified: UI must show 'Data unavailable'")
    else:
        log("OK", "radiation summary has a value and source; verify quantity, unit and period manually")


if __name__ == "__main__":
    check_files()
    check_metadata()
    check_raster("elevation/dem_gale.tif")
    check_raster("elevation/slope_gale.tif", 0, 90)
    check_raster("elevation/roughness_gale.tif", 0, None or 1e9)
    check_geojson("terrain/terrain_classes.geojson", ["terrain_id"])
    check_geojson("science/science_targets.geojson", ["id"])
    check_grid()
    check_radiation()
    out = Path("documentation")
    out.mkdir(exist_ok=True)
    (out / "validation_report.md").write_text("# Validation report\n\n" + "\n".join(report) + "\n", encoding="utf-8")
    print(f"\n{errors} error(s). Report: documentation/validation_report.md")
    sys.exit(1 if errors else 0)
