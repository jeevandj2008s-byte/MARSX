import React, { useState } from 'react';
import { Eye, EyeOff, Layers, RotateCcw, Slash } from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import type { DataLayerCategory } from '../../types/mission';

const CATEGORY_LABELS: Record<DataLayerCategory | 'all', string> = {
  all: 'All Categories',
  optical: 'Optical Data',
  topographic: 'Topographic Data',
  thermal: 'Thermal Data',
  spectral: 'Spectral Data',
  environmental: 'Environmental Data',
};

export const LayerSelector: React.FC = () => {
  const {
    layers,
    toggleLayerVisibility,
    setLayerOpacity,
    resetLayersToDefault,
    metrics,
  } = useMission();

  const [selectedCategory, setSelectedCategory] = useState<DataLayerCategory | 'all'>('all');

  const filteredLayers =
    selectedCategory === 'all'
      ? layers
      : layers.filter((l) => l.category === selectedCategory);

  return (
    <div className="glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/15 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers size={18} strokeWidth={1.5} className="text-[#FFF4E6]" />
            <h2 className="text-[17px] font-bold text-[#FFF4E6]">
              Scientific Data Layers
            </h2>
          </div>
          <p className="text-[12px] text-[#FFF4E6]/75 mt-0.5">
            {metrics.activeLayersCount} active of {metrics.availableLayersCount} integrated datasets ·{' '}
            {layers.length - metrics.availableLayersCount} unavailable in current bundle
          </p>
        </div>

        <button
          type="button"
          onClick={resetLayersToDefault}
          className="px-3.5 py-1.5 rounded-[10px] bg-white/15 hover:bg-white/25 border border-white/20 text-[#FFF4E6] text-[12px] font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all duration-150 cursor-pointer"
        >
          <RotateCcw size={14} strokeWidth={1.75} />
          <span>Reset default layers</span>
        </button>
      </div>

      {/* Category Filter Bar */}
      <div className="px-5 py-3 border-b border-white/15 flex flex-wrap items-center gap-1.5 bg-white/[0.05]">
        {(Object.keys(CATEGORY_LABELS) as Array<DataLayerCategory | 'all'>).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer ${
              selectedCategory === cat
                ? 'bg-white/30 text-[#FFF4E6] border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                : 'text-[#FFF4E6]/75 hover:text-[#FFF4E6] hover:bg-white/15 border border-transparent'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Layer Rows */}
      <div className="divide-y divide-white/15">
        {filteredLayers.map((layer) => {
          const isUnavailable =
            layer.status === 'unavailable' || layer.status === 'error';
          const isActive = layer.visible && !isUnavailable;

          return (
            <div
              key={layer.id}
              className={`p-4 sm:p-5 transition-colors duration-150 ${
                isUnavailable ? 'bg-black/15' : 'hover:bg-white/[0.08]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                    <span className="font-mono-tabular font-bold text-[#FFF4E6] bg-white/15 px-2 py-0.5 rounded-[6px] border border-white/20">
                      {layer.shortCode}
                    </span>
                    {layer.epistemicStatus && (
                      <>
                        <span className="text-[#FFF4E6]/40">·</span>
                        <span className="text-[10.5px] px-2 py-0.5 rounded-[6px] bg-white/15 text-[#FFF4E6] font-mono-tabular font-semibold border border-white/20">
                          {layer.epistemicStatus}
                        </span>
                      </>
                    )}
                    <span className="text-[#FFF4E6]/40">·</span>
                    <span className="text-[12px] text-[#FFF4E6]/80 font-medium">
                      {CATEGORY_LABELS[layer.category]}
                    </span>
                    <span className="text-[#FFF4E6]/40">·</span>
                    <span
                      className={`font-mono-tabular text-[10.5px] font-bold px-2 py-0.5 rounded-[6px] border ${
                        isUnavailable
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                          : isActive
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                            : 'bg-white/10 text-[#FFF4E6]/70 border-white/15'
                      }`}
                    >
                      {isUnavailable
                        ? 'UNAVAILABLE'
                        : isActive
                          ? 'ACTIVE LAYER'
                          : 'AVAILABLE'}
                    </span>
                  </div>

                  <h3 className="text-[16px] font-bold text-[#FFF4E6]">
                    {layer.name}
                  </h3>

                  <p className="text-[13px] text-[#FFF4E6]/80 leading-relaxed font-sans">
                    {layer.description}
                  </p>

                  {/* Provenance Metadata Row */}
                  <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-mono-tabular text-[#FFF4E6]/75">
                    <span>Source: {layer.source}</span>
                    <span>Date: {layer.datasetDate}</span>
                    <span>Resolution: {layer.spatialResolution}</span>
                    {layer.units && <span>Units: {layer.units}</span>}
                  </div>

                  {isUnavailable && layer.unavailableReason && (
                    <div className="mt-2 p-3 rounded-[12px] glass-nested text-[12px] text-amber-200 flex items-start gap-2 border border-amber-400/30 bg-amber-500/15">
                      <Slash size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                      <span>{layer.unavailableReason}</span>
                    </div>
                  )}
                </div>

                {/* Right Controls: Visibility Toggle & Opacity */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={isUnavailable}
                    onClick={() => toggleLayerVisibility(layer.id)}
                    aria-pressed={isActive}
                    className={`px-3.5 py-1.5 rounded-[12px] text-[12px] font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer border ${
                      isUnavailable
                        ? 'bg-white/5 border-white/10 text-[#FFF4E6]/40 cursor-not-allowed'
                        : isActive
                          ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/35'
                          : 'bg-white/15 border-white/25 text-[#FFF4E6] hover:bg-white/25'
                    }`}
                  >
                    {isUnavailable ? (
                      <>
                        <Slash size={15} strokeWidth={1.75} />
                        <span>Not integrated</span>
                      </>
                    ) : isActive ? (
                      <>
                        <Eye size={15} strokeWidth={1.75} />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={15} strokeWidth={1.75} />
                        <span>Enable layer</span>
                      </>
                    )}
                  </button>

                  {!isUnavailable && (
                    <div className="flex items-center gap-2 text-[12px] font-mono-tabular text-[#FFF4E6]/80">
                      <label htmlFor={`opacity-${layer.id}`}>Opacity</label>
                      <input
                        id={`opacity-${layer.id}`}
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={layer.opacity}
                        onChange={(e) =>
                          setLayerOpacity(layer.id, parseFloat(e.target.value))
                        }
                        className="w-20 accent-white"
                      />
                      <span className="w-8 text-right text-[#FFF4E6] font-bold">
                        {Math.round(layer.opacity * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
