import React, { useState } from "react";
import { MarsAIPanel, MapContext } from "./ai";

export default function App() {
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);

  // Gale Crater / Mount Sharp demo mission context: "Boxwork Discovery Expedition"
  const sampleMapContext: MapContext = {
    mission: {
      name: "Boxwork Discovery Expedition (SAMPLE - replace with real data)",
      region: "Gale Crater / Mount Sharp (SAMPLE - replace with real data)",
      objective: "Explore polygonal boxwork fracture fills and transition into sulfate-clay contact (SAMPLE).",
    },
    location: {
      lat: -4.6821,
      lon: 137.3812,
      site_name: "Base Camp Curiosity Ridge (SAMPLE)",
      elevation_m: -4120.0,
      geological_unit: "Lower Mount Sharp Fractured Bedrock Unit (SAMPLE)",
    },
    route: {
      route_id: "EVA-ROVERSE-01 (SAMPLE)",
      name: "Boxwork Discovery Loop (SAMPLE)",
      waypoints: [
        {
          id: "wp-base",
          name: "Base Camp Curiosity Ridge [SAMPLE]",
          lat: -4.6821,
          lon: 137.3812,
          type: "base",
          elevation_m: -4120.0,
          sequence: 1,
          reason: "Departure basecamp and telemetry sync [SAMPLE].",
        },
        {
          id: "wp-boxwork",
          name: "Mount Sharp Boxwork Formation [SAMPLE]",
          lat: -4.6954,
          lon: 137.3945,
          type: "science",
          elevation_m: -4035.0,
          sequence: 2,
          reason: "Survey web-like mineralized veins formed by paleolake groundwater [SAMPLE].",
        },
        {
          id: "wp-contact",
          name: "Sulfate-Clay Transition Outcrop [SAMPLE]",
          lat: -4.7088,
          lon: 137.4082,
          type: "science",
          elevation_m: -4065.0,
          sequence: 3,
          reason: "Geochemical boundary between ancient wet clay era and evaporating sulfate era [SAMPLE].",
        },
        {
          id: "wp-return",
          name: "Base Camp Return Airlock [SAMPLE]",
          lat: -4.6821,
          lon: 137.3812,
          type: "return",
          elevation_m: -4120.0,
          sequence: 4,
          reason: "Safe return airlock ingress [SAMPLE].",
        },
      ],
      segments: [
        {
          from_waypoint_id: "wp-base",
          to_waypoint_id: "wp-boxwork",
          distance_km: 2.4,
          elevation_change_m: 85.0,
          max_slope_deg: 14.2,
          estimated_minutes: 58.0,
          notes: "Steep ascent scarp (SAMPLE).",
        },
        {
          from_waypoint_id: "wp-boxwork",
          to_waypoint_id: "wp-contact",
          distance_km: 1.6,
          elevation_change_m: -30.0,
          max_slope_deg: 8.5,
          estimated_minutes: 38.0,
          notes: "Gentle descent across yardangs (SAMPLE).",
        },
        {
          from_waypoint_id: "wp-contact",
          to_waypoint_id: "wp-return",
          distance_km: 3.2,
          elevation_change_m: -55.0,
          max_slope_deg: 11.0,
          estimated_minutes: 76.0,
          notes: "Long return leg back to base (SAMPLE).",
        },
      ],
      totals: {
        distance_km: 7.2,
        elevation_change_m: 170.0,
        max_slope_deg: 14.2,
        estimated_minutes: 172.0,
      },
    },
    science_targets: [
      {
        id: "target-boxwork-1",
        name: "Mount Sharp Boxwork Network (SAMPLE)",
        lat: -4.6954,
        lon: 137.3945,
        description: "1-5m tall blade-like mineralized ridges resisting wind erosion (SAMPLE).",
        geology_notes: "Formed by mineralized groundwater circulating through fractured lakebed mudstones (SAMPLE).",
      },
      {
        id: "target-clay-sulfate-2",
        name: "Sulfate-Clay Transition Stratum (SAMPLE)",
        lat: -4.7088,
        lon: 137.4082,
        description: "Sharply defined boundary between underlying clays and overlying sulfates (SAMPLE).",
        geology_notes: "Records the drying of Mars from a habitable lake to an arid desert (SAMPLE).",
      },
    ],
    layers: {
      optical: {
        available: true,
        source: "HiRISE (Mars Reconnaissance Orbiter) [SAMPLE]",
        observation_date: "2024-02-18",
        resolution: "0.25 m/pixel",
        units: "radiance/reflectance",
        value: "Polygonal blade ridges and localized sand ripples (SAMPLE).",
      },
      elevation: {
        available: true,
        source: "MOLA / HRSC [SAMPLE]",
        observation_date: "2021-09-10",
        resolution: "50 m/pixel",
        units: "meters",
        value: "-4120m to -4035m (SAMPLE).",
      },
      slope: {
        available: true,
        source: "HRSC Slope Map [SAMPLE]",
        observation_date: "2021-09-10",
        resolution: "50 m/pixel",
        units: "degrees",
        value: "Peak 14.2° on Boxwork ascent scarp; mean 7.8° (SAMPLE).",
      },
      thermal: {
        available: true,
        source: "THEMIS (Mars Odyssey) [SAMPLE]",
        observation_date: "2023-10-14",
        resolution: "100 m/pixel",
        units: "J m^-2 K^-1 s^-1/2",
        value: "Thermal inertia ~340 units (cemented duricrust). Note: not a live forecast (SAMPLE).",
      },
      mineralogy: {
        available: true,
        source: "CRISM (MRO) [SAMPLE]",
        observation_date: "2019-07-22",
        resolution: "18 m/pixel",
        units: "absorption bands",
        value: "Hydrated magnesium sulfates and smectite clays (SAMPLE).",
      },
      radiation: {
        available: true,
        source: "RAD (MSL / Curiosity archive) [SAMPLE]",
        observation_date: "2022-05-30",
        resolution: "Point detector",
        units: "μSv/hr",
        value: "Historical background ~25.2 μSv/hr. Note: not future human exposure (SAMPLE).",
      },
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 flex flex-col items-center">
      <header className="max-w-4xl w-full mb-6 text-center sm:text-left flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🪐</span>
            <h1 className="text-xl font-black tracking-tight text-white uppercase">
              ROVERSE — Mars Surface Exploration Planning
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            NASA Space Apps 2026 // Gale Crater: Boxwork Discovery Expedition (Simulation)
          </p>
        </div>

        {selectedWaypoint && (
          <div className="px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-800 text-xs text-red-300 font-mono">
            Waypoint Focused: {selectedWaypoint}
          </div>
        )}
      </header>

      <main className="max-w-4xl w-full">
        <MarsAIPanel
          context={sampleMapContext}
          onWaypointSelect={(lat, lon) => {
            setSelectedWaypoint(`${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);
          }}
        />
      </main>
    </div>
  );
}
