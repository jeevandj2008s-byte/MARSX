# ROVERSE — Terrain Intelligence & Scientific Data Pipeline

## 1. Overview
This pipeline integrates real, traceable Martian geospatial data into the ROVERSE planetary workstation (Gale Crater / Mount Sharp region). It guarantees strict scientific epistemic classification, offline static file access, and non-destructive fallbacks.

---

## 2. Project Region & Coordinate Reference System (CRS)

* **Bounding Box**:
  * West: **137.0°E**
  * East: **138.0°E**
  * South: **-6.0°S**
  * North: **-4.0°N**
* **Reference Sphere**: IAU 2000 Mars Mean Sphere with radius $R = 3{,}396{,}190\text{ m}$.
* **Projection / Datum**: Mars Geographic Planetocentric, east-positive (`+proj=longlat +R=3396190 +no_defs`).
* **Coordinate Order**: GeoJSON positions strictly follow `[longitude, latitude]`.
* **Important**: Mars is not Earth. Never apply WGS84, EPSG:4326 (ellipsoidal Earth), or terrestrial UTM projections to Mars data.

---

## 3. Directory & File Structure

```text
├── data/ & public/data/
│   ├── elevation/
│   │   ├── dem_gale.tif             # Clipped DEM GeoTIFF (metres)
│   │   ├── slope_gale.tif           # Derived slope GeoTIFF (degrees)
│   │   ├── aspect_gale.tif          # Aspect angle GeoTIFF (degrees from N)
│   │   ├── roughness_gale.tif       # Elevation standard deviation (metres)
│   │   └── hillshade_gale.tif       # Analytical Lambertian illumination (0-1)
│   ├── terrain/
│   │   ├── terrain_class_gale.tif   # Classified raster (codes 1-5)
│   │   └── terrain_classes.geojson  # Vector polygons for candidate units
│   ├── science/
│   │   ├── science_targets.geojson  # Source-verified science targets
│   │   └── science_target_details.json
│   ├── radiation/
│   │   └── radiation_summary.json   # MSL Curiosity RAD historical measurement
│   ├── terrain_grid.json            # Browser-friendly query grid (256x256)
│   └── layers_metadata.json         # Provenance, instrument, & limitation catalog
├── scripts/
│   ├── process_dem.py               # Raster processing & grid derivation
│   └── validate_data.py             # Automated QA validation suite
├── src/
│   └── terrainIntelligence.ts       # Framework-agnostic terrain engine
└── documentation/
    ├── README.md                    # This documentation file
    └── validation_report.md         # Automated QA validation log
```

---

## 4. Epistemic Classification & Status Labels

Every scientific measurement, calculation, and figure displayed across the workstation carries an explicit label:

| Status Label | Category | Meaning & Examples |
|---|---|---|
| **Observed (DEM product)** | Direct Measurement | Elevation values from orbital instruments (MGS MOLA MEGDR, MEX HRSC). |
| **Derived from DEM** | Mathematical Extraction | First-derivative slope gradient ($\theta = \arctan|\nabla z|$), aspect direction, and spatial-window roughness. |
| **Interpreted (candidate)** | Geological Unit | Rule-based candidate geomorphic classes (Flat Plains, Mountainous, etc.). Requires optical imagery review. |
| **Simulated (game score)** | Mission Planning Model | Slope difficulty bands, astronaut walking speeds, and EVA energy budgets. |

> [!WARNING]
> **Prototype Game Threshold Notice**: Slope bands (`Easy <10°`, `Moderate 10°–20°`, `Difficult 20°–30°`, `Avoid ≥30°`) are prototype game thresholds, not official NASA rover safety limits.

---

## 5. Nodata & Missing Data Handling

* **No Fabrication**: Missing raster cells remain `null` and are rendered as `"No data"` or `"Data unavailable"`. They are **never** converted to `0`.
* **Traverse Profiles**: Route elevation cross-sections never bridge missing data with zero elevation; gaps remain disconnected intervals.
* **Canvas Overlays**: Cells with missing data are rendered with full alpha transparency (`[0, 0, 0, 0]`), ensuring underlying base imagery remains visible.

---

## 6. How to Ingest a Real DEM Product

When you are ready to ingest a high-resolution DEM product covering Gale Crater:

1. **Download the DEM**:
   * Visit **USGS Astropedia (Map-a-Planet 2)**:
     [Mars MGS MOLA - MEX HRSC Blended DEM Global 200m](https://astrogeology.usgs.gov/search/map/Mars/Express/HRSC/Mars_MGS_MOLA_MEX_HRSC_blended_DEM_Global_200m)
   * Or download the [Mars MSL Gale Merged DEM](https://astrogeology.usgs.gov/) (1 m/px merged product).
   * Save the GeoTIFF file as `raw/gale_dem.tif`.

2. **Run the Processing Pipeline**:
   ```bash
   python scripts/process_dem.py \
     --dem raw/gale_dem.tif \
     --dem-id "MOLA_HRSC_GALE_200M" \
     --source-url "https://astrogeology.usgs.gov/search/map/Mars/Express/HRSC/Mars_MGS_MOLA_MEX_HRSC_blended_DEM_Global_200m" \
     --instrument "MOLA / HRSC" \
     --date-range "2001-2015" \
     --out public/data
   ```

3. **Synchronize to `data/` and Validate**:
   ```bash
   Copy-Item public/data/* data/ -Recurse -Force
   python scripts/validate_data.py data
   ```
