import React from 'react';
import { useMission } from '../../context/MissionContext';
import { RouteControls } from '../mission/RouteControls';
import { ElevationProfile } from '../terrain/ElevationProfile';
import { LayerSelector } from './LayerSelector';
import { MarsGlobe3D } from './MarsGlobe3D';
import { VisualMap360 } from './VisualMap360';

export const PlanetaryExplorer: React.FC = () => {
  const { currentRegion, inspectedPoint } = useMission();

  return (
    <div className="space-y-3.5 sm:space-y-4 select-none">
      {/* Header */}
      <div className="glass-panel rounded-[20px] p-4 sm:p-5 flex flex-col md:flex-row md:items-end justify-between gap-4 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <div>
          <span className="label-caps tracking-[0.2em]">Planetary Geospatial Workstation</span>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#FFF4E6] mt-0.5 tracking-tight">
            {currentRegion.name}
          </h1>
          <p className="text-[13px] text-[#FFF4E6]/80 mt-1 max-w-3xl leading-relaxed font-sans">
            {currentRegion.summary}
          </p>
        </div>

        <div className="flex items-center gap-4 text-[12px] font-mono-tabular glass-nested rounded-[14px] px-4 py-2 shrink-0 border border-white/20">
          <div>
            <span className="text-[#FFF4E6]/70 block text-[11px]">
              Quadrangle
            </span>
            <span className="text-[#FFF4E6] font-bold">{currentRegion.quadrangle}</span>
          </div>
          <div className="h-6 w-[1px] bg-white/20" />
          <div>
            <span className="text-[#FFF4E6]/70 block text-[11px]">
              Selected Elev
            </span>
            <span className="text-[#FFF4E6] font-bold">{inspectedPoint.elevationM} m</span>
          </div>
          <div className="h-6 w-[1px] bg-white/20" />
          <div>
            <span className="text-[#FFF4E6]/70 block text-[11px]">
              Selected Slope
            </span>
            <span className="text-[#FFF4E6] font-bold">{inspectedPoint.slopeDeg.toFixed(1)}°</span>
          </div>
        </div>
      </div>

      {/* Main Geospatial Stage: 3D Mars Globe (Left) + Visual 360° Map (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <MarsGlobe3D heightClass="h-[580px]" />
        <VisualMap360 heightClass="h-[580px]" />
      </div>

      {/* Split Lower Console: Route Controls + Elevation Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-5">
          <RouteControls compact />
        </div>
        <div className="lg:col-span-7">
          <ElevationProfile />
        </div>
      </div>

      {/* Scientific Data Layer Control Panel */}
      <LayerSelector />
    </div>
  );
};
