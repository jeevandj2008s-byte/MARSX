#!/usr/bin/env python3
"""
ROVERSE terrain pipeline
------------------------
Input : one real Mars DEM GeoTIFF (elevation in metres) that covers Gale Crater / Mount Sharp.
Output: numeric GeoTIFFs, terrain polygons, a browser-friendly query grid and layer metadata.

Usage:
  python scripts/process_dem.py --dem raw/gale_dem.tif \
      --dem-id "EXACT_PRODUCT_ID" --source-url "https://..." \
      --instrument "MOLA / HRSC" --date-range "multi-date mosaic" --out data

Requires: numpy, scipy, rasterio, shapely
Never run this on invented data. The source DEM is only read, never modified.
"""
import argparse
import json
import math
import sys
from datetime import date
from pathlib import Path

import numpy as np
import rasterio
from rasterio import Affine
from rasterio.crs import CRS
from rasterio.features import shapes, sieve
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds, transform_geom
from rasterio.windows import Window, from_bounds as window_from_bounds
from scipy.ndimage import maximum_filter, minimum_filter, uniform_filter
from shapely.geometry import mapping, shape

MARS_RADIUS_M = 3396190.0  # project reference sphere (confirm against product docs)
MARS_GEOGRAPHIC = "+proj=longlat +R=3396190 +no_defs"
BBOX = {"west": 137.0, "east": 138.0, "south": -6.0, "north": -4.0}
NODATA = -9999.0

# code: (terrain_type, display_name, caution)
CLASSES = {
    1: ("flat_plains", "Flat Plains",
        "Low slope and low relief at DEM scale; small hazards may remain unresolved."),
    2: ("moderate_terrain", "Moderate Terrain",
        "Default class for terrain that matches no other rule; not a distinct landform."),
    3: ("rocky_terrain", "Rough / Rocky Terrain (candidate)",
        "Based on DEM roughness only; confirm with CTX/HiRISE imagery. Small rocks are below DEM scale."),
    4: ("mountainous", "Mountainous Terrain",
        "High local relief with moderate-to-steep slope; thresholds are project-defined."),
    5: ("steep_slopes_ridges", "Steep Slopes / Ridges",
        "Slope alone does not prove traversability."),
}

# Prototype GAME thresholds - NOT official NASA rover safety limits. Tune per DEM resolution.
DEFAULT_T = {
    "flat_slope_deg": 5.0,
    "steep_slope_deg": 20.0,
    "mountain_relief_m": 150.0,
    "mountain_slope_deg": 10.0,
    "rough_std_m": 15.0,
}


# ----------------------------------------------------------------------------- reading
def read_dem(path, z_scale, geo_crs, pad):
    with rasterio.open(path) as src:
        if src.crs is None:
            sys.exit("ERROR: DEM has no CRS. Fix the source georeferencing first; do not guess an Earth CRS.")
        l, b, r, t = transform_bounds(
            geo_crs, src.crs, BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"], densify_pts=21
        )
        win = window_from_bounds(l, b, r, t, transform=src.transform)
        c0 = max(0, math.floor(win.col_off))
        r0 = max(0, math.floor(win.row_off))
        c1 = min(src.width, math.ceil(win.col_off + win.width))
        r1 = min(src.height, math.ceil(win.row_off + win.height))
        if c1 - c0 < 3 or r1 - r0 < 3:
            sys.exit("ERROR: DEM does not cover the project region (check longitude 0-360 vs -180-180 and CRS).")
        pc0, pr0 = max(0, c0 - pad), max(0, r0 - pad)
        pc1, pr1 = min(src.width, c1 + pad), min(src.height, r1 + pad)
        pwin = Window(pc0, pr0, pc1 - pc0, pr1 - pr0)
        dem = src.read(1, window=pwin).astype("float64")
        mask = ~np.isfinite(dem) | (dem < -1e30)
        if src.nodata is not None and np.isfinite(src.nodata):
            mask |= np.isclose(dem, src.nodata)
        dem[mask] = np.nan
        dem *= z_scale
        transform = src.window_transform(pwin)
        inner = (r0 - pr0, c0 - pc0, r1 - r0, c1 - c0)  # row, col, height, width
        return dem, transform, src.crs, inner


def pixel_sizes_m(crs, transform, nrows):
    a, e = abs(transform.a), abs(transform.e)
    if crs.is_geographic:
        k = MARS_RADIUS_M * math.pi / 180.0
        lats = transform.f + (np.arange(nrows) + 0.5) * transform.e
        dx = a * k * np.cos(np.radians(lats))
        dy = e * k
    else:
        f = crs.linear_units_factor[1]
        dx = np.full(nrows, a * f)
        dy = e * f
    return dx, dy


# --------------------------------------------------------------------------- derivation
def local_std(arr, size):
    valid = np.isfinite(arr)
    a = np.where(valid, arr, 0.0)
    n = uniform_filter(valid.astype(float), size, mode="nearest")
    m = uniform_filter(a, size, mode="nearest")
    m2 = uniform_filter(a * a, size, mode="nearest")
    with np.errstate(invalid="ignore", divide="ignore"):
        var = m2 / n - (m / n) ** 2
    out = np.sqrt(np.clip(var, 0, None))
    out[(n < 0.5) | ~valid] = np.nan
    return out


def local_relief(arr, size):
    valid = np.isfinite(arr)
    hi = maximum_filter(np.where(valid, arr, -np.inf), size, mode="nearest")
    lo = minimum_filter(np.where(valid, arr, np.inf), size, mode="nearest")
    out = hi - lo
    out[~valid | ~np.isfinite(out)] = np.nan
    return out


def derive(dem, dx_m, dy_m, rough_win, relief_win, az=315.0, alt=45.0):
    dzdx = np.gradient(dem, axis=1) / dx_m[:, None]   # per metre, east positive
    dzdn = -np.gradient(dem, axis=0) / dy_m            # per metre, north positive
    slope_r = np.arctan(np.hypot(dzdx, dzdn))
    slope = np.degrees(slope_r)
    aspect = (np.degrees(np.arctan2(-dzdx, -dzdn)) + 360.0) % 360.0  # downslope direction
    aspect[slope < 0.5] = np.nan  # flat cells: aspect undefined
    zen = math.radians(90.0 - alt)
    hs = np.cos(zen) * np.cos(slope_r) + np.sin(zen) * np.sin(slope_r) * np.cos(math.radians(az) - np.radians(aspect))
    hs = np.where(np.isfinite(aspect), hs, np.cos(zen))  # flat = illumination of a flat surface
    hs = np.clip(hs, 0, 1)
    hs[~np.isfinite(slope)] = np.nan
    return slope, aspect, hs, local_std(dem, rough_win), local_relief(dem, relief_win)


def classify(slope, rough, relief, t):
    cls = np.full(slope.shape, 2, np.uint8)
    cls[(slope < t["flat_slope_deg"]) & (relief < t["mountain_relief_m"])] = 1
    cls[(rough >= t["rough_std_m"]) & (slope < t["steep_slope_deg"])] = 3
    cls[(relief >= t["mountain_relief_m"]) & (slope >= t["mountain_slope_deg"])] = 4
    cls[slope >= t["steep_slope_deg"]] = 5
    cls[~np.isfinite(slope) | ~np.isfinite(rough) | ~np.isfinite(relief)] = 0
    return cls


# ------------------------------------------------------------------------------ writing
def write_tif(path, arr, crs, transform, dtype, nodata):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = arr.astype(dtype)
    if np.issubdtype(np.dtype(dtype), np.floating):
        data = np.where(np.isfinite(arr), arr, nodata).astype(dtype)
    with rasterio.open(
        path, "w", driver="GTiff", height=data.shape[0], width=data.shape[1], count=1,
        dtype=dtype, crs=crs, transform=transform, nodata=nodata, compress="deflate",
    ) as dst:
        dst.write(data, 1)


def polygonize(cls, transform, crs, geo_crs, pix_deg, dem_id, source_url, min_cells):
    cls_s = sieve(cls, size=min_cells, connectivity=8)
    cls_s[cls == 0] = 0
    feats, i = [], 0
    for geom, val in shapes(cls_s, mask=cls_s > 0, transform=transform, connectivity=8):
        code = int(val)
        g = geom if crs.is_geographic else transform_geom(crs, geo_crs, geom)
        poly = shape(g).simplify(pix_deg * 0.5, preserve_topology=True)
        if poly.is_empty:
            continue
        i += 1
        ttype, name, caution = CLASSES[code]
        feats.append({
            "type": "Feature",
            "geometry": json.loads(json.dumps(mapping(poly), default=float)),
            "properties": {
                "terrain_id": f"T{i:04d}",
                "terrain_type": ttype,
                "display_name": name,
                "evidence": ["elevation", "slope", "roughness"],
                "confidence": "medium" if code == 5 else "low",
                "status": "interpreted",
                "method": "DEM-only rule-based candidate class; prototype thresholds",
                "source": dem_id,
                "source_url": source_url,
                "limitations": caution + " Boundary approximate; needs human review against imagery.",
            },
        })
    return {"type": "FeatureCollection", "features": feats}


def export_grid(path, layers, crs, transform, geo_crs, max_dim, thresholds, bands_meta):
    west, south, east, north = BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"]
    wspan = (east - west) * math.cos(math.radians((north + south) / 2))
    hspan = north - south
    if wspan >= hspan:
        w, h = max_dim, max(2, round(max_dim * hspan / wspan))
    else:
        h, w = max_dim, max(2, round(max_dim * wspan / hspan))
    dst_t = from_bounds(west, south, east, north, w, h)
    out = {}
    for name, (arr, kind, digits) in layers.items():
        if kind == "class":
            dst = np.zeros((h, w), np.uint8)
            reproject(arr.astype(np.uint8), dst, src_transform=transform, src_crs=crs, dst_transform=dst_t,
                      dst_crs=geo_crs, resampling=Resampling.nearest, src_nodata=0, dst_nodata=0)
            out[name] = [int(v) for v in dst.ravel()]
        else:
            dst = np.full((h, w), np.nan, np.float32)
            reproject(arr.astype(np.float32), dst, src_transform=transform, src_crs=crs, dst_transform=dst_t,
                      dst_crs=geo_crs, resampling=Resampling.bilinear, src_nodata=np.nan, dst_nodata=np.nan)
            out[name] = [None if not np.isfinite(v) else round(float(v), digits) for v in dst.ravel()]
    grid = {
        "bounds": BBOX, "width": w, "height": h, "origin": "top-left (north-west), row-major",
        "crs": "Mars geographic lon/lat (east-positive), R=3396190 m",
        "classes": {str(k): {"type": v[0], "name": v[1], "caution": v[2]} for k, v in CLASSES.items()},
        "thresholds": thresholds, "note": bands_meta, "layers": out,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(grid, separators=(",", ":")), encoding="utf-8")


def update_metadata(path, entries):
    existing = []
    if path.exists():
        existing = json.loads(path.read_text(encoding="utf-8"))
    names = {e["name"] for e in entries}
    merged = [e for e in existing if e.get("name") not in names] + entries
    path.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")


# -------------------------------------------------------------------------------- main
def main():
    p = argparse.ArgumentParser(description="ROVERSE DEM -> terrain intelligence layers")
    p.add_argument("--dem", required=True, help="Source DEM GeoTIFF (metres unless --z-scale)")
    p.add_argument("--dem-id", default="REPLACE_WITH_EXACT_PRODUCT_ID")
    p.add_argument("--source-url", default="REPLACE_WITH_SOURCE_URL")
    p.add_argument("--instrument", default="REPLACE_WITH_INSTRUMENT")
    p.add_argument("--date-range", default="REPLACE_WITH_PRODUCT_DATE")
    p.add_argument("--z-scale", type=float, default=1.0, help="Multiply elevations to get metres (km -> 1000)")
    p.add_argument("--rough-window", type=int, default=3)
    p.add_argument("--relief-window", type=int, default=9)
    p.add_argument("--min-region-cells", type=int, default=40)
    p.add_argument("--grid-size", type=int, default=256, help="Longest side of browser query grid")
    p.add_argument("--out", default="data")
    for k, v in DEFAULT_T.items():
        p.add_argument("--" + k.replace("_", "-"), type=float, default=v)
    a = p.parse_args()
    t = {k: getattr(a, k) for k in DEFAULT_T}

    out = Path(a.out)
    geo = CRS.from_string(MARS_GEOGRAPHIC)
    pad = max(a.rough_window, a.relief_window) // 2 + 2
    dem, tr, crs, (ir, ic, ih, iw) = read_dem(a.dem, a.z_scale, geo, pad)

    dx, dy = pixel_sizes_m(crs, tr, dem.shape[0])
    slope, aspect, hs, rough, relief = derive(dem, dx, dy, a.rough_window, a.relief_window)
    cls = classify(slope, rough, relief, t)

    sl = (slice(ir, ir + ih), slice(ic, ic + iw))
    core_tr = tr * Affine.translation(ic, ir)
    dem_c, slope_c, aspect_c, hs_c, rough_c, relief_c, cls_c = (x[sl] for x in (dem, slope, aspect, hs, rough, relief, cls))
    dx_c = dx[ir:ir + ih]
    res_m = round(float((np.nanmean(dx_c) + dy) / 2.0), 1)

    ele = out / "elevation"
    write_tif(ele / "dem_gale.tif", dem_c, crs, core_tr, "float32", NODATA)
    write_tif(ele / "slope_gale.tif", slope_c, crs, core_tr, "float32", NODATA)
    write_tif(ele / "aspect_gale.tif", aspect_c, crs, core_tr, "float32", NODATA)
    write_tif(ele / "roughness_gale.tif", rough_c, crs, core_tr, "float32", NODATA)
    write_tif(ele / "hillshade_gale.tif", hs_c, crs, core_tr, "float32", NODATA)
    write_tif(out / "terrain" / "terrain_class_gale.tif", cls_c, crs, core_tr, "uint8", 0)

    pix_deg = float(np.nanmean(dx_c) / (MARS_RADIUS_M * math.pi / 180.0)) if not crs.is_geographic else abs(core_tr.a)
    pix_deg = max(pix_deg, 1e-6)
    geojson = polygonize(cls_c, core_tr, crs, geo, pix_deg, a.dem_id, a.source_url, a.min_region_cells)
    (out / "terrain").mkdir(parents=True, exist_ok=True)
    (out / "terrain" / "terrain_classes.geojson").write_text(json.dumps(geojson), encoding="utf-8")

    band_note = "Slope bands are prototype game thresholds, not official NASA rover safety limits."
    export_grid(
        out / "terrain_grid.json",
        {"elevation": (dem_c, "float", 1), "slope": (slope_c, "float", 1), "roughness": (rough_c, "float", 1),
         "hillshade": (np.where(np.isfinite(hs_c), hs_c * 255.0, np.nan), "float", 0), "terrain": (cls_c, "class", 0)},
        crs, core_tr, geo, a.grid_size, t, band_note,
    )

    common = {
        "source": a.dem_id, "instrument": a.instrument, "date_range": a.date_range, "url": a.source_url,
        "resolution_m": res_m, "crs": crs.to_string() or crs.to_wkt()[:120],
        "processed_on": date.today().isoformat(), "processing": "scripts/process_dem.py (rasterio/numpy/scipy)",
    }
    update_metadata(out / "layers_metadata.json", [
        {**common, "name": "elevation", "units": "m", "status": "observed (DEM product)",
         "limitations": "Regional context; features smaller than the pixel size are unresolved."},
        {**common, "name": "slope", "units": "degrees", "status": "derived from DEM",
         "limitations": f"Central-difference slope; pixel spacing converted to metres. {band_note}"},
        {**common, "name": "aspect", "units": "degrees from north (downslope direction)", "status": "derived from DEM",
         "limitations": "Undefined (nodata) on near-flat cells."},
        {**common, "name": "roughness", "units": "m (local elevation std dev)", "status": "derived from DEM",
         "limitations": f"{a.rough_window}x{a.rough_window}-cell window (~{round(res_m * a.rough_window)} m); scale dependent."},
        {**common, "name": "hillshade", "units": "0-1 illumination", "status": "derived visualisation",
         "limitations": "Assumed sun azimuth 315, altitude 45; not a material measurement."},
        {**common, "name": "terrain_classes", "units": "class code", "status": "interpreted (candidate)",
         "limitations": "DEM-only rules with prototype thresholds; confirm with CTX/HiRISE; "
                        f"thresholds={json.dumps(t)}"},
    ])
    print(f"Done. Region {BBOX}, {iw}x{ih} cells, ~{res_m} m/pixel, {len(geojson['features'])} terrain polygons.")
    print("Next: fill every REPLACE_WITH_* field, then run: python scripts/validate_data.py")


if __name__ == "__main__":
    main()
