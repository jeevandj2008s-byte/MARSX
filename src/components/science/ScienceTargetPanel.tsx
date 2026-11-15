import React, { useState } from 'react';
import { Check, Crosshair, MapPin, Plus } from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import type { ScienceTargetCategory } from '../../types/mission';
import { formatMarsCoordinates } from '../../utils/marsGeospatial';
import { VisualMap360 } from '../map/VisualMap360';

const CATEGORIES: Array<ScienceTargetCategory | 'All'> = [
  'All',
  'Stratigraphy',
  'Mineralogy',
  'Sedimentology',
  'Geomorphology',
];

export const ScienceTargetPanel: React.FC = () => {
  const {
    targets,
    selectedTargetId,
    setSelectedTargetId,
    toggleTargetForMission,
    inspectCoordinates,
    metrics,
  } = useMission();

  const [categoryFilter, setCategoryFilter] = useState<ScienceTargetCategory | 'All'>('All');

  const filteredTargets =
    categoryFilter === 'All'
      ? targets
      : targets.filter((t) => t.category === categoryFilter);

  return (
    <div className="space-y-3.5 sm:space-y-4 select-none">
      {/* Header */}
      <div className="glass-panel rounded-[20px] p-4 sm:p-5 flex flex-wrap items-end justify-between gap-4 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <div>
          <span className="label-caps tracking-[0.2em]">Documented Geological & Mineralogical Catalog</span>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#FFF4E6] tracking-tight leading-snug mt-0.5">
            Science Targets — Jezero Crater &amp; Western Delta
          </h1>
          <p className="text-[13px] text-[#FFF4E6]/80 mt-1 max-w-3xl leading-relaxed font-sans">
            Verified stratigraphic contacts, deltaic mudstones, and orbital spectral anomalies documented by NASA Mars 2020 Perseverance, MRO CRISM, and HiRISE. Selecting a target synchronizes the traverse manifest and map marker.
          </p>
        </div>

        <div className="font-mono-tabular text-[12px] glass-nested rounded-[12px] px-3.5 py-1.5 text-[#FFF4E6] border border-white/20">
          Selected for EVA:{' '}
          <span className="font-bold text-[#FFF4E6]">
            {metrics.selectedTargetsCount}
          </span>{' '}
          / {targets.length} documented targets
        </div>
      </div>

      {/* Category Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer ${
              categoryFilter === cat
                ? 'bg-white/30 text-[#FFF4E6] border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                : 'glass-nested text-[#FFF4E6]/75 hover:text-[#FFF4E6] hover:bg-white/15 border border-white/15'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Split Layout: Target Catalog Cards + Interactive Map Context */}
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-4 items-start">
        <div className="2xl:col-span-7 space-y-3.5">
          {filteredTargets.map((target) => {
            const isFocused = target.id === selectedTargetId;
            return (
              <div
                key={target.id}
                onClick={() => {
                  setSelectedTargetId(target.id);
                  inspectCoordinates(target.coords.lat, target.coords.lon);
                }}
                className={`glass-panel rounded-[18px] p-4 sm:p-5 border transition-all duration-200 cursor-pointer ${
                  isFocused
                    ? 'border-white/60 bg-white/[0.24] shadow-[0_8px_28px_rgba(0,0,0,0.25)]'
                    : 'border-white/20 bg-white/[0.12] hover:bg-white/[0.18] hover:border-white/35'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-mono-tabular">
                      <span className="font-bold text-[#FFF4E6] bg-white/15 px-2 py-0.5 rounded-[6px] border border-white/20">
                        {target.code}
                      </span>
                      <span className="text-[#FFF4E6]/40">·</span>
                      <span className="text-[#FFF4E6]/80 font-medium">
                        {target.category}
                      </span>
                      <span className="text-[#FFF4E6]/40">·</span>
                      <span className="text-emerald-300 font-medium">
                        {formatMarsCoordinates(target.coords.lat, target.coords.lon, 4)}
                      </span>
                    </div>

                    <h2 className="text-[18px] font-bold text-[#FFF4E6] pt-0.5">
                      {target.name}
                    </h2>
                    <div className="text-[12px] font-medium text-[#FFF4E6]/85">
                      {target.geologicalUnit}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTargetForMission(target.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-[12px] text-[12px] font-bold flex items-center gap-1.5 shrink-0 transition-all duration-150 cursor-pointer border ${
                      target.selectedForMission
                        ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/35'
                        : 'bg-white/20 border-white/35 text-[#FFF4E6] hover:bg-white/30'
                    }`}
                  >
                    {target.selectedForMission ? (
                      <>
                        <Check size={16} strokeWidth={2} />
                        <span>Included in Mission</span>
                      </>
                    ) : (
                      <>
                        <Plus size={16} strokeWidth={2} />
                        <span>Add to Mission</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[13px] text-[#FFF4E6]/90 mt-3 leading-relaxed font-sans">
                  {target.description}
                </p>

                <p className="text-[12px] text-[#FFF4E6]/75 mt-1.5 leading-relaxed font-sans">
                  <strong className="text-[#FFF4E6] font-semibold">
                    Scientific Context:
                  </strong>{' '}
                  {target.scientificSignificance}
                </p>

                {/* Documented Features */}
                <div className="mt-3.5 pt-3.5 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[12px]">
                  {target.documentedFeatures.map((feat) => (
                    <div
                      key={feat}
                      className="flex items-start gap-1.5 text-[#FFF4E6]/80 font-sans"
                    >
                      <MapPin
                        size={15}
                        strokeWidth={1.75}
                        className="text-[#FFF4E6] shrink-0 mt-0.5"
                      />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Provenance Footer */}
                <div className="mt-3 pt-2.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular text-[#FFF4E6]/70">
                  <span>Source: {target.source}</span>
                  <span>
                    Instrument: {target.instrument} · {target.observationDate}
                  </span>
                  <span>
                    Elev: {target.coords.elevationM} m · Slope: {target.coords.slopeDeg}°
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Sticky Map Preview */}
        <div className="2xl:col-span-5 space-y-4">
          <div className="glass-panel rounded-[18px] p-4 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Crosshair size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
              <span className="text-[14px] font-semibold text-[#FFF4E6]">
                Target Geospatial Distribution
              </span>
            </div>
            <VisualMap360 compact heightClass="h-[480px]" />
          </div>
        </div>
      </div>
    </div>
  );
};
