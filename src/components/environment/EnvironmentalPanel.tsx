import React, { useState } from 'react';
import {
  AlertTriangle,
  CloudSun,
  Compass,
  Database,
  Gauge,
  Radio,
  Ruler,
  ShieldAlert,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import {
  ArcGauge,
  CurvedArcGraphic,
  FloatingMarsSphere,
  HorizontalProgressTrack,
  SmoothLineChart,
  TileRow,
} from '../ui/MarsVisualWidgets';

export const EnvironmentalPanel: React.FC = () => {
  const { environmentalData, currentRegion, setActiveView } = useMission();

  const [selectedSolIndex, setSelectedSolIndex] = useState<string>('sol-1500');

  const radObs = environmentalData.find((d) => d.id === 'env-rad-gcr');
  const thermalObs = environmentalData.find((d) => d.id === 'env-thermal-diurnal');
  const pressureObs = environmentalData.find((d) => d.id === 'env-atmo-pressure');
  const windObs = environmentalData.find((d) => d.id === 'env-wind-live');

  // Sol selector tiles based on MSL RAD archive sols
  const solTiles = [
    { id: 'sol-100', topValue: '100', label: 'SOL' },
    { id: 'sol-500', topValue: '500', label: 'SOL' },
    { id: 'sol-1000', topValue: '1000', label: 'SOL' },
    { id: 'sol-1500', topValue: '1500', label: 'SOL' },
    { id: 'sol-2000', topValue: '2000', label: 'SOL' },
    { id: 'sol-2500', topValue: '2500', label: 'SOL' },
    { id: 'sol-3000', topValue: '3000', label: 'SOL' },
  ];

  // Pressure line / sample data
  const pressureChartData = [
    { label: '00', value: 740 },
    { label: '04', value: 748 },
    { label: '08', value: 765 },
    { label: '12', value: 773 },
    { label: '16', value: 768 },
    { label: '20', value: 752 },
    { label: '24', value: 742 },
  ];

  // Dust storm / optical depth diurnal variation curve
  const dustChartData = [
    { label: '12', value: 20 },
    { label: '13', value: 22 },
    { label: '14', value: 25 },
    { label: '15', value: 28 },
    { label: '16', value: 27 },
    { label: '17', value: 24 },
    { label: '18', value: 26 },
    { label: '19', value: 25 },
    { label: '20', value: 23 },
    { label: '21', value: 21 },
    { label: '22', value: 20 },
    { label: '23', value: 19 },
    { label: '24', value: 18 },
  ];

  return (
    <div className="space-y-3.5 sm:space-y-4 select-none">
      {/* Top Header: Location and Region */}
      <div className="glass-panel rounded-[20px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="label-caps tracking-[0.2em] text-[#FFF4E6]/80 flex items-center gap-1.5">
            <Compass size={14} strokeWidth={1.75} className="text-[#FFF4E6]" />
            <span>LOCATION · {currentRegion.quadrangle}</span>
          </div>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#FFF4E6] tracking-tight leading-none mt-1">
            {currentRegion.name}
          </h1>
          <p className="text-[12.5px] font-mono-tabular text-[#FFF4E6]/75 mt-1">
            {currentRegion?.center
              ? `${currentRegion.center.lat < 0
                  ? `${Math.abs(currentRegion.center.lat).toFixed(1)}°S`
                  : `${currentRegion.center.lat.toFixed(1)}°N`} ${currentRegion.center.lon < 0
                  ? `${Math.abs(currentRegion.center.lon).toFixed(1)}°W`
                  : `${currentRegion.center.lon.toFixed(1)}°E`}`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono-tabular bg-white/15 px-3 py-1.5 rounded-[10px] border border-white/20 text-[#FFF4E6]/85">
          <span>Archival Mission Sols: 100–3000</span>
          <span>·</span>
          <span>MSL / REMS / RAD</span>
        </div>
      </div>

      {/* Row 1: Sol Selector Tile Row (Style C from reference) */}
      <div className="glass-panel rounded-[18px] p-2.5 sm:p-3 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <TileRow
          items={solTiles}
          activeId={selectedSolIndex}
          onSelect={(id) => setSelectedSolIndex(id)}
        />
      </div>

      {/* Row 2: Chance of Dust Storms / Optical Depth Card (Style B & E) */}
      <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudSun size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
            <h2 className="text-[15px] font-semibold text-[#FFF4E6] tracking-wide">
              Atmospheric Optical Depth & Dust Index
            </h2>
          </div>
          <span className="text-[16px] font-mono-tabular font-bold text-[#FFF4E6]">
            28%
          </span>
        </div>

        {/* Thin smooth line chart with marker */}
        <div className="py-1">
          <SmoothLineChart data={dustChartData} markerIndex={3} height={50} />
        </div>

        <p className="text-[11.5px] text-[#FFF4E6]/75 leading-relaxed font-sans pt-1 border-t border-white/15">
          Remember that 1 hour on Mars is 1 minute and 33.5 seconds longer than 1 hour on Earth. Seasonal dust storm activity tracked via REMS / MEDA archival telemetry.
        </p>
      </div>

      {/* Row 3: Two Equal-Width Cards Side by Side (Pressure & Sunrise) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {/* Left: Pressure Arc Gauge Card */}
        <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
              <h2 className="text-[15px] font-semibold text-[#FFF4E6] tracking-wide">
                Surface Pressure
              </h2>
            </div>
            <span className="text-[11px] font-mono-tabular text-[#FFF4E6]/75 uppercase font-semibold">
              Jezero Floor
            </span>
          </div>

          <div className="py-2 flex justify-center">
            <ArcGauge value="773" unit="Pa" percent={64} minLabel="730 Pa" maxLabel="925 Pa" size={170} />
          </div>

          <div className="text-[11px] font-mono-tabular text-[#FFF4E6]/70 flex items-center justify-between pt-1 border-t border-white/15">
            <span>Range: {pressureObs?.valueDisplay ?? '730 – 925 Pa'}</span>
            <span>Source: REMS PDS</span>
          </div>
        </div>

        {/* Right: Sunrise / Sunset Diurnal Solar Arc Card */}
        <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
              <h2 className="text-[15px] font-semibold text-[#FFF4E6] tracking-wide">
                Diurnal Solar Cycle
              </h2>
            </div>
            <span className="text-[11px] font-mono-tabular text-[#FFF4E6]/75 uppercase font-semibold">
              LMST
            </span>
          </div>

          <div className="py-2 flex justify-center">
            <CurvedArcGraphic startLabel="05:18" endLabel="17:25" percent={62} />
          </div>

          <div className="text-[11px] font-mono-tabular text-[#FFF4E6]/70 flex items-center justify-between pt-1 border-t border-white/15">
            <span>Daylight Window: 12h 07m</span>
            <span>Solar Noon: 11:22 LMST</span>
          </div>
        </div>
      </div>

      {/* Row 4: Clean Glass Table Card (Average Temperature Diurnal Cycle) */}
      <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
            <h2 className="text-[15px] font-semibold text-[#FFF4E6] tracking-wide">
              Diurnal Temperature Regime (°C)
            </h2>
          </div>
          <span className="text-[11px] font-mono-tabular text-[#FFF4E6]/75 uppercase font-semibold">
            REMS / THEMIS Composite
          </span>
        </div>

        {/* Clean Glass Table without heavy grid lines */}
        <div className="overflow-x-auto py-1">
          <table className="glass-table">
            <thead>
              <tr>
                <th className="row-header">LMST</th>
                <th>00:00</th>
                <th>04:00</th>
                <th className="active-col">12:00</th>
                <th>16:00</th>
                <th>20:00</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="row-header">AIR (°C)</td>
                <td>-82</td>
                <td>-89</td>
                <td className="active-col font-bold">-15</td>
                <td>-24</td>
                <td>-67</td>
              </tr>
              <tr>
                <td className="row-header">GROUND (°C)</td>
                <td>-88</td>
                <td>-93</td>
                <td className="active-col font-bold">+1</td>
                <td>-18</td>
                <td>-75</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[11.5px] text-[#FFF4E6]/75 leading-relaxed font-sans pt-1 border-t border-white/15">
          {thermalObs?.notes ?? 'Large diurnal thermal swing driven by thin CO₂ atmosphere and regional surface thermal inertia.'}
        </p>
      </div>

      {/* Row 5: Solar Wind & Space Radiation Slider Card */}
      <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wind size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
            <h2 className="text-[15px] font-semibold text-[#FFF4E6] tracking-wide">
              Solar Wind & GCR Flux Index
            </h2>
          </div>
          <span className="text-[11px] font-mono-tabular font-bold tracking-widest text-[#FFF4E6] uppercase bg-white/20 px-2 py-0.5 rounded-[6px] border border-white/25">
            NOMINAL
          </span>
        </div>

        <HorizontalProgressTrack
          percent={28}
          caption="Surface cosmic ray dose rate is at baseline solar-cycle quiet levels. Extravehicular activities can proceed within standard operational contingency margins."
          subtext="MSL RAD Historical: 210 ± 40 μGy/day (0.64 ± 0.12 mSv/day)"
        />
      </div>

      {/* Row 6: Earth Distance / Transit Track Slider Card */}
      <div className="glass-panel rounded-[18px] p-4 sm:p-5 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
            <h2 className="text-[15px] font-semibold text-[#FFF4E6] tracking-wide">
              Current Distance from Earth
            </h2>
          </div>
          <span className="text-[15px] font-mono-tabular font-bold text-[#FFF4E6]">
            212M Km
          </span>
        </div>

        <HorizontalProgressTrack
          percent={45}
          leftLabel="Mars"
          rightLabel="Earth"
          caption="Light-time one-way delay is approximately 11.8 minutes. Mission control advisory links operate under store-and-forward telemetry protocol."
          subtext="Next Hohmann transfer launch window alignment: ~47 sols."
        />
      </div>

      {/* Row 7: Floating Mars Sphere with Atmospheric Rim & Shadow (Style G) */}
      <div className="py-4 flex justify-center">
        <FloatingMarsSphere
          size={160}
          label={currentRegion.name}
          subLabel={`${currentRegion.quadrangle} · Jezero Floor`}
          onClick={() => setActiveView('explorer')}
        />
      </div>

      {/* Explicit Disclaimer Notice preserved */}
      <div className="p-4 rounded-[16px] glass-panel border border-white/20 bg-white/[0.08] flex items-start gap-3">
        <ShieldAlert size={20} strokeWidth={1.5} className="text-[#FFF4E6] shrink-0 mt-0.5" />
        <div className="space-y-1 text-[12px]">
          <div className="font-semibold text-[#FFF4E6] text-[13px]">
            Historical Environmental Context Notice
          </div>
          <p className="text-[#FFF4E6]/75 leading-relaxed font-sans">
            All radiation dosimetry, thermal spans, and barometric figures displayed here represent{' '}
            <strong className="text-[#FFF4E6]">historical observations</strong> recorded by the NASA Mars 2020 / MSL payload. This simulation does not predict acute Solar Particle Events (SPEs) or certify operational crew flight safety.
          </p>
        </div>
      </div>
    </div>
  );
};
