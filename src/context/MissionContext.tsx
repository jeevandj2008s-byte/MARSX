import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ENVIRONMENTAL_OBSERVATIONS,
  EXPLORATION_REGIONS,
  INITIAL_MISSION_CONFIG,
  INITIAL_ROUTE_WAYPOINTS,
  INITIAL_SCIENCE_TARGETS,
  INITIAL_SCIENTIFIC_LAYERS,
} from '../data/marsMissionData';
import type {
  AIMissionBriefing,
  EnvironmentalObservation,
  ExplorationRegion,
  ExplorationRegionId,
  MissionConfig,
  MissionMetricsSummary,
  PlanetaryCoordinates,
  RouteWaypoint,
  ScienceTarget,
  ScientificLayer,
  ViewId,
  WaypointType,
} from '../types/mission';
import { buildDeterministicMissionBriefing } from '../utils/briefingBuilder';
import { computeMissionMetrics, sampleJezeroCraterTerrain } from '../utils/marsGeospatial';
import {
  loadTerrainEngine,
  TerrainEngine,
  TerrainQueryResult,
} from '../terrainIntelligence';

interface MissionContextValue {
  terrainEngine: TerrainEngine | null;
  terrainQuery: TerrainQueryResult | null;
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  mobileNavOpen: boolean;
  setMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
  rightPanelOpen: boolean;
  setRightPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;

  config: MissionConfig;
  updateConfig: (patch: Partial<MissionConfig>) => void;
  currentRegion: ExplorationRegion;
  selectRegion: (regionId: ExplorationRegionId) => void;

  layers: ScientificLayer[];
  toggleLayerVisibility: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  resetLayersToDefault: () => void;

  targets: ScienceTarget[];
  selectedTargetId: string | null;
  setSelectedTargetId: (id: string | null) => void;
  toggleTargetForMission: (targetId: string) => void;

  waypoints: RouteWaypoint[];
  selectedWaypointId: string | null;
  setSelectedWaypointId: (id: string | null) => void;
  addWaypointAtCoords: (
    lat: number,
    lon: number,
    type?: WaypointType,
    customLabel?: string,
    targetId?: string
  ) => void;
  addScienceTargetToRoute: (targetId: string) => void;
  removeLastWaypoint: () => void;
  removeWaypointById: (waypointId: string) => void;
  updateWaypointDwell: (waypointId: string, dwellMinutes: number) => void;
  clearRoute: () => void;
  loadDefaultRoute: () => void;

  inspectedPoint: PlanetaryCoordinates;
  inspectCoordinates: (lat: number, lon: number) => void;

  metrics: MissionMetricsSummary;
  environmentalData: EnvironmentalObservation[];

  briefing: AIMissionBriefing;
  isGeneratingBriefing: boolean;
  briefingWarning: string | null;
  generateBriefing: () => Promise<void>;
}

const MissionContext = createContext<MissionContextValue | null>(null);

function normalizeWaypointTypes(list: RouteWaypoint[]): RouteWaypoint[] {
  if (list.length === 0) return [];
  return list.map((wp, idx) => {
    if (idx === 0) {
      return { ...wp, type: 'start' };
    }
    if (wp.targetId || wp.type === 'science-stop') {
      return { ...wp, type: 'science-stop' };
    }
    if (idx === list.length - 1) {
      return { ...wp, type: 'destination' };
    }
    return { ...wp, type: 'waypoint' };
  });
}

export const MissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(false);

  // Inspector panel is always closed by default on page switch and initial load
  useEffect(() => {
    setRightPanelOpen(false);
  }, [activeView]);

  const [terrainEngine, setTerrainEngine] = useState<TerrainEngine | null>(null);

  useEffect(() => {
    loadTerrainEngine({ baseUrl: '/data' })
      .then((engine) => setTerrainEngine(engine))
      .catch((err) => console.warn('TerrainEngine load notice:', err));
  }, []);

  const [config, setConfig] = useState<MissionConfig>(INITIAL_MISSION_CONFIG);
  const [layers, setLayers] = useState<ScientificLayer[]>(INITIAL_SCIENTIFIC_LAYERS);
  const [targets, setTargets] = useState<ScienceTarget[]>(INITIAL_SCIENCE_TARGETS);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(
    INITIAL_SCIENCE_TARGETS[0].id
  );
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>(INITIAL_ROUTE_WAYPOINTS);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(
    INITIAL_ROUTE_WAYPOINTS[0].id
  );
  const [inspectedPoint, setInspectedPoint] = useState<PlanetaryCoordinates>(() =>
    sampleJezeroCraterTerrain(18.4447, 77.4508)
  );

  const terrainQuery = useMemo(() => {
    if (!terrainEngine) return null;
    return terrainEngine.query(inspectedPoint.lon, inspectedPoint.lat);
  }, [terrainEngine, inspectedPoint.lat, inspectedPoint.lon]);

  const currentRegion = useMemo(
    () => EXPLORATION_REGIONS[config.regionId] ?? EXPLORATION_REGIONS['jezero-crater-floor'],
    [config.regionId]
  );

  const metrics = useMemo(
    () => computeMissionMetrics(waypoints, config, targets, layers),
    [waypoints, config, targets, layers]
  );

  const deterministicBriefing = useMemo(
    () =>
      buildDeterministicMissionBriefing({
        config,
        region: currentRegion,
        waypoints,
        metrics,
        targets,
        layers,
      }),
    [config, currentRegion, waypoints, metrics, targets, layers]
  );

  const [customBriefing, setCustomBriefing] = useState<AIMissionBriefing | null>(null);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState<boolean>(false);
  const [briefingWarning, setBriefingWarning] = useState<string | null>(null);

  const briefing = customBriefing ?? deterministicBriefing;

  const updateConfig = useCallback((patch: Partial<MissionConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const selectRegion = useCallback((regionId: ExplorationRegionId) => {
    setConfig((prev) => ({ ...prev, regionId }));
    const reg = EXPLORATION_REGIONS[regionId];
    if (reg) {
      setInspectedPoint(sampleJezeroCraterTerrain(reg.center.lat, reg.center.lon));
    }
  }, []);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== layerId) return layer;
        if (layer.status === 'unavailable' || layer.status === 'error') {
          return layer;
        }
        const nextVisible = !layer.visible;
        return {
          ...layer,
          visible: nextVisible,
          status: nextVisible ? 'active' : 'available',
        };
      })
    );
  }, []);

  const setLayerOpacity = useCallback((layerId: string, opacity: number) => {
    const clamped = Math.max(0.1, Math.min(1, opacity));
    setLayers((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, opacity: clamped } : layer))
    );
  }, []);

  const resetLayersToDefault = useCallback(() => {
    setLayers(INITIAL_SCIENTIFIC_LAYERS);
  }, []);

  const toggleTargetForMission = useCallback(
    (targetId: string) => {
      const target = targets.find((t) => t.id === targetId);
      if (!target) return;
      const nextSelected = !target.selectedForMission;

      setTargets((prev) =>
        prev.map((t) => (t.id === targetId ? { ...t, selectedForMission: nextSelected } : t))
      );

      if (nextSelected) {
        setWaypoints((prev) => {
          if (prev.some((wp) => wp.targetId === targetId)) return prev;
          const newWp: RouteWaypoint = {
            id: `wp-tgt-${target.id}-${Date.now()}`,
            label: target.name,
            type: prev.length === 0 ? 'start' : 'science-stop',
            coords: target.coords,
            targetId: target.id,
            dwellMinutes: config.scienceStopMinutes,
          };
          return normalizeWaypointTypes([...prev, newWp]);
        });
      } else {
        setWaypoints((prev) =>
          normalizeWaypointTypes(prev.filter((wp) => wp.targetId !== targetId))
        );
      }
    },
    [targets, config.scienceStopMinutes]
  );

  const addWaypointAtCoords = useCallback(
    (
      lat: number,
      lon: number,
      type?: WaypointType,
      customLabel?: string,
      targetId?: string
    ) => {
      const sampled = sampleJezeroCraterTerrain(lat, lon);
      setInspectedPoint(sampled);
      setWaypoints((prev) => {
        const index = prev.length + 1;
        const resolvedType: WaypointType =
          prev.length === 0
            ? 'start'
            : type ?? (targetId ? 'science-stop' : 'destination');
        const defaultLabel =
          prev.length === 0
            ? 'Staging Base (WP-01)'
            : resolvedType === 'science-stop'
              ? `Science Station ${index}`
              : `Waypoint WP-${String(index).padStart(2, '0')}`;

        const nextWp: RouteWaypoint = {
          id: `wp-${Date.now()}-${index}`,
          label: customLabel ?? defaultLabel,
          type: resolvedType,
          coords: sampled,
          targetId,
          dwellMinutes:
            resolvedType === 'science-stop' ? config.scienceStopMinutes : 0,
        };
        const updated = normalizeWaypointTypes([...prev, nextWp]);
        setSelectedWaypointId(nextWp.id);
        return updated;
      });
    },
    [config.scienceStopMinutes]
  );

  const addScienceTargetToRoute = useCallback(
    (targetId: string) => {
      const target = targets.find((t) => t.id === targetId);
      if (!target) return;
      setTargets((prev) =>
        prev.map((t) => (t.id === targetId ? { ...t, selectedForMission: true } : t))
      );
      setSelectedTargetId(targetId);
      setInspectedPoint(target.coords);
      setWaypoints((prev) => {
        if (prev.some((wp) => wp.targetId === targetId)) return prev;
        const newWp: RouteWaypoint = {
          id: `wp-tgt-${target.id}-${Date.now()}`,
          label: target.name,
          type: prev.length === 0 ? 'start' : 'science-stop',
          coords: target.coords,
          targetId: target.id,
          dwellMinutes: config.scienceStopMinutes,
        };
        const updated = normalizeWaypointTypes([...prev, newWp]);
        setSelectedWaypointId(newWp.id);
        return updated;
      });
    },
    [targets, config.scienceStopMinutes]
  );

  const removeLastWaypoint = useCallback(() => {
    setWaypoints((prev) => {
      if (prev.length === 0) return prev;
      const removed = prev[prev.length - 1];
      if (removed.targetId) {
        setTargets((tPrev) =>
          tPrev.map((t) =>
            t.id === removed.targetId ? { ...t, selectedForMission: false } : t
          )
        );
      }
      return normalizeWaypointTypes(prev.slice(0, -1));
    });
  }, []);

  const removeWaypointById = useCallback((waypointId: string) => {
    setWaypoints((prev) => {
      const targetWp = prev.find((w) => w.id === waypointId);
      if (targetWp?.targetId) {
        setTargets((tPrev) =>
          tPrev.map((t) =>
            t.id === targetWp.targetId ? { ...t, selectedForMission: false } : t
          )
        );
      }
      return normalizeWaypointTypes(prev.filter((w) => w.id !== waypointId));
    });
  }, []);

  const updateWaypointDwell = useCallback((waypointId: string, dwellMinutes: number) => {
    const clamped = Math.max(0, Math.min(240, Math.round(dwellMinutes)));
    setWaypoints((prev) =>
      prev.map((w) => (w.id === waypointId ? { ...w, dwellMinutes: clamped } : w))
    );
  }, []);

  const clearRoute = useCallback(() => {
    setWaypoints([]);
    setSelectedWaypointId(null);
    setTargets((prev) => prev.map((t) => ({ ...t, selectedForMission: false })));
  }, []);

  const loadDefaultRoute = useCallback(() => {
    setWaypoints(INITIAL_ROUTE_WAYPOINTS);
    setSelectedWaypointId(INITIAL_ROUTE_WAYPOINTS[0].id);
    setTargets(INITIAL_SCIENCE_TARGETS);
  }, []);

  const inspectCoordinates = useCallback((lat: number, lon: number) => {
    setInspectedPoint(sampleJezeroCraterTerrain(lat, lon));
  }, []);

  const generateBriefing = useCallback(async () => {
    setIsGeneratingBriefing(true);
    setBriefingWarning(null);
    const fallback = buildDeterministicMissionBriefing({
      config,
      region: currentRegion,
      waypoints,
      metrics,
      targets,
      layers,
    });

    try {
      const response = await fetch('/api/mission/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            missionConfig: config,
            region: {
              name: currentRegion.name,
              quadrangle: currentRegion.quadrangle,
              crs: currentRegion.crsLabel,
            },
            metrics: {
              hasRoute: metrics.hasRoute,
              oneWayDistanceM: metrics.oneWayDistanceM,
              totalDistanceM: metrics.totalDistanceM,
              netElevationChangeM: metrics.netElevationChangeM,
              totalAscentM: metrics.totalAscentM,
              totalDescentM: metrics.totalDescentM,
              meanSlopeDeg: metrics.meanSlopeDeg,
              maxSlopeDeg: metrics.maxSlopeDeg,
              traverseMinutes: metrics.traverseMinutes,
              scienceStopMinutesTotal: metrics.scienceStopMinutesTotal,
              contingencyMinutes: metrics.contingencyMinutes,
              totalDurationMinutes: metrics.totalDurationMinutes,
              timeBudgetMinutes: metrics.timeBudgetMinutes,
              remainingBudgetMinutes: metrics.remainingBudgetMinutes,
              isOverBudget: metrics.isOverBudget,
              segments: metrics.segments,
              warnings: metrics.warnings,
            },
            selectedTargets: targets
              .filter((t) => t.selectedForMission)
              .map((t) => ({
                name: t.name,
                code: t.code,
                category: t.category,
                coords: t.coords,
                geologicalUnit: t.geologicalUnit,
                source: t.source,
              })),
            activeLayers: layers
              .filter((l) => l.visible && (l.status === 'available' || l.status === 'active'))
              .map((l) => ({
                name: l.name,
                shortCode: l.shortCode,
                source: l.source,
                resolution: l.spatialResolution,
              })),
            unavailableLayers: layers
              .filter((l) => l.status === 'unavailable')
              .map((l) => ({
                name: l.name,
                shortCode: l.shortCode,
                reason: l.unavailableReason,
              })),
          },
          fallbackBriefing: fallback,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data?.briefing) {
        setCustomBriefing(data.briefing);
      } else {
        setCustomBriefing(fallback);
      }
      if (data?.warning) {
        setBriefingWarning(data.warning);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Service unreachable';
      setBriefingWarning(
        `AI synthesis endpoint fallback active (${msg}). Showing deterministic telemetry compilation.`
      );
      setCustomBriefing(fallback);
    } finally {
      setIsGeneratingBriefing(false);
    }
  }, [config, currentRegion, waypoints, metrics, targets, layers]);

  const value: MissionContextValue = {
    terrainEngine,
    terrainQuery,
    activeView,
    setActiveView,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
    rightPanelOpen,
    setRightPanelOpen,
    config,
    updateConfig,
    currentRegion,
    selectRegion,
    layers,
    toggleLayerVisibility,
    setLayerOpacity,
    resetLayersToDefault,
    targets,
    selectedTargetId,
    setSelectedTargetId,
    toggleTargetForMission,
    waypoints,
    selectedWaypointId,
    setSelectedWaypointId,
    addWaypointAtCoords,
    addScienceTargetToRoute,
    removeLastWaypoint,
    removeWaypointById,
    updateWaypointDwell,
    clearRoute,
    loadDefaultRoute,
    inspectedPoint,
    inspectCoordinates,
    metrics,
    environmentalData: ENVIRONMENTAL_OBSERVATIONS,
    briefing,
    isGeneratingBriefing,
    briefingWarning,
    generateBriefing,
  };

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
};

export function useMission(): MissionContextValue {
  const ctx = useContext(MissionContext);
  if (!ctx) {
    throw new Error('useMission must be used within a MissionProvider');
  }
  return ctx;
}
