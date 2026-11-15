import React, { useState } from 'react';
import { Mountain } from 'lucide-react';
import { useMission } from '../../context/MissionContext';

export const ElevationProfile: React.FC = () => {
  const { metrics } = useMission();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const profile = metrics.elevationProfile;

  if (!metrics.hasRoute || profile.length < 2) {
    return (
      <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] p-4 sm:p-5 flex flex-col justify-between min-h-[260px] select-none">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mountain size={16} strokeWidth={1.5} className="text-[#FFF4E6]" />
            <h3 className="text-[14px] font-semibold text-[#FFF4E6]">
              Traverse Elevation Profile (MOLA Areoid Datum)
            </h3>
          </div>
          <span className="font-mono-tabular text-[11px] text-[#FFF4E6]/70">
            Status: Awaiting route
          </span>
        </div>

        <div className="my-auto py-8 text-center space-y-1.5">
          <p className="text-[13px] text-[#FFF4E6]/85 font-medium">
            Elevation profile unavailable — fewer than 2 waypoints on current traverse.
          </p>
          <p className="text-[12px] text-[#FFF4E6]/65 font-sans">
            Add waypoints on the Mars map or select science targets to compute topographic cross-sections.
          </p>
        </div>
      </div>
    );
  }

  const maxDistM = Math.max(1, profile[profile.length - 1].cumulativeDistanceM);
  const elevations = profile.map((p) => p.elevationM);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevPad = Math.max(25, Math.round((maxElev - minElev) * 0.15));
  const yMin = minElev - elevPad;
  const yMax = maxElev + elevPad;
  const ySpan = Math.max(1, yMax - yMin);

  const svgW = 680;
  const svgH = 200;
  const padL = 56;
  const padR = 20;
  const padT = 18;
  const padB = 32;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const toX = (distM: number) => padL + (distM / maxDistM) * plotW;
  const toY = (elevM: number) => padT + (1 - (elevM - yMin) / ySpan) * plotH;

  const pointsStr = profile
    .map((pt) => `${toX(pt.cumulativeDistanceM).toFixed(1)},${toY(pt.elevationM).toFixed(1)}`)
    .join(' ');

  const areaStr = `${padL},${padT + plotH} ${pointsStr} ${toX(maxDistM).toFixed(1)},${padT + plotH}`;

  const activePoint = hoverIndex !== null ? profile[hoverIndex] : profile[profile.length - 1];

  return (
    <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] p-4 sm:p-5 space-y-3 select-none">
      {/* Header & Active Crosshair Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Mountain size={16} strokeWidth={1.5} className="text-[#FFF4E6]" />
            <h3 className="text-[14px] font-semibold text-[#FFF4E6]">
              Route Elevation Profile (MOLA MEGDR Interpolation)
            </h3>
            <span className="font-mono-tabular text-[10px] px-2 py-0.5 rounded bg-white/15 text-[#FFF4E6] border border-white/20 font-medium">
              Simulated
            </span>
          </div>
          <p className="text-[12px] font-mono-tabular text-[#FFF4E6]/75 mt-0.5">
            Net Δz: {metrics.netElevationChangeM !== null && metrics.netElevationChangeM > 0 ? '+' : ''}
            {metrics.netElevationChangeM} m · Cumulative ascent: {metrics.totalAscentM} m · Max slope:{' '}
            {metrics.maxSlopeDeg.toFixed(1)}°
          </p>
        </div>

        {activePoint && (
          <div className="flex items-center gap-3 text-[11px] font-mono-tabular bg-white/15 rounded-[10px] px-3 py-1.5 text-[#FFF4E6] border border-white/20">
            <span>Dist: {(activePoint.cumulativeDistanceM / 1000).toFixed(2)} km</span>
            <span>Elev: {activePoint.elevationM} m</span>
            <span>Slope: {activePoint.slopeDeg.toFixed(1)}°</span>
          </div>
        )}
      </div>

      {/* SVG Topographic Cross-Section */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-[195px] block select-none overflow-visible"
          role="img"
          aria-label="Route elevation profile chart in metres versus distance in kilometres"
        >
          <defs>
            <linearGradient id="marsXElevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.28)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.02)" />
            </linearGradient>
          </defs>

          {/* Horizontal elevation grid lines */}
          {[0, 0.5, 1].map((frac) => {
            const val = Math.round(yMin + frac * ySpan);
            const y = toY(val);
            return (
              <g key={frac}>
                <line
                  x1={padL}
                  y1={y}
                  x2={svgW - padR}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#FFF4E6"
                  opacity="0.75"
                  fontSize="10"
                  fontFamily="var(--font-sans)"
                >
                  {val}m
                </text>
              </g>
            );
          })}

          {/* Shaded terrain area */}
          <polygon points={areaStr} fill="url(#marsXElevFill)" />

          {/* Elevation polyline: smooth white line matching reference style */}
          <polyline
            fill="none"
            stroke="#FFF4E6"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="filter drop-shadow-[0_0_3px_rgba(255,255,255,0.4)]"
            points={pointsStr}
          />

          {/* Waypoint station markers along profile */}
          {profile.map((pt, i) => {
            const cx = toX(pt.cumulativeDistanceM);
            const cy = toY(pt.elevationM);
            return (
              <g key={i}>
                {pt.waypointLabel && (
                  <>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={cx}
                      y2={padT + plotH}
                      stroke="rgba(255, 255, 255, 0.4)"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4.5}
                      fill="#FFF4E6"
                      stroke="rgba(240, 148, 47, 0.85)"
                      strokeWidth="1.5"
                    />
                  </>
                )}
                {/* Invisible hover target bar */}
                <rect
                  x={cx - plotW / profile.length / 2}
                  y={padT}
                  width={Math.max(6, plotW / profile.length)}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                />
              </g>
            );
          })}

          {/* X-axis distance ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const distM = frac * maxDistM;
            const x = toX(distM);
            return (
              <text
                key={frac}
                x={x}
                y={svgH - 8}
                textAnchor="middle"
                fill="#FFF4E6"
                opacity="0.75"
                fontSize="10"
                fontFamily="var(--font-sans)"
              >
                {(distM / 1000).toFixed(2)} km
              </text>
            );
          })}
        </svg>
      </div>

      <p className="text-[11px] font-mono-tabular text-[#FFF4E6]/70 pt-1 border-t border-white/15">
        Terrain summary only, not proof of traversability. Prototype game thresholds, not official NASA rover safety limits. Sample interval 100 m; DEM-limited detail.
      </p>
    </div>
  );
};
