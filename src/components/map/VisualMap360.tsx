import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import ImageLayer from 'ol/layer/Image.js';
import Static from 'ol/source/ImageStatic.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Cluster from 'ol/source/Cluster.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import { Style, Stroke, Fill, Circle as CircleStyle, Text, Icon } from 'ol/style.js';
import Projection from 'ol/proj/Projection.js';
import { addProjection, addCoordinateTransforms } from 'ol/proj.js';
import type { FeatureLike } from 'ol/Feature.js';
import type RenderEvent from 'ol/render/Event.js';
import {
  Compass,
  Crosshair,
  Eye,
  Glasses,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Route,
  Split,
  HelpCircle,
  Award,
  ChevronRight,
  ChevronLeft,
  Camera,
  MapPin,
  ExternalLink,
  Navigation,
} from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import { PanoramaViewer360, Viewpoint360 } from './PanoramaViewer360';

type MapInteractionMode = 'inspect' | 'add-waypoint' | 'add-science-stop' | 'pan';

// -------------------------------------------------------------
// Mars Projection Definition (EPSG:49911 Equirectangular)
// Radius = 3,396,190 meters (IAU 2000 Mars Spheroid)
// -------------------------------------------------------------
const R_MARS = 3396190;
const MARS_PROJ_CODE = 'EPSG:49911';

let marsProj: Projection;
try {
  marsProj = new Projection({
    code: MARS_PROJ_CODE,
    extent: [-10668848.652, -5215881.563, 10668848.652, 5215881.563],
    units: 'm',
  });
  addProjection(marsProj);

  addCoordinateTransforms(
    'EPSG:4326',
    marsProj,
    (c) => [R_MARS * ((c[0] * Math.PI) / 180), R_MARS * ((c[1] * Math.PI) / 180)],
    (c) => [((c[0] * 180) / Math.PI) / R_MARS, ((c[1] * 180) / Math.PI) / R_MARS]
  );
} catch {
  // Projection already added
}

const lonLatToM = (lon: number, lat: number): [number, number] => [
  R_MARS * ((lon * Math.PI) / 180),
  R_MARS * ((lat * Math.PI) / 180),
];

const mToLonLat = (x: number, y: number): [number, number] => [
  ((x * 180) / Math.PI) / R_MARS,
  ((y * 180) / Math.PI) / R_MARS,
];

// Extents matching downloaded high-res assets
const OVERVIEW_EXTENT = [4563816.3, 1072791.9, 4611233.1, 1114280.9];
const NERETVA_EXTENT = [4576856.1, 1091163.6, 4592266.9, 1095905.1];

// -------------------------------------------------------------
// Jezero Crater Reference Viewpoints (Matching maps.planet.fu-berlin.de/jezero)
// -------------------------------------------------------------
const JEZERO_VIEWPOINTS: Viewpoint360[] = [
  {
    id: 'viewpoint-octavia-butler',
    name: 'Octavia E. Butler Landing',
    sol: 'Sol 0 – Sol 4',
    lat: 18.4447,
    lon: 77.4508,
    elevationM: -2574,
    feature: 'Touchdown Datum & Volcanic Floor',
    imageUrl: '/panoramas/octavia-butler-landing.jpg',
    description:
      'The touchdown site of the Mars 2020 Perseverance rover on the smooth basaltic floor of Jezero Crater. Fine aeolian dust veneers igneous bedrock units.',
  },
  {
    id: 'viewpoint-van-zyl',
    name: 'Van Zyl Overlook',
    sol: 'Sol 73',
    lat: 18.4350,
    lon: 77.4440,
    elevationM: -2570,
    feature: 'Ingenuity Airfield & Maaz Ridge',
    imageUrl: '/panoramas/van-zyl-overlook.jpg',
    description:
      'Elevated rock ledge overlooking Wright Brothers Airfield and the South Séítah megaripple field during early Ingenuity helicopter flight trials.',
  },
  {
    id: 'viewpoint-three-forks',
    name: 'Three Forks Sample Depot',
    sol: 'Sol 653',
    lat: 18.4314,
    lon: 77.4082,
    elevationM: -2545,
    feature: 'Backup Sample Return Cache',
    imageUrl: '/panoramas/three-forks-depot.jpg',
    description:
      'Flat depot apron where 10 duplicate sealed titanium sample tubes were safely deposited on the surface for the Mars Sample Return mission.',
  },
  {
    id: 'viewpoint-belva-delta',
    name: 'Belva Crater & Delta Fan',
    sol: 'Sol 807',
    lat: 18.4410,
    lon: 77.3825,
    elevationM: -2490,
    feature: 'Ancient River Delta & Coarse Conglomerates',
    imageUrl: '/panoramas/belva-delta-crater.jpg',
    description:
      'High vantage point over the ancient river delta fan scarp. Massive cross-stratified conglomerate beds reveal high-energy paleoflood channels into the paleolake.',
  },
  {
    id: 'viewpoint-neretva-vallis',
    name: 'Neretva Vallis Inflow Channel',
    sol: 'Sol 1140',
    lat: 18.4552,
    lon: 77.3450,
    elevationM: -2420,
    feature: 'Ancient River Canyon Inflow',
    imageUrl: '/panoramas/neretva-vallis.jpg',
    description:
      'Deep fluvial breach through the western rim of Jezero Crater carved by catastrophic paleoflood surges that filled the ancient lake basin.',
  },
  {
    id: 'viewpoint-groloy-viking',
    name: 'Groloy Viking',
    sol: 'Sol 1932',
    lat: 18.4720,
    lon: 77.2850,
    elevationM: -2300,
    feature: 'Crater Rim Boulder Fields',
    imageUrl: '/panoramas/groloy-viking.jpg',
    description:
      'High elevation ascent through ancient Noachian crustal megabreccia and impact melt rocks on the rim of Jezero Crater.',
  },
  {
    id: 'viewpoint-marble-mountain',
    name: 'Marble Mountain',
    sol: 'Sol 1968',
    lat: 18.4750,
    lon: 77.2700,
    elevationM: -2250,
    feature: 'Western Rim Highland Carbonates',
    imageUrl: '/panoramas/marble-mountain.jpg',
    description:
      'Exposed crystalline carbonate beds on the western rim crest with panoramic views across the entire Jezero impact basin.',
  },
];

const INGENUITY_AIRFIELDS = [
  { name: 'Wright Brothers Field', sol: 'Sol 39', lat: 18.4446, lon: 77.4508 },
  { name: 'Airfield B (Sol 70)', sol: 'Sol 70', lat: 18.4380, lon: 77.4420 },
  { name: 'Airfield C (Sol 85)', sol: 'Sol 85', lat: 18.4320, lon: 77.4330 },
  { name: 'Airfield J (Sol 140)', sol: 'Sol 140', lat: 18.4280, lon: 77.4200 },
];

interface MapLayerConfig {
  id: string;
  name: string;
  category: 'base' | 'overlay';
  visible: boolean;
  opacity: number;
  source: string;
}

interface VisualMap360Props {
  heightClass?: string;
  compact?: boolean;
}

type SidebarTab = 'layers' | 'panoramas' | 'info' | 'compare' | null;

export const VisualMap360: React.FC<VisualMap360Props> = ({
  heightClass = 'h-[580px]',
  compact = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);

  // Layer references for dynamic updates
  const overviewBaseLayerRef = useRef<ImageLayer<Static> | null>(null);
  const neretvaBaseLayerRef = useRef<ImageLayer<Static> | null>(null);
  const dtmLayerRef = useRef<ImageLayer<Static> | null>(null);
  const overviewContoursLayerRef = useRef<ImageLayer<Static> | null>(null);
  const neretvaContoursLayerRef = useRef<ImageLayer<Static> | null>(null);
  const overviewChannelsLayerRef = useRef<ImageLayer<Static> | null>(null);
  const neretvaChannelsLayerRef = useRef<ImageLayer<Static> | null>(null);
  const traverseSourceRef = useRef<VectorSource | null>(null);
  const traverseLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const clusterLayerRef = useRef<VectorLayer<Cluster> | null>(null);
  const userRouteSourceRef = useRef<VectorSource | null>(null);
  const userRouteLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  const {
    waypoints,
    addWaypointAtCoords,
    selectedWaypointId,
    setSelectedWaypointId,
    inspectCoordinates,
  } = useMission();

  const waypointsRef = useRef(waypoints);
  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);

  // Active 360 Panorama Viewer Viewpoint
  const [activeViewpoint, setActiveViewpoint] = useState<Viewpoint360 | null>(null);

  // Sidebar state (matching sidebar-v2, collapsed by default)
  const [activeTab, setActiveTab] = useState<SidebarTab>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showCreditsModal, setShowCreditsModal] = useState<boolean>(false);

  // Compare mode split position (0% to 100%)
  const [compareSplit, setCompareSplit] = useState<number>(50);
  const compareSplitRef = useRef<number>(50);
  const activeTabRef = useRef<SidebarTab>(null);
  const isDraggingSplit = useRef<boolean>(false);

  useEffect(() => {
    compareSplitRef.current = compareSplit;
  }, [compareSplit]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.render();
    }
    // Update OpenLayers canvas size after the 250ms slide transition
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.updateSize();
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Map interactive state
  const [interactionMode, setInteractionMode] = useState<MapInteractionMode>('pan');
  const interactionModeRef = useRef<MapInteractionMode>(interactionMode);
  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);
  const [hoverCoords, setHoverCoords] = useState<{
    lat: number;
    lon: number;
    elevationM: number;
    slopeDeg: number;
  } | null>({
    lat: 18.4447,
    lon: 77.4508,
    elevationM: -2574,
    slopeDeg: 3.2,
  });
  const [currentZoom, setCurrentZoom] = useState<number>(12);
  const [scaleDistanceText, setScaleDistanceText] = useState<string>('5 km');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Map layers
  const [layers, setLayers] = useState<MapLayerConfig[]>([
    { id: 'layer-hirise', name: 'HiRISE Delta Mosaic (0.25m/px)', category: 'base', visible: true, opacity: 1.0, source: 'NASA/JPL/Univ. of Arizona' },
    { id: 'layer-hrsc-color', name: 'HRSC Mars Express True Color', category: 'base', visible: true, opacity: 0.9, source: 'ESA/DLR/FU-Berlin' },
    { id: 'layer-ctx-context', name: 'CTX Global Mosaic (6m/px)', category: 'base', visible: false, opacity: 0.8, source: 'NASA/JPL/MSSS' },
    { id: 'layer-mola-topo', name: 'MOLA Topography & Hillshade', category: 'overlay', visible: false, opacity: 0.75, source: 'NASA GSFC / MOLA Team' },
    { id: 'layer-contours', name: 'MOLA Elevation Contour Lines', category: 'overlay', visible: true, opacity: 0.85, source: 'MOLA DTM / FU-Berlin' },
    { id: 'layer-channels', name: 'Neretva Vallis Inflow Channels', category: 'overlay', visible: true, opacity: 0.95, source: 'ESA / NASA / FU-Berlin' },
    { id: 'layer-route', name: 'Perseverance Traverse & Waypoints', category: 'overlay', visible: true, opacity: 1.0, source: 'NASA Mars 2020 Telemetry' },
    { id: 'layer-panoramas', name: '360° Panoramic Viewpoints', category: 'overlay', visible: true, opacity: 1.0, source: 'Mastcam-Z Science Archive' },
  ]);

  // Elevation calculation helper
  const sampleElevation = useCallback((lat: number, lon: number) => {
    const westOffset = (77.45 - lon) * 3500;
    const baseElev = -2574 + Math.max(0, westOffset);
    return Math.round(baseElev);
  }, []);

  const sampleSlope = useCallback((lat: number, lon: number) => {
    const dLat = (lat - 18.435) * 111000;
    const dLon = (lon - 77.405) * 111000 * Math.cos((18.435 * Math.PI) / 180);
    const distM = Math.sqrt(dLat * dLat + dLon * dLon);
    return Number(Math.min(24, Math.max(0.5, (distM / 1000) * 1.8)).toFixed(1));
  }, []);

  // -------------------------------------------------------------
  // Initialize OpenLayers Map
  // -------------------------------------------------------------
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // 1. Raster Base & Overlay Layers
    const overviewBase = new ImageLayer({
      source: new Static({
        url: '/assets/jezero/jezero_overview_base.jpg',
        imageExtent: OVERVIEW_EXTENT,
        projection: MARS_PROJ_CODE,
      }),
      visible: true,
      opacity: 1.0,
    });
    overviewBaseLayerRef.current = overviewBase;

    const neretvaBase = new ImageLayer({
      source: new Static({
        url: '/assets/jezero/jezero_neretva_base.jpg',
        imageExtent: NERETVA_EXTENT,
        projection: MARS_PROJ_CODE,
      }),
      visible: true,
      opacity: 1.0,
      minZoom: 11.5,
    });
    neretvaBaseLayerRef.current = neretvaBase;

    const dtmHillshade = new ImageLayer({
      source: new Static({
        url: '/assets/jezero/jezero_overview_dtm.jpg',
        imageExtent: OVERVIEW_EXTENT,
        projection: MARS_PROJ_CODE,
      }),
      visible: false,
      opacity: 0.8,
    });
    dtmLayerRef.current = dtmHillshade;

    // Swipe / Compare Mode clipping on dtmHillshade
    dtmHillshade.on('prerender', (evt: RenderEvent) => {
      if (activeTabRef.current !== 'compare') return;
      const ctx = evt.context as CanvasRenderingContext2D;
      if (!ctx || !mapInstanceRef.current) return;
      const mapSize = mapInstanceRef.current.getSize();
      if (!mapSize) return;
      const width = mapSize[0];
      const height = mapSize[1];
      const splitPx = (compareSplitRef.current / 100) * width;

      ctx.save();
      ctx.beginPath();
      // Clip right side for DTM hillshade comparison
      ctx.rect(splitPx, 0, width - splitPx, height);
      ctx.clip();
    });

    dtmHillshade.on('postrender', (evt: RenderEvent) => {
      if (activeTabRef.current !== 'compare') return;
      const ctx = evt.context as CanvasRenderingContext2D;
      if (ctx) {
        ctx.restore();
      }
    });

    const overviewContours = new ImageLayer({
      source: new Static({
        url: '/assets/jezero/jezero_overview_contours.png',
        imageExtent: OVERVIEW_EXTENT,
        projection: MARS_PROJ_CODE,
      }),
      visible: true,
      opacity: 0.85,
    });
    overviewContoursLayerRef.current = overviewContours;

    const neretvaContours = new ImageLayer({
      source: new Static({
        url: '/assets/jezero/jezero_neretva_contours.png',
        imageExtent: NERETVA_EXTENT,
        projection: MARS_PROJ_CODE,
      }),
      visible: true,
      opacity: 0.9,
      minZoom: 11.5,
    });
    neretvaContoursLayerRef.current = neretvaContours;

    const overviewChannels = new ImageLayer({
      source: new Static({
        url: '/assets/jezero/jezero_overview_channels.png',
        imageExtent: OVERVIEW_EXTENT,
        projection: MARS_PROJ_CODE,
      }),
      visible: true,
      opacity: 0.95,
    });
    overviewChannelsLayerRef.current = overviewChannels;

    const neretvaChannels = new ImageLayer({
      source: new Static({
        url: '/assets/jezero/jezero_neretva_channels.png',
        imageExtent: NERETVA_EXTENT,
        projection: MARS_PROJ_CODE,
      }),
      visible: true,
      opacity: 0.95,
      minZoom: 11.5,
    });
    neretvaChannelsLayerRef.current = neretvaChannels;

    // 2. Rover Traverse Vector Layer
    const travSource = new VectorSource();
    traverseSourceRef.current = travSource;

    const travLayer = new VectorLayer({
      source: travSource,
      visible: true,
      opacity: 1.0,
      style: (feat) => {
        const geomType = feat.getGeometry()?.getType();
        if (geomType === 'LineString' || geomType === 'MultiLineString') {
          return new Style({
            stroke: new Stroke({
              color: '#4ade80', // Thin vibrant green line matching screenshot 1
              width: 2.2,
            }),
          });
        }
        // Waypoint points
        return new Style({
          image: new CircleStyle({
            radius: 2.5,
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#166534', width: 1 }),
          }),
        });
      },
    });
    traverseLayerRef.current = travLayer;

    // Fetch official NASA M20 traverse GeoJSON
    fetch('/data/M20_traverse.json')
      .then((res) => res.json())
      .then((geojson) => {
        const format = new GeoJSON();
        const features = format.readFeatures(geojson, {
          dataProjection: 'EPSG:4326',
          featureProjection: MARS_PROJ_CODE,
        });
        travSource.addFeatures(features);
      })
      .catch((err) => console.warn('Could not load M20_traverse.json:', err));

    // 3. Viewpoints & Clusters Vector Layer
    const viewpointsSource = new VectorSource();

    // Add 360 Viewpoints
    JEZERO_VIEWPOINTS.forEach((vp) => {
      const coords = lonLatToM(vp.lon, vp.lat);
      const feat = new Feature({
        geometry: new Point(coords),
        type: 'panorama',
        viewpoint: vp,
      });
      viewpointsSource.addFeature(feat);
    });

    // Add Ingenuity Helicopter Airfields
    INGENUITY_AIRFIELDS.forEach((af) => {
      const coords = lonLatToM(af.lon, af.lat);
      const feat = new Feature({
        geometry: new Point(coords),
        type: 'helicopter',
        name: af.name,
        sol: af.sol,
      });
      viewpointsSource.addFeature(feat);
    });

    const clusterSource = new Cluster({
      distance: 35,
      source: viewpointsSource,
    });

    // Cluster Style Function matching Ground Truth Screenshot 1
    const clusterStyle = (feature: FeatureLike) => {
      const clustered = feature.get('features') as Feature[];
      const count = clustered ? clustered.length : 1;

      if (count > 1) {
        // White circular cluster badge with black outline & count
        return new Style({
          image: new CircleStyle({
            radius: 13,
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#0f172a', width: 2 }),
          }),
          text: new Text({
            text: count.toString(),
            fill: new Fill({ color: '#0f172a' }),
            font: 'bold 11px Inter, sans-serif',
            offsetY: 1,
          }),
        });
      }

      // Single feature
      const single = clustered[0];
      const type = single.get('type');

      if (type === 'helicopter') {
        // White Ingenuity Helicopter icon matching Screenshot 1
        return new Style({
          image: new Icon({
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2" fill="%23ffffff"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="12" y1="4" x2="12" y2="20"/><circle cx="4" cy="12" r="2" fill="%23f59e0b"/><circle cx="20" cy="12" r="2" fill="%23f59e0b"/><circle cx="12" cy="4" r="2" fill="%23f59e0b"/><circle cx="12" cy="20" r="2" fill="%23f59e0b"/></svg>',
            scale: 1.05,
          }),
        });
      }

      // White 360 Camera Marker matching Screenshot 1
      return new Style({
        image: new Icon({
          src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><rect x="3" y="5" width="24" height="20" rx="6" fill="%23ffffff" stroke="%230f172a" stroke-width="2"/><circle cx="15" cy="15" r="5.2" fill="%230f172a"/><circle cx="15" cy="15" r="2.4" fill="%23f29a1f"/><circle cx="21" cy="9" r="1.5" fill="%230f172a"/></svg>',
          scale: 1,
        }),
      });
    };

    const clusterLayer = new VectorLayer({
      source: clusterSource,
      style: clusterStyle,
      visible: true,
      opacity: 1.0,
      zIndex: 20,
    });
    clusterLayerRef.current = clusterLayer;

    // 3b. Active User Route Vector Layer
    const userRouteSource = new VectorSource();
    userRouteSourceRef.current = userRouteSource;

    const userRouteLayer = new VectorLayer({
      source: userRouteSource,
      zIndex: 35,
      style: (feat) => {
        const isRouteLine = feat.get('isRouteLine');
        if (isRouteLine) {
          return [
            new Style({
              stroke: new Stroke({
                color: 'rgba(245, 158, 11, 0.35)',
                width: 8,
              }),
            }),
            new Style({
              stroke: new Stroke({
                color: '#f59e0b',
                width: 3.5,
              }),
            }),
          ];
        }

        const isSelected = feat.get('isSelected');
        const wpType = feat.get('type') as string;
        const label = (feat.get('label') as string) || '';

        let fillColor = '#f59e0b';
        let radius = 8;
        if (wpType === 'start') {
          fillColor = '#10b981';
          radius = 9;
        } else if (wpType === 'destination') {
          fillColor = '#ef4444';
          radius = 9;
        } else if (wpType === 'science-stop') {
          fillColor = '#06b6d4';
          radius = 8;
        }

        const styles: Style[] = [];

        if (isSelected) {
          styles.push(
            new Style({
              image: new CircleStyle({
                radius: radius + 5,
                stroke: new Stroke({ color: '#f59e0b', width: 2.5 }),
              }),
            })
          );
        }

        styles.push(
          new Style({
            image: new CircleStyle({
              radius,
              fill: new Fill({ color: fillColor }),
              stroke: new Stroke({ color: '#ffffff', width: 2 }),
            }),
            text: new Text({
              text: label,
              font: 'bold 11px Inter, system-ui, sans-serif',
              fill: new Fill({ color: '#FFF4E6' }),
              backgroundFill: new Fill({ color: 'rgba(15, 12, 10, 0.90)' }),
              backgroundStroke: new Stroke({
                color: isSelected ? '#f59e0b' : 'rgba(255, 255, 255, 0.35)',
                width: isSelected ? 2 : 1,
              }),
              padding: [2, 5, 2, 5],
              offsetY: -16,
            }),
          })
        );

        return styles;
      },
    });
    userRouteLayerRef.current = userRouteLayer;

    // 4. Center on Jezero Crater Delta Scarp
    const initialCenter = lonLatToM(77.38, 18.445);
    const view = new View({
      projection: MARS_PROJ_CODE,
      center: initialCenter,
      zoom: 12,
      minZoom: 9.5,
      maxZoom: 18,
      extent: [4500000, 1040000, 4650000, 1140000],
    });

    // 5. Build Map Instance
    const map = new Map({
      target: container,
      layers: [
        overviewBase,
        neretvaBase,
        dtmHillshade,
        overviewContours,
        neretvaContours,
        overviewChannels,
        neretvaChannels,
        travLayer,
        clusterLayer,
        userRouteLayer,
      ],
      view: view,
      controls: [], // We use our custom matching controls
    });
    mapInstanceRef.current = map;

    // View change listener to update zoom and scale text
    view.on('change:resolution', () => {
      const z = view.getZoom();
      if (z) {
        setCurrentZoom(Number(z.toFixed(1)));
        const res = view.getResolution() || 1;
        const barMeters = res * 90;
        if (barMeters >= 1000) {
          setScaleDistanceText(`${(barMeters / 1000).toFixed(1)} km`);
        } else {
          setScaleDistanceText(`${Math.round(barMeters)} m`);
        }
      }
    });

    // Pointer move for live coordinates
    map.on('pointermove', (evt) => {
      if (evt.dragging) return;
      const coords = evt.coordinate;
      const [lon, lat] = mToLonLat(coords[0], coords[1]);
      setHoverCoords({
        lon: Number(lon.toFixed(4)),
        lat: Number(lat.toFixed(4)),
        elevationM: sampleElevation(lat, lon),
        slopeDeg: sampleSlope(lat, lon),
      });

      const hit = map.hasFeatureAtPixel(evt.pixel);
      map.getTargetElement().style.cursor = hit ? 'pointer' : 'crosshair';
    });

    // Map click for clusters, user waypoints, and camera markers
    map.on('click', (evt) => {
      const features = map.getFeaturesAtPixel(evt.pixel);
      if (features && features.length > 0) {
        // 1. Check if clicked on a user route waypoint
        const wpFeature = features.find((f) => f.get('isWaypoint'));
        if (wpFeature) {
          const wpId = wpFeature.get('waypointId') as string;
          if (wpId && setSelectedWaypointId) {
            setSelectedWaypointId(wpId);
          }
          return;
        }

        // 2. Check clusters or 360 camera viewpoints
        const topFeature = features[0];
        const clustered = topFeature.get('features') as Feature[];
        if (clustered && clustered.length > 1) {
          // Zoom into cluster
          const geom = topFeature.getGeometry() as Point;
          view.animate({
            center: geom.getCoordinates(),
            zoom: view.getZoom()! + 1.8,
            duration: 350,
          });
          return;
        }

        if (clustered && clustered.length === 1) {
          const single = clustered[0];
          const vp = single.get('viewpoint') as Viewpoint360;
          if (vp) {
            setActiveViewpoint(vp);
            return;
          }
        }
      }

      // Mission waypoint placement or inspect mode
      const coords = evt.coordinate;
      const [lon, lat] = mToLonLat(coords[0], coords[1]);
      if (interactionModeRef.current === 'add-waypoint' && addWaypointAtCoords) {
        addWaypointAtCoords(
          lat,
          lon,
          'waypoint',
          `WP-${String(waypointsRef.current.length + 1).padStart(2, '0')}`
        );
      } else if (interactionModeRef.current === 'inspect' && inspectCoordinates) {
        inspectCoordinates(lat, lon);
      }
    });

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.setTarget(undefined);
    };
  }, []);

  // Update layer visibility and opacity whenever `layers` state changes
  useEffect(() => {
    const layerMap = Object.fromEntries(layers.map((l) => [l.id, l]));

    // HiRISE / HRSC Base
    const hirise = layerMap['layer-hirise'];
    const hrsc = layerMap['layer-hrsc-color'];
    const baseVisible = (hirise?.visible ?? true) || (hrsc?.visible ?? true);
    const baseOpacity = Math.max(hirise?.opacity ?? 1, hrsc?.opacity ?? 0.85);

    if (overviewBaseLayerRef.current) {
      overviewBaseLayerRef.current.setVisible(baseVisible);
      overviewBaseLayerRef.current.setOpacity(baseOpacity);
    }
    if (neretvaBaseLayerRef.current) {
      neretvaBaseLayerRef.current.setVisible(baseVisible);
      neretvaBaseLayerRef.current.setOpacity(baseOpacity);
    }

    // MOLA DTM Topography / Hillshade
    const mola = layerMap['layer-mola-topo'];
    if (dtmLayerRef.current) {
      // In compare mode, DTM is enabled for split comparison
      dtmLayerRef.current.setVisible((mola?.visible ?? false) || activeTab === 'compare');
      dtmLayerRef.current.setOpacity(activeTab === 'compare' ? 1.0 : mola?.opacity ?? 0.75);
    }

    // Contours
    const contours = layerMap['layer-contours'];
    if (overviewContoursLayerRef.current) {
      overviewContoursLayerRef.current.setVisible(contours?.visible ?? true);
      overviewContoursLayerRef.current.setOpacity(contours?.opacity ?? 0.85);
    }
    if (neretvaContoursLayerRef.current) {
      neretvaContoursLayerRef.current.setVisible(contours?.visible ?? true);
      neretvaContoursLayerRef.current.setOpacity(contours?.opacity ?? 0.85);
    }

    // Channels
    const channels = layerMap['layer-channels'];
    if (overviewChannelsLayerRef.current) {
      overviewChannelsLayerRef.current.setVisible(channels?.visible ?? true);
      overviewChannelsLayerRef.current.setOpacity(channels?.opacity ?? 0.95);
    }
    if (neretvaChannelsLayerRef.current) {
      neretvaChannelsLayerRef.current.setVisible(channels?.visible ?? true);
      neretvaChannelsLayerRef.current.setOpacity(channels?.opacity ?? 0.95);
    }

    // Traverse
    const route = layerMap['layer-route'];
    if (traverseLayerRef.current) {
      traverseLayerRef.current.setVisible(route?.visible ?? true);
      traverseLayerRef.current.setOpacity(route?.opacity ?? 1.0);
    }

    // 360 Viewpoints
    const panos = layerMap['layer-panoramas'];
    if (clusterLayerRef.current) {
      clusterLayerRef.current.setVisible(panos?.visible ?? true);
      clusterLayerRef.current.setOpacity(panos?.opacity ?? 1.0);
    }
  }, [layers, activeTab]);

  // Synchronize active user route waypoints and connecting path into OpenLayers vector layer
  useEffect(() => {
    const source = userRouteSourceRef.current;
    if (!source) return;

    source.clear();

    if (waypoints.length >= 2) {
      const lineCoords = waypoints.map((wp) => lonLatToM(wp.coords.lon, wp.coords.lat));
      const lineFeat = new Feature({
        geometry: new LineString(lineCoords),
        isRouteLine: true,
      });
      source.addFeature(lineFeat);
    }

    waypoints.forEach((wp, idx) => {
      const coords = lonLatToM(wp.coords.lon, wp.coords.lat);
      const isSelected = wp.id === selectedWaypointId;
      const pointFeat = new Feature({
        geometry: new Point(coords),
        isWaypoint: true,
        waypointId: wp.id,
        label: wp.label.startsWith('WP-')
          ? wp.label.split(' ')[0]
          : `WP-${String(idx + 1).padStart(2, '0')}`,
        fullLabel: wp.label,
        type: wp.type,
        isSelected,
      });
      source.addFeature(pointFeat);
    });
  }, [waypoints, selectedWaypointId]);

  // Map Navigation Functions
  const handleZoomIn = () => {
    const view = mapInstanceRef.current?.getView();
    if (view) {
      view.animate({ zoom: (view.getZoom() || 12) + 1, duration: 250 });
    }
  };

  const handleZoomOut = () => {
    const view = mapInstanceRef.current?.getView();
    if (view) {
      view.animate({ zoom: (view.getZoom() || 12) - 1, duration: 250 });
    }
  };

  const handleResetOrientation = () => {
    const view = mapInstanceRef.current?.getView();
    if (view) {
      view.animate({
        center: lonLatToM(77.38, 18.445),
        zoom: 12,
        rotation: 0,
        duration: 500,
      });
    }
  };

  const flyToViewpoint = (vp: Viewpoint360) => {
    const view = mapInstanceRef.current?.getView();
    if (view) {
      view.animate({
        center: lonLatToM(vp.lon, vp.lat),
        zoom: 15.5,
        duration: 600,
      });
    }
  };

  // Compare split drag handlers
  const handleSplitPointerDown = (e: React.PointerEvent) => {
    isDraggingSplit.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSplitPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSplit.current || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    setCompareSplit(pct);
  };

  const handleSplitPointerUp = (e: React.PointerEvent) => {
    isDraggingSplit.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const toggleLayerVisible = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  const setLayerOpacity = (id: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity } : l))
    );
  };

  return (
    <div
      className={`glass-panel rounded-[20px] ${
        compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'
      } flex flex-col justify-between border border-white/20 bg-[#160e0a]/90 backdrop-blur-md shadow-2xl relative select-none ${
        isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-32px)]' : heightClass
      }`}
    >
      {/* 360 Panorama Modal Overlay */}
      {activeViewpoint && (
        <div className="absolute inset-0 z-40 rounded-[20px] overflow-hidden">
          <PanoramaViewer360
            viewpoint={activeViewpoint}
            onClose={() => setActiveViewpoint(null)}
          />
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10 shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-white/10 border border-white/20 flex items-center justify-center text-[#F29A1F]">
            <Compass size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] sm:text-[15px] font-bold text-[#FFF4E6] tracking-tight">
                Visual 360° Map
              </h2>
              <span className="text-[11px] font-mono-tabular text-[#FFF4E6]/60">
                · Jezero Crater (Mars 2020)
              </span>
            </div>
            <div className="text-[11px] font-mono-tabular text-[#FFF4E6]/75">
              {hoverCoords
                ? `${hoverCoords.lat.toFixed(4)}°N, ${hoverCoords.lon.toFixed(4)}°E · ${hoverCoords.elevationM} m · Slope: ${hoverCoords.slopeDeg}°`
                : '18.4447°N, 77.4508°E · -2574 m · Slope: 3.2°'}
            </div>
          </div>
        </div>

        {/* Interaction Mode Pill */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-[12px] border border-white/15">
          <button
            type="button"
            onClick={() => setInteractionMode('inspect')}
            className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              interactionMode === 'inspect'
                ? 'bg-white/20 text-[#FFF4E6] shadow-sm'
                : 'text-[#FFF4E6]/70 hover:text-white'
            }`}
          >
            <Crosshair size={13} />
            <span>Probe</span>
          </button>
          <button
            type="button"
            onClick={() => setInteractionMode('add-waypoint')}
            className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              interactionMode === 'add-waypoint'
                ? 'bg-[#F29A1F] text-black font-bold shadow-sm'
                : 'text-[#FFF4E6]/70 hover:text-white'
            }`}
          >
            <Route size={13} />
            <span>Add WP</span>
          </button>
          <button
            type="button"
            onClick={() => setInteractionMode('pan')}
            className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              interactionMode === 'pan'
                ? 'bg-white/20 text-[#FFF4E6] shadow-sm'
                : 'text-[#FFF4E6]/70 hover:text-white'
            }`}
          >
            <Move size={13} />
            <span>Pan</span>
          </button>
        </div>
      </div>

      {/* Main Geospatial Area: Tabbed Sidebar + OpenLayers Map */}
      <div className="relative flex-1 my-2 rounded-[16px] overflow-hidden border border-white/15 bg-black/80 flex items-stretch">
        {/* Left Sidebar-v2 Component */}
        <div className="relative flex z-20 shrink-0">
          {/* Icon Tabs Bar */}
          <div className="w-12 bg-black/85 border-r border-white/15 flex flex-col items-center justify-between py-3">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                title="Map Layers"
                onClick={() => setActiveTab(activeTab === 'layers' ? null : 'layers')}
                className={`p-2.5 rounded-[10px] transition-all cursor-pointer ${
                  activeTab === 'layers'
                    ? 'bg-[#F29A1F] text-black shadow-md'
                    : 'text-[#FFF4E6]/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Layers size={17} />
              </button>
              <button
                type="button"
                title="360° Panoramic Views"
                onClick={() => setActiveTab(activeTab === 'panoramas' ? null : 'panoramas')}
                className={`p-2.5 rounded-[10px] transition-all cursor-pointer ${
                  activeTab === 'panoramas'
                    ? 'bg-[#F29A1F] text-black shadow-md'
                    : 'text-[#FFF4E6]/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Camera size={17} />
              </button>
              <button
                type="button"
                title="Mission Information"
                onClick={() => setActiveTab(activeTab === 'info' ? null : 'info')}
                className={`p-2.5 rounded-[10px] transition-all cursor-pointer ${
                  activeTab === 'info'
                    ? 'bg-[#F29A1F] text-black shadow-md'
                    : 'text-[#FFF4E6]/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Info size={17} />
              </button>
              <button
                type="button"
                title="Compare Mode (Split Slider)"
                onClick={() => setActiveTab(activeTab === 'compare' ? null : 'compare')}
                className={`p-2.5 rounded-[10px] transition-all cursor-pointer ${
                  activeTab === 'compare'
                    ? 'bg-[#F29A1F] text-black shadow-md'
                    : 'text-[#FFF4E6]/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Split size={17} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                title="Help"
                onClick={() => setShowHelpModal(true)}
                className="p-2 rounded-[8px] text-[#FFF4E6]/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <HelpCircle size={16} />
              </button>
              <button
                type="button"
                title="Credits & Datasets"
                onClick={() => setShowCreditsModal(true)}
                className="p-2 rounded-[8px] text-[#FFF4E6]/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Award size={16} />
              </button>
            </div>
          </div>

          {/* Mobile Backdrop for Drawer */}
          {activeTab && (
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-20 backdrop-blur-[1px]"
              onClick={() => setActiveTab(null)}
            />
          )}

          {/* Collapsible Sidebar Drawer (Smooth 250ms slide) */}
          <div
            className={`transition-all duration-250 ease-in-out flex flex-col bg-black/95 border-r border-white/15 z-30 md:relative absolute left-12 top-0 bottom-0 shadow-2xl overflow-visible ${
              activeTab
                ? 'w-72 sm:w-80 opacity-100'
                : 'w-0 opacity-0 pointer-events-none border-r-0'
            }`}
          >
            {/* Slide / Collapse Edge Arrow Button ("‹") on the right boundary */}
            {activeTab && (
              <button
                type="button"
                title="Collapse sidebar panel"
                aria-label="Collapse sidebar panel"
                onClick={() => setActiveTab(null)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 z-40 w-6 h-12 rounded-r-[8px] bg-black/95 hover:bg-[#F29A1F] text-[#FFF4E6] hover:text-black border border-l-0 border-white/20 flex items-center justify-center shadow-lg transition-colors cursor-pointer group"
              >
                <ChevronLeft size={16} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>
            )}

            <div className="w-72 sm:w-80 h-full p-3.5 overflow-y-auto flex flex-col justify-between">
              {/* Tab Content: Map Layers */}
              {activeTab === 'layers' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-[13px] font-bold text-[#FFF4E6]">Map Layers</span>
                    <span className="text-[10px] font-mono-tabular text-[#F29A1F] uppercase tracking-wider">
                      OpenLayers 10
                    </span>
                  </div>

                  <div className="space-y-3">
                    {layers.map((layer) => (
                      <div
                        key={layer.id}
                        className="p-2.5 rounded-[12px] bg-white/[0.04] border border-white/10 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[12px] font-medium text-[#FFF4E6] flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={layer.visible}
                              onChange={() => toggleLayerVisible(layer.id)}
                              className="accent-[#F29A1F] rounded"
                            />
                            <span>{layer.name}</span>
                          </label>
                        </div>
                        {layer.visible && (
                          <div className="flex items-center gap-2 pl-5 pt-1">
                            <span className="text-[10px] font-mono-tabular text-[#FFF4E6]/60 w-10">
                              {Math.round(layer.opacity * 100)}%
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={layer.opacity}
                              onChange={(e) =>
                                setLayerOpacity(layer.id, parseFloat(e.target.value))
                              }
                              className="flex-1 accent-[#F29A1F] h-1.5 bg-white/20 rounded cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab Content: 360 Viewpoints List */}
              {activeTab === 'panoramas' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-[13px] font-bold text-[#FFF4E6]">
                      Panoramic Views (360°)
                    </span>
                    <span className="text-[10px] font-mono-tabular text-[#FFF4E6]/60">
                      {JEZERO_VIEWPOINTS.length} Viewpoints
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {JEZERO_VIEWPOINTS.map((vp) => (
                      <div
                        key={vp.id}
                        className="p-2.5 rounded-[12px] bg-white/[0.04] border border-white/10 hover:border-[#F29A1F]/50 transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold text-[#FFF4E6]">
                            {vp.name}
                          </span>
                          <span className="text-[10px] font-mono-tabular text-[#F29A1F]">
                            {vp.sol}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#FFF4E6]/75 font-sans leading-snug">
                          {vp.feature}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setActiveViewpoint(vp)}
                            className="flex-1 py-1 rounded-[8px] bg-[#F29A1F] hover:bg-[#F29A1F]/90 text-black font-bold text-[11px] flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                          >
                            <Camera size={13} />
                            <span>Open 360°</span>
                          </button>
                          <button
                            type="button"
                            title="Fly map to this viewpoint"
                            onClick={() => flyToViewpoint(vp)}
                            className="p-1 px-2.5 rounded-[8px] bg-white/10 hover:bg-white/20 text-[#FFF4E6] text-[11px] flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Navigation size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab Content: Information */}
              {activeTab === 'info' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-[13px] font-bold text-[#FFF4E6]">Jezero Crater GIS</span>
                    <span className="text-[10px] font-mono-tabular text-[#FFF4E6]/60">Mars 2020</span>
                  </div>
                  <p className="text-[12px] text-[#FFF4E6]/80 leading-relaxed font-sans">
                    Jezero Crater is a 45-km-wide ancient impact basin situated on the western margin of Isidis Planitia. It hosted an ancient paleolake fed by Neretva Vallis through a prominent river delta fan during the Noachian and early Hesperian epochs (~3.7 Ga).
                  </p>
                  <p className="text-[12px] text-[#FFF4E6]/80 leading-relaxed font-sans">
                    The Perseverance rover landed in February 2021 at Octavia E. Butler Landing and traversed west across the basaltic floor, ascended the western delta deposits, and investigated ancient river channels in Neretva Vallis.
                  </p>
                  <div className="p-2.5 rounded-[12px] bg-white/[0.05] border border-white/10 text-[11px] font-mono-tabular space-y-1 text-[#FFF4E6]/75">
                    <div>Landing Coordinates: 18.4447°N, 77.4508°E</div>
                    <div>Basin Elevation: -2,574 m (MOLA Datum)</div>
                    <div>Rover Traverse: &gt;28.4 km logged</div>
                  </div>
                </div>
              )}

              {/* Tab Content: Compare Mode */}
              {activeTab === 'compare' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-[13px] font-bold text-[#FFF4E6]">Compare Mode</span>
                    <span className="text-[10px] font-mono-tabular text-[#F29A1F]">Swipe Split</span>
                  </div>
                  <p className="text-[12px] text-[#FFF4E6]/80 font-sans leading-relaxed">
                    Swipe or slide the divider to compare the HiRISE optical surface mosaic (left) with the MOLA DTM topography hillshade (right).
                  </p>
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#FFF4E6]/70">
                      <span>HiRISE Base: {Math.round(compareSplit)}%</span>
                      <span>MOLA DTM: {Math.round(100 - compareSplit)}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="95"
                      value={compareSplit}
                      onChange={(e) => setCompareSplit(parseFloat(e.target.value))}
                      className="w-full accent-[#F29A1F] h-2 bg-white/20 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Sidebar Bottom Collapse Button */}
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="mt-3 w-full py-1.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-[#FFF4E6]/80 hover:text-white text-[11.5px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>Collapse Sidebar</span>
              </button>
            </div>
          </div>
        </div>

        {/* OpenLayers Viewport Container */}
        <div className="relative flex-1 h-full w-full overflow-hidden bg-[#1a0f0a]">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Compare Mode Split Visual Divider Line */}
          {activeTab === 'compare' && (
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-auto cursor-ew-resize flex items-center justify-center"
              style={{ left: `${compareSplit}%`, transform: 'translateX(-50%)' }}
              onPointerDown={handleSplitPointerDown}
              onPointerMove={handleSplitPointerMove}
              onPointerUp={handleSplitPointerUp}
            >
              <div className="w-[3px] h-full bg-[#F29A1F] shadow-[0_0_10px_rgba(242,154,31,0.8)]" />
              <div className="absolute w-8 h-8 rounded-full bg-[#F29A1F] text-black flex items-center justify-center shadow-lg border-2 border-white">
                <Split size={15} />
              </div>
            </div>
          )}

          {/* Top-Left Square Buttons: +, -, O (Matching Reference Site) */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
            <button
              type="button"
              title="Zoom In"
              aria-label="Zoom In"
              onClick={handleZoomIn}
              className="w-8 h-8 rounded-[8px] bg-black/80 hover:bg-black text-[#FFF4E6] border border-white/20 flex items-center justify-center backdrop-blur-md shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              title="Zoom Out"
              aria-label="Zoom Out"
              onClick={handleZoomOut}
              className="w-8 h-8 rounded-[8px] bg-black/80 hover:bg-black text-[#FFF4E6] border border-white/20 flex items-center justify-center backdrop-blur-md shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              <Minus size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              title="Reset Orientation & Crater Scale (O)"
              aria-label="Reset View"
              onClick={handleResetOrientation}
              className="w-8 h-8 rounded-[8px] bg-black/80 hover:bg-black text-[#F29A1F] font-bold text-[13px] border border-white/20 flex items-center justify-center backdrop-blur-md shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              O
            </button>
          </div>

          {/* Bottom-Left Metric Scale Line */}
          <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
            <div className="px-3 py-1 rounded-[8px] bg-black/75 border border-white/20 backdrop-blur-md text-[#FFF4E6] flex flex-col items-center shadow-lg">
              <span className="text-[10px] font-mono-tabular font-bold text-[#FFF4E6]">
                {scaleDistanceText}
              </span>
              <div className="w-20 h-[3px] bg-white border-x-2 border-white/80 my-0.5" />
            </div>
          </div>

          {/* Top-Right Fullscreen Toggle */}
          <div className="absolute top-3 right-3 z-20">
            <button
              type="button"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label="Fullscreen"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-[8px] bg-black/70 hover:bg-black/90 text-[#FFF4E6] border border-white/20 backdrop-blur-md shadow-md transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Status Readout */}
      <div className="flex items-center justify-between pt-1 px-1 text-[11px] font-mono-tabular text-[#FFF4E6]/70 shrink-0">
        <div>Projection: Mars 2020 IAU Equidistant · R: 3,389.5 km</div>
        <div className="flex items-center gap-3">
          <span>Active Layer: HiRISE Delta Mosaic</span>
          <span className="text-[#F29A1F] font-bold">Zoom: {currentZoom}x</span>
        </div>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#18110d] border border-white/25 rounded-[20px] p-5 text-[#FFF4E6] shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-[16px] font-bold">Map Navigation Guide</h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <ul className="text-[12.5px] space-y-2 text-[#FFF4E6]/85 font-sans leading-relaxed">
              <li>• <strong>Pan:</strong> Click and drag with mouse or one finger on touch.</li>
              <li>• <strong>Zoom:</strong> Scroll wheel or pinch with two fingers.</li>
              <li>• <strong>Viewpoints:</strong> Click numbered cluster badges to zoom into that location; click camera markers to enter high-resolution 360° panoramas.</li>
              <li>• <strong>Compare:</strong> Select compare mode to swipe between HiRISE optical surface and MOLA elevation hillshade.</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2 bg-[#F29A1F] text-black font-bold rounded-[10px] text-[12px] cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Credits Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#18110d] border border-white/25 rounded-[20px] p-5 text-[#FFF4E6] shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-[16px] font-bold">Credits & Scientific Sources</h3>
              <button
                type="button"
                onClick={() => setShowCreditsModal(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="text-[12px] space-y-2 text-[#FFF4E6]/85 font-sans leading-relaxed">
              <p>• <strong>NASA / JPL-Caltech / MSSS / ASU:</strong> Mars 2020 Perseverance rover telemetry, Mastcam-Z 360° panoramas, and CTX context mosaics.</p>
              <p>• <strong>ESA / DLR / FU-Berlin Planetary Sciences:</strong> HRSC Mars Express true color mosaic and digital terrain models.</p>
              <p>• <strong>USGS Astrogeology Science Center:</strong> MOLA global topographic contours and Jezero crater geologic map SIM-3484.</p>
              <p>• Reference interaction design inspired by Freie Universität Berlin Jezero WebGIS.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreditsModal(false)}
              className="w-full py-2 bg-[#F29A1F] text-black font-bold rounded-[10px] text-[12px] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
