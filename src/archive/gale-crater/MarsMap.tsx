import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Crosshair,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Route,
} from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import {
  CIVIDIS_STOPS,
  formatMarsCoordinates,
  interpolateColormap,
  MARS_EQUATORIAL_RADIUS_M,
  sampleGaleCraterTerrain,
  VIRIDIS_STOPS,
} from '../../utils/marsGeospatial';

type MapInteractionMode = 'inspect' | 'add-waypoint' | 'add-science-stop' | 'pan';

interface MarsMapProps {
  compact?: boolean;
  heightClass?: string;
}

export const MarsMap: React.FC<MarsMapProps> = ({
  compact = false,
  heightClass = 'h-[560px]',
}) => {
  const {
    currentRegion,
    layers,
    waypoints,
    selectedWaypointId,
    setSelectedWaypointId,
    addWaypointAtCoords,
    targets,
    selectedTargetId,
    setSelectedTargetId,
    inspectedPoint,
    inspectCoordinates,
    config,
  } = useMission();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ dLat: number; dLon: number }>({
    dLat: 0,
    dLon: 0,
  });
  const [interactionMode, setInteractionMode] = useState<MapInteractionMode>(
    compact ? 'inspect' : 'add-waypoint'
  );
  const [hoverCoords, setHoverCoords] = useState<{
    lat: number;
    lon: number;
    elevationM: number;
    slopeDeg: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; dLat: number; dLon: number } | null>(
    null
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 840,
    height: 520,
  });

  // Reset pan/zoom when region changes
  useEffect(() => {
    setZoom(1);
    setPanOffset({ dLat: 0, dLon: 0 });
  }, [currentRegion.id]);

  // Observe container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setCanvasSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullscreen]);

  // Compute active viewport bounds in Planetocentric Lat/Lon
  const viewBounds = useMemo(() => {
    const baseLatSpan = currentRegion.bounds.maxLat - currentRegion.bounds.minLat;
    const baseLonSpan = currentRegion.bounds.maxLon - currentRegion.bounds.minLon;
    const latSpan = baseLatSpan / zoom;
    const lonSpan = baseLonSpan / zoom;
    const centerLat = currentRegion.center.lat + panOffset.dLat;
    const centerLon = currentRegion.center.lon + panOffset.dLon;
    return {
      minLat: centerLat - latSpan / 2,
      maxLat: centerLat + latSpan / 2,
      minLon: centerLon - lonSpan / 2,
      maxLon: centerLon + lonSpan / 2,
      latSpan,
      lonSpan,
    };
  }, [currentRegion, zoom, panOffset]);

  const latLonToPixel = useCallback(
    (lat: number, lon: number, width: number, height: number) => {
      const x = ((lon - viewBounds.minLon) / viewBounds.lonSpan) * width;
      const y = ((viewBounds.maxLat - lat) / viewBounds.latSpan) * height;
      return { x, y };
    },
    [viewBounds]
  );

  const pixelToLatLon = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const lon = viewBounds.minLon + (x / width) * viewBounds.lonSpan;
      const lat = viewBounds.maxLat - (y / height) * viewBounds.latSpan;
      return { lat, lon };
    },
    [viewBounds]
  );

  // Active layer lookup
  const activeLayerMap = useMemo(() => {
    const map: Record<string, { visible: boolean; opacity: number }> = {};
    layers.forEach((l) => {
      if (l.status === 'available' || l.status === 'active') {
        map[l.id] = { visible: l.visible, opacity: l.opacity };
      }
    });
    return map;
  }, [layers]);

  // Render planetary raster + vector overlays onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSize;
    if (width <= 0 || height <= 0) return;

    // 1. Offscreen low-res scientific raster buffer (fast software rendering)
    const gridW = 160;
    const gridH = 100;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = gridW;
    offCanvas.height = gridH;
    const offCtx = offCanvas.getContext('2d');

    if (offCtx) {
      const imgData = offCtx.createImageData(gridW, gridH);
      const data = imgData.data;

      const showCtxOptical = activeLayerMap['layer-ctx-optical']?.visible ?? true;
      const ctxOpacity = activeLayerMap['layer-ctx-optical']?.opacity ?? 0.9;
      const showMola = activeLayerMap['layer-mola-dem']?.visible ?? false;
      const molaOpacity = activeLayerMap['layer-mola-dem']?.opacity ?? 0.72;
      const showSlope = activeLayerMap['layer-derived-slope']?.visible ?? false;
      const slopeOpacity = activeLayerMap['layer-derived-slope']?.opacity ?? 0.75;
      const showThemis = activeLayerMap['layer-themis-thermal']?.visible ?? false;
      const themisOpacity = activeLayerMap['layer-themis-thermal']?.opacity ?? 0.65;
      const showCrism = activeLayerMap['layer-crism-spectral']?.visible ?? false;
      const crismOpacity = activeLayerMap['layer-crism-spectral']?.opacity ?? 0.7;
      const showHillshade = activeLayerMap['layer-hillshade']?.visible ?? false;
      const hillshadeOpacity = activeLayerMap['layer-hillshade']?.opacity ?? 0.7;
      const showTerrainClasses = activeLayerMap['layer-terrain-classes']?.visible ?? false;
      const terrainClassesOpacity = activeLayerMap['layer-terrain-classes']?.opacity ?? 0.75;

      const [minElev, maxElev] = currentRegion.elevationRangeM;
      const elevSpan = Math.max(100, maxElev - minElev);

      for (let gy = 0; gy < gridH; gy++) {
        const lat = viewBounds.maxLat - (gy / (gridH - 1)) * viewBounds.latSpan;
        for (let gx = 0; gx < gridW; gx++) {
          const lon = viewBounds.minLon + (gx / (gridW - 1)) * viewBounds.lonSpan;
          const sample = sampleGaleCraterTerrain(lat, lon);

          // Base neutral warm dark surface (#1A1614)
          let r = 26;
          let g = 22;
          let b = 20;

          // CTX Panchromatic hillshade simulation (warm desaturated tone)
          if (showCtxOptical) {
            const normElev = (sample.elevationM - minElev) / elevSpan;
            const shade = Math.max(
              24,
              Math.min(
                148,
                48 +
                  normElev * 52 +
                  (sample.roughnessM - 0.5) * 18 -
                  sample.slopeDeg * 1.3
              )
            );
            r = r * (1 - ctxOpacity) + (shade * 1.02) * ctxOpacity;
            g = g * (1 - ctxOpacity) + (shade * 0.94) * ctxOpacity;
            b = b * (1 - ctxOpacity) + (shade * 0.88) * ctxOpacity;
          }

          // MOLA Elevation (strictly Viridis perceptually uniform colormap)
          if (showMola) {
            const tElev = (sample.elevationM - minElev) / elevSpan;
            const vRgb = interpolateColormap(tElev, VIRIDIS_STOPS);
            const blend = molaOpacity * 0.65;
            r = r * (1 - blend) + vRgb[0] * blend;
            g = g * (1 - blend) + vRgb[1] * blend;
            b = b * (1 - blend) + vRgb[2] * blend;
          }

          // Derived Terrain Slope (strictly Cividis perceptually uniform colormap)
          if (showSlope) {
            const tSlope = sample.slopeDeg / 22;
            const cRgb = interpolateColormap(tSlope, CIVIDIS_STOPS);
            const blend = slopeOpacity * 0.72;
            r = r * (1 - blend) + cRgb[0] * blend;
            g = g * (1 - blend) + cRgb[1] * blend;
            b = b * (1 - blend) + cRgb[2] * blend;
          }

          // THEMIS Thermal Inertia highlight on bedrock benches
          if (showThemis) {
            const tiNorm = Math.min(1, Math.max(0, (sample.slopeDeg * 14 + 210 - 180) / 420));
            const cRgb = interpolateColormap(tiNorm, CIVIDIS_STOPS);
            const blend = themisOpacity * 0.55;
            r = r * (1 - blend) + cRgb[0] * blend;
            g = g * (1 - blend) + cRgb[1] * blend;
            b = b * (1 - blend) + cRgb[2] * blend;
          }

          // CRISM Mineralogical Band Depth (Vera Rubin Ridge & Glen Torridon)
          if (showCrism) {
            const vrrAnomaly = Math.exp(-Math.pow((lat - -4.675) / 0.018, 2));
            if (vrrAnomaly > 0.15) {
              const blend = crismOpacity * vrrAnomaly * 0.55;
              r = r * (1 - blend) + 242 * blend;
              g = g * (1 - blend) + 154 * blend;
              b = b * (1 - blend) + 31 * blend;
            }
          }

          // Analytical Hillshade Layer (Task C)
          if (showHillshade) {
            const hsVal = Math.max(0, Math.min(255, Math.round(180 - sample.slopeDeg * 6.5 + (sample.roughnessM - 0.5) * 15)));
            const blend = hillshadeOpacity * 0.65;
            r = r * (1 - blend) + hsVal * blend;
            g = g * (1 - blend) + hsVal * blend;
            b = b * (1 - blend) + hsVal * blend;
          }

          // Candidate Terrain Classes (Task C & D: Flat Plains, Moderate, Rough, Mountainous, Steep)
          if (showTerrainClasses) {
            let trColor: [number, number, number] = [201, 162, 74]; // Moderate (#c9a24a)
            if (sample.slopeDeg >= 20) {
              trColor = [217, 65, 47]; // Steep (#d9412f)
            } else if (sample.elevationM >= -3850 && sample.slopeDeg >= 10) {
              trColor = [123, 106, 168]; // Mountainous (#7b6aa8)
            } else if (sample.roughnessM >= 1.2 && sample.slopeDeg < 20) {
              trColor = [154, 90, 58]; // Rough/Rocky candidate (#9a5a3a)
            } else if (sample.slopeDeg < 5) {
              trColor = [79, 143, 107]; // Flat plains (#4f8f6b)
            }
            const blend = terrainClassesOpacity * 0.55;
            r = r * (1 - blend) + trColor[0] * blend;
            g = g * (1 - blend) + trColor[1] * blend;
            b = b * (1 - blend) + trColor[2] * blend;
          }

          const idx = (gy * gridW + gx) * 4;
          data[idx] = Math.round(r);
          data[idx + 1] = Math.round(g);
          data[idx + 2] = Math.round(b);
          data[idx + 3] = 255;
        }
      }

      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(offCanvas, 0, 0, width, height);
    }

    // 2. HiRISE High-Resolution Swath Footprint Overlay (if visible)
    if (activeLayerMap['layer-hirise-subframe']?.visible) {
      const p1 = latLonToPixel(-4.56, 137.39, width, height);
      const p2 = latLonToPixel(-4.72, 137.455, width, height);
      ctx.save();
      ctx.strokeStyle = 'rgba(20, 184, 127, 0.8)';
      ctx.fillStyle = 'rgba(20, 184, 127, 0.09)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      const swX = Math.min(p1.x, p2.x);
      const swY = Math.min(p1.y, p2.y);
      const swW = Math.abs(p2.x - p1.x);
      const swH = Math.abs(p2.y - p1.y);
      ctx.fillRect(swX, swY, swW, swH);
      ctx.strokeRect(swX, swY, swW, swH);
      ctx.setLineDash([]);
      ctx.fillStyle = '#14B87F';
      ctx.font = '500 10px "DM Sans", sans-serif';
      ctx.fillText('HiRISE SWATH ESP_028335_1755 (0.25 m/px)', swX + 6, swY + 14);
      ctx.restore();
    }

    // 3. Planetary Coordinate Graticule (Lat/Lon grid lines)
    ctx.save();
    ctx.strokeStyle = 'rgba(242, 238, 234, 0.12)';
    ctx.fillStyle = 'rgba(242, 238, 234, 0.65)';
    ctx.lineWidth = 1;
    ctx.font = '400 10px "DM Sans", sans-serif';

    const latStep = viewBounds.latSpan > 0.12 ? 0.04 : 0.02;
    const lonStep = viewBounds.lonSpan > 0.12 ? 0.04 : 0.02;

    const firstLat = Math.ceil(viewBounds.minLat / latStep) * latStep;
    for (let lat = firstLat; lat <= viewBounds.maxLat; lat += latStep) {
      const { y } = latLonToPixel(lat, viewBounds.minLon, width, height);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      if (y > 18 && y < height - 18) {
        ctx.fillText(`${Math.abs(lat).toFixed(2)}°S`, 8, y - 4);
      }
    }

    const firstLon = Math.ceil(viewBounds.minLon / lonStep) * lonStep;
    for (let lon = firstLon; lon <= viewBounds.maxLon; lon += lonStep) {
      const { x } = latLonToPixel(viewBounds.minLat, lon, width, height);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      if (x > 370 && x < width - 55) {
        ctx.fillText(`${lon.toFixed(2)}°E`, x + 4, 14);
      }
    }
    ctx.restore();

    // 4. RAD Historical Dosimetry Corridor Overlay (if visible)
    if (activeLayerMap['layer-rad-dosimetry']?.visible && waypoints.length >= 2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(242, 194, 48, 0.28)';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      waypoints.forEach((wp, idx) => {
        const pt = latLonToPixel(wp.coords.lat, wp.coords.lon, width, height);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 5. Documented Science Target Reticles
    targets.forEach((target) => {
      const pt = latLonToPixel(target.coords.lat, target.coords.lon, width, height);
      if (pt.x < -20 || pt.x > width + 20 || pt.y < -20 || pt.y > height + 20) return;

      const isSelected = target.id === selectedTargetId;
      const inMission = target.selectedForMission;

      ctx.save();
      ctx.strokeStyle = isSelected
        ? '#F29A1F'
        : inMission
          ? '#14B87F'
          : 'rgba(242, 238, 234, 0.65)';
      ctx.lineWidth = isSelected ? 2 : 1.5;

      const r = isSelected ? 9 : 7;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y - r);
      ctx.lineTo(pt.x + r, pt.y);
      ctx.lineTo(pt.x, pt.y + r);
      ctx.lineTo(pt.x - r, pt.y);
      ctx.closePath();
      ctx.fillStyle = isSelected
        ? 'rgba(242, 154, 31, 0.26)'
        : inMission
          ? 'rgba(20, 184, 127, 0.2)'
          : 'rgba(20, 18, 17, 0.72)';
      ctx.fill();
      ctx.stroke();

      if (!compact || isSelected || inMission) {
        const label = target.code;
        ctx.font = '500 10px "DM Sans", sans-serif';
        const textW = ctx.measureText(label).width;
        const boxX = pt.x + 11;
        const boxY = pt.y - 8;
        ctx.fillStyle = 'rgba(20, 18, 17, 0.85)';
        ctx.fillRect(boxX - 4, boxY - 2, textW + 8, 15);
        ctx.strokeStyle = isSelected ? '#F29A1F' : 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX - 4, boxY - 2, textW + 8, 15);
        ctx.fillStyle = isSelected ? '#F2EEEA' : '#A8A29C';
        ctx.fillText(label, boxX, boxY + 9);
      }
      ctx.restore();
    });

    // 6. Traverse Route Polylines & Return Path
    if (waypoints.length >= 2) {
      ctx.save();
      if (config.includeReturnJourney) {
        const firstPt = latLonToPixel(
          waypoints[0].coords.lat,
          waypoints[0].coords.lon,
          width,
          height
        );
        const lastWp = waypoints[waypoints.length - 1];
        const lastPt = latLonToPixel(
          lastWp.coords.lat,
          lastWp.coords.lon,
          width,
          height
        );
        ctx.strokeStyle = '#F2C230';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(lastPt.x, lastPt.y);
        ctx.lineTo(firstPt.x, firstPt.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = '#F29A1F';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      waypoints.forEach((wp, idx) => {
        const pt = latLonToPixel(wp.coords.lat, wp.coords.lon, width, height);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 7. Waypoint Markers
    waypoints.forEach((wp, idx) => {
      const pt = latLonToPixel(wp.coords.lat, wp.coords.lon, width, height);
      const isSelected = wp.id === selectedWaypointId;

      ctx.save();
      if (wp.type === 'start') {
        ctx.fillStyle = '#14B87F';
        ctx.strokeStyle = '#141211';
        ctx.lineWidth = 2;
        ctx.fillRect(pt.x - 6, pt.y - 6, 12, 12);
        ctx.strokeRect(pt.x - 6, pt.y - 6, 12, 12);
      } else if (wp.type === 'destination') {
        ctx.fillStyle = '#F29A1F';
        ctx.strokeStyle = '#141211';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (wp.type === 'science-stop') {
        ctx.fillStyle = '#14B87F';
        ctx.strokeStyle = '#141211';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = '#F2C230';
        ctx.strokeStyle = '#141211';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      if (isSelected) {
        ctx.strokeStyle = '#F29A1F';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.font = '600 10px "DM Sans", sans-serif';
      ctx.fillStyle = '#F2EEEA';
      ctx.fillText(`WP-${String(idx + 1).padStart(2, '0')}`, pt.x - 14, pt.y - 11);
      ctx.restore();
    });

    // 8. Inspected Probe Crosshair
    if (inspectedPoint) {
      const pt = latLonToPixel(
        inspectedPoint.lat,
        inspectedPoint.lon,
        width,
        height
      );
      ctx.save();
      ctx.strokeStyle = 'rgba(242, 238, 234, 0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pt.x - 10, pt.y);
      ctx.lineTo(pt.x + 10, pt.y);
      ctx.moveTo(pt.x, pt.y - 10);
      ctx.lineTo(pt.x, pt.y + 10);
      ctx.stroke();
      ctx.restore();
    }
  }, [
    canvasSize,
    viewBounds,
    activeLayerMap,
    currentRegion,
    targets,
    selectedTargetId,
    waypoints,
    selectedWaypointId,
    config.includeReturnJourney,
    inspectedPoint,
    compact,
    latLonToPixel,
  ]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (interactionMode === 'pan') {
      setIsDragging(true);
      dragStartRef.current = {
        x,
        y,
        dLat: panOffset.dLat,
        dLon: panOffset.dLon,
      };
      return;
    }

    for (const target of targets) {
      const pt = latLonToPixel(
        target.coords.lat,
        target.coords.lon,
        canvasSize.width,
        canvasSize.height
      );
      const distPx = Math.hypot(pt.x - x, pt.y - y);
      if (distPx <= 14) {
        setSelectedTargetId(target.id);
        inspectCoordinates(target.coords.lat, target.coords.lon);
        return;
      }
    }

    for (const wp of waypoints) {
      const pt = latLonToPixel(
        wp.coords.lat,
        wp.coords.lon,
        canvasSize.width,
        canvasSize.height
      );
      const distPx = Math.hypot(pt.x - x, pt.y - y);
      if (distPx <= 12) {
        setSelectedWaypointId(wp.id);
        inspectCoordinates(wp.coords.lat, wp.coords.lon);
        return;
      }
    }

    const { lat, lon } = pixelToLatLon(x, y, canvasSize.width, canvasSize.height);
    if (interactionMode === 'inspect') {
      inspectCoordinates(lat, lon);
    } else if (interactionMode === 'add-waypoint') {
      addWaypointAtCoords(lat, lon, 'waypoint');
    } else if (interactionMode === 'add-science-stop') {
      addWaypointAtCoords(lat, lon, 'science-stop');
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging && dragStartRef.current) {
      const dx = x - dragStartRef.current.x;
      const dy = y - dragStartRef.current.y;
      const dLon = -(dx / canvasSize.width) * viewBounds.lonSpan;
      const dLat = (dy / canvasSize.height) * viewBounds.latSpan;
      setPanOffset({
        dLat: dragStartRef.current.dLat + dLat,
        dLon: dragStartRef.current.dLon + dLon,
      });
      return;
    }

    const { lat, lon } = pixelToLatLon(x, y, canvasSize.width, canvasSize.height);
    const sampled = sampleGaleCraterTerrain(lat, lon);
    setHoverCoords(sampled);
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const scaleBarInfo = useMemo(() => {
    const metersAcrossWidth =
      (viewBounds.lonSpan *
        Math.PI *
        MARS_EQUATORIAL_RADIUS_M *
        Math.cos((currentRegion.center.lat * Math.PI) / 180)) /
      180;
    const metersPerPx = metersAcrossWidth / Math.max(1, canvasSize.width);
    const targetMeters = metersAcrossWidth > 6000 ? 1000 : 500;
    const barPx = Math.max(48, Math.min(140, Math.round(targetMeters / metersPerPx)));
    const actualMeters = Math.round(barPx * metersPerPx);
    return {
      barPx,
      label: actualMeters >= 1000 ? `${(actualMeters / 1000).toFixed(1)} km` : `${actualMeters} m`,
    };
  }, [viewBounds.lonSpan, currentRegion.center.lat, canvasSize.width]);

  const activeCoords = hoverCoords ?? inspectedPoint;
  const showSlopeLegend = activeLayerMap['layer-derived-slope']?.visible ?? false;

  return (
    <div
      ref={containerRef}
      className={`relative glass-panel rounded-[16px] border border-white/10 overflow-hidden flex flex-col ${
        isFullscreen ? 'fixed inset-4 z-50 h-auto' : heightClass
      }`}
    >
      {/* Top Map Control Bar */}
      <div className="px-4 py-2.5 bg-[rgba(255,255,255,0.03)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Compass size={18} strokeWidth={1.5} className="text-[var(--accent)] shrink-0" />
          <span className="text-[13px] font-medium text-[var(--text)] truncate">
            {currentRegion.name}
          </span>
          <span className="hidden sm:inline text-[11px] font-mono-tabular text-[var(--text-muted)]">
            · {currentRegion.crsLabel}
          </span>
        </div>

        {/* Interaction Mode Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Map click mode"
            className="flex flex-wrap items-center gap-1 p-1 glass-nested rounded-full"
          >
            <button
              type="button"
              onClick={() => setInteractionMode('inspect')}
              className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors duration-200 ${
                interactionMode === 'inspect'
                  ? 'bg-[var(--surface-3)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Crosshair size={18} strokeWidth={1.5} />
              <span>Probe</span>
            </button>
            <button
              type="button"
              onClick={() => setInteractionMode('add-waypoint')}
              className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors duration-200 ${
                interactionMode === 'add-waypoint'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Route size={18} strokeWidth={1.5} />
              <span>Add waypoint</span>
            </button>
            {!compact && (
              <button
                type="button"
                onClick={() => setInteractionMode('add-science-stop')}
                className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors duration-200 ${
                  interactionMode === 'add-science-stop'
                    ? 'bg-[var(--surface-3)] text-[var(--viz-teal)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Plus size={18} strokeWidth={1.5} />
                <span>Science stop</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setInteractionMode('pan')}
              className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors duration-200 ${
                interactionMode === 'pan'
                  ? 'bg-[var(--surface-3)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Move size={18} strokeWidth={1.5} />
              <span className="hidden sm:inline">Pan</span>
            </button>
          </div>

          {/* Zoom & Reset circular icon buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.5, Number((z + 0.35).toFixed(2))))}
              aria-label="Zoom in map"
              className="w-8 h-8 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] flex items-center justify-center transition-colors duration-200"
            >
              <Plus size={18} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.35).toFixed(2))))}
              aria-label="Zoom out map"
              className="w-8 h-8 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] flex items-center justify-center transition-colors duration-200"
            >
              <Minus size={18} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPanOffset({ dLat: 0, dLon: 0 });
              }}
              aria-label="Reset map view"
              title="Reset zoom and pan"
              className="w-8 h-8 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center transition-colors duration-200"
            >
              <RotateCcw size={18} strokeWidth={1.5} />
            </button>
            {!compact && (
              <button
                type="button"
                onClick={() => setIsFullscreen((f) => !f)}
                aria-label={isFullscreen ? 'Exit full screen map' : 'Full screen map'}
                className="w-8 h-8 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center transition-colors duration-200"
              >
                {isFullscreen ? (
                  <Minimize2 size={18} strokeWidth={1.5} />
                ) : (
                  <Maximize2 size={18} strokeWidth={1.5} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Planetary Canvas */}
      <div className="relative flex-1 min-h-[300px] select-none">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          data-testid="mars-map-canvas"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          className={`w-full h-full block ${
            interactionMode === 'pan'
              ? isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : 'cursor-crosshair'
          }`}
        />

        {/* Top-Left Translucent Overlay */}
        <div className="absolute top-3 left-3 pointer-events-none glass-overlay rounded-[10px] px-3 py-2 text-[11px] max-w-[calc(100%-1.5rem)] sm:max-w-[360px]">
          <div className="font-mono-tabular text-[var(--text)] font-medium">
            MOLA MEGDR + CTX Topographic Canvas (Demo Mode)
          </div>
          <div className="text-[var(--text-muted)] font-mono-tabular text-[11px]">
            {currentRegion.primarySource} · Zoom {zoom.toFixed(2)}x
          </div>
        </div>

        {/* Bottom HUD Row: Coordinate Pill + Perceptually Uniform Legend */}
        <div className="absolute inset-x-3 bottom-3 pointer-events-none flex flex-wrap items-end justify-between gap-2">
          {/* Bottom-Left Coordinate & Scale Pill */}
          <div className="flex flex-wrap items-center gap-2.5 glass-overlay rounded-[10px] px-3 py-1.5 text-[11px] font-mono-tabular max-w-full">
            <div>
              <span className="text-[var(--text-muted)] mr-1">CRS:</span>
              <span className="text-[var(--text)]">
                {formatMarsCoordinates(activeCoords.lat, activeCoords.lon, 4)}
              </span>
            </div>
            <div className="h-3 w-[1px] bg-white/10" />
            <div>
              <span className="text-[var(--text-muted)] mr-1">Z:</span>
              <span className="text-[var(--text)]">{activeCoords.elevationM} m</span>
            </div>
            <div className="h-3 w-[1px] bg-white/10" />
            <div>
              <span className="text-[var(--text-muted)] mr-1">Slope:</span>
              <span className="text-[var(--text)]">{activeCoords.slopeDeg.toFixed(1)}°</span>
            </div>
            <div className="h-3 w-[1px] bg-white/10 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <div
                style={{ width: `${scaleBarInfo.barPx}px` }}
                className="h-1.5 border-x border-b border-[var(--text)]"
              />
              <span className="text-[var(--text)]">{scaleBarInfo.label}</span>
            </div>
          </div>

          {/* Bottom-Right Perceptually Uniform Legend (Viridis / Cividis preserved) */}
          <div className="glass-overlay rounded-[10px] px-3 py-2 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="label-caps">
                {showSlopeLegend ? 'Slope (Cividis)' : 'MOLA Elev (Viridis)'}
              </span>
              <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                {showSlopeLegend
                  ? '0° to 24°'
                  : `${currentRegion.elevationRangeM[0]}m to ${currentRegion.elevationRangeM[1]}m`}
              </span>
            </div>
            <div className="flex h-2 w-40 rounded-full overflow-hidden border border-white/10">
              {(showSlopeLegend ? CIVIDIS_STOPS : VIRIDIS_STOPS).map((rgb, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` }}
                  className="flex-1 h-full"
                />
              ))}
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono-tabular text-[var(--text-muted)] pt-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--status-success)] inline-block" /> Start
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--viz-teal)] inline-block" /> Science
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" /> Dest / Route
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
