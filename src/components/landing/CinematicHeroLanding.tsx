import React, { useEffect, useState } from 'react';
import { useMission } from '../../context/MissionContext';
import { EXPLORATION_REGIONS } from '../../data/marsMissionData';
import type { ExplorationRegionId } from '../../types/mission';
import { RotatingMarsSphere } from './RotatingMarsSphere';

interface CinematicHeroLandingProps {
  onScrollToWorkstation?: () => void;
}

export const CinematicHeroLanding: React.FC<CinematicHeroLandingProps> = ({
  onScrollToWorkstation,
}) => {
  const { currentRegion, selectRegion, setActiveView } = useMission();

  const [isLoaded, setIsLoaded] = useState(false);
  const [destinationMenuOpen, setDestinationMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const handleDiscoverMore = () => {
    if (onScrollToWorkstation) {
      onScrollToWorkstation();
    } else {
      setActiveView('explorer');
    }
  };

  const titleLine1 = 'HUMAN';
  const titleLine2 = 'EXPLORATION';

  const descriptionText =
    'Mars X Mission is an interactive Martian map for planning the safest and most efficient routes for human exploration. Using real orbital imagery, terrain data, and 360° views, it helps crews find the best path across Mars with fewer obstacles and fewer risks.';

  return (
    <div className="relative w-full flex flex-col items-center justify-center select-none">
      {/* Main Framed Hero Panel matching reference layout */}
      <div
        className={`relative w-full min-h-[580px] sm:min-h-[660px] md:min-h-[720px] lg:min-h-[780px] xl:min-h-[82vh] rounded-[24px] overflow-hidden border border-[rgba(255,220,160,0.28)] shadow-[0_0_35px_rgba(240,148,47,0.18),0_24px_50px_rgba(0,0,0,0.7)] transition-all duration-700 ease-out flex flex-col justify-between ${
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
        }`}
      >
        {/* Background Artwork: Pristine High-Resolution Hero matching reference */}
        <div
          className="absolute inset-0 bg-cover bg-[center_left_20%] md:bg-center bg-no-repeat animate-slow-zoom origin-center will-change-transform"
          style={{
            backgroundImage: "url('/hero-pristine-hd.jpg')",
          }}
        />

        {/* Ambient Gradient Overlays for readable text and contrast on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#251208]/20 to-[#140602]/85 sm:to-[#140602]/90 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#120501]/75 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(240,148,47,0.12)_0%,transparent_60%)] pointer-events-none" />

        {/* Top Header Bar Inside the Framed Hero Panel */}
        <div className="relative z-10 px-6 sm:px-10 pt-5 sm:pt-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-wide tracking-[0.24em] text-[#FFF4E6] font-bold text-[13px] sm:text-[15px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              MARS X MISSION
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono-tabular tracking-wider text-[#FFF4E6]/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FA5E16] shadow-[0_0_6px_#FA5E16]" />
              <span>Mars Surface Expedition 2026</span>
            </div>

            <div className="glass-nested rounded-full px-3.5 py-1 text-[11px] font-mono-tabular text-[#FFF4E6]/85 border border-white/20 hidden md:block">
              Active region: {currentRegion.quadrangle}
            </div>
          </div>
        </div>

        {/* Content Area: Bottom Left Mars Rotating Sphere & Right Aligned Hero Typography */}
        <div className="relative z-10 px-6 sm:px-10 lg:px-14 pb-8 sm:pb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
          {/* Bottom-Left: Curvy HUD Radar Widget with 3D Rotating Mars */}
          <div
            className={`transition-all duration-700 ease-out ${
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <RotatingMarsSphere
              onClick={() => setActiveView('explorer')}
              size={88}
            />
          </div>

          {/* Right Side: Small Label + Huge Two-Line Title + Paragraph + Buttons */}
          <div className="w-full md:max-w-[560px] lg:max-w-[680px] xl:max-w-[740px] flex flex-col items-start md:items-end text-left md:text-right">
            {/* 1. Small Section Label Above Title with Orange ✕ glyph */}
            <div
              className={`flex items-center gap-2 mb-2 sm:mb-3 transition-all duration-700 ease-out delay-150 ${
                isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <span className="text-[#FA5E16] font-bold text-[13px] tracking-normal drop-shadow-[0_0_8px_rgba(250,94,22,0.6)]">
                ✕
              </span>
              <span className="font-techno tracking-[0.2em] text-[11px] sm:text-[12.5px] font-semibold text-[#FFF4E6]/90 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                The Red Planet on Display
              </span>
            </div>

            {/* 2. Huge Two-Line Title */}
            <h1
              className={`font-techno font-bold uppercase text-[#FFF4E6] tracking-[0.05em] leading-[0.92] text-[36px] sm:text-[52px] md:text-[66px] lg:text-[78px] xl:text-[88px] mb-3 sm:mb-4 drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] transition-all duration-700 ease-out delay-250 ${
                isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <div>{titleLine1}</div>
              <div>{titleLine2}</div>
            </h1>

            {/* 3. Description Paragraph matching reference styling and project context */}
            <p
              className={`font-sans text-[12px] sm:text-[13.5px] uppercase tracking-[0.05em] leading-relaxed text-[#FFF4E6]/85 max-w-xl mb-6 sm:mb-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] transition-all duration-700 ease-out delay-350 ${
                isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              {descriptionText}
            </p>

            {/* 4. Two Buttons with Corner Markers & Raptor Triad Icon */}
            <div
              className={`flex flex-wrap items-center gap-3 sm:gap-4 transition-all duration-700 ease-out delay-450 ${
                isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              {/* Button 1: Solid Vibrant Orange */}
              <button
                type="button"
                onClick={handleDiscoverMore}
                className="tech-corner-btn group px-6 sm:px-7 py-3.5 bg-[#FA5E16] hover:bg-[#FF7233] active:scale-[0.98] active:translate-y-0.5 hover:-translate-y-0.5 text-[#FFF4E6] shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(250,94,22,0.5)] flex items-center gap-3 cursor-pointer rounded-none border border-white/30 font-techno font-bold text-[11px] sm:text-[12px] tracking-wider uppercase transition-all duration-200"
              >
                <span className="corner-tick corner-tick-tl border-[#FFF4E6] group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                <span className="corner-tick corner-tick-tr border-[#FFF4E6] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                <span className="corner-tick corner-tick-bl border-[#FFF4E6] group-hover:-translate-x-0.5 group-hover:translate-y-0.5 transition-transform" />
                <span className="corner-tick corner-tick-br border-[#FFF4E6] group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-transform" />

                <span>Discover more</span>

                {/* SpaceX Triad Delta Icon */}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="text-[#FFF4E6] group-hover:translate-x-1 transition-transform duration-200"
                >
                  <polygon points="8,1 12,8 4,8" />
                  <polygon points="4,9 8,16 0,16" />
                  <polygon points="12,9 16,16 8,16" />
                </svg>
              </button>

              {/* Button 2: Frosted Glass Dark Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDestinationMenuOpen(!destinationMenuOpen)}
                  className="tech-corner-btn group px-6 sm:px-7 py-3.5 bg-[#251208]/75 hover:bg-[#341a0b]/85 active:scale-[0.98] active:translate-y-0.5 hover:-translate-y-0.5 text-[#FFF4E6] shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)] flex items-center gap-3 cursor-pointer rounded-none border border-white/30 backdrop-blur-md font-techno font-bold text-[11px] sm:text-[12px] tracking-wider uppercase transition-all duration-200"
                >
                  <span className="corner-tick corner-tick-tl border-[#FFF4E6] group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  <span className="corner-tick corner-tick-tr border-[#FFF4E6] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  <span className="corner-tick corner-tick-bl border-[#FFF4E6] group-hover:-translate-x-0.5 group-hover:translate-y-0.5 transition-transform" />
                  <span className="corner-tick corner-tick-br border-[#FFF4E6] group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-transform" />

                  <span>Other destinations</span>

                  {/* SpaceX Triad Delta Icon */}
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="text-[#FFF4E6] group-hover:translate-x-1 transition-transform duration-200"
                  >
                    <polygon points="8,1 12,8 4,8" />
                    <polygon points="4,9 8,16 0,16" />
                    <polygon points="12,9 16,16 8,16" />
                  </svg>
                </button>

                {/* Destination Quick Selector Menu */}
                {destinationMenuOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-72 bg-[#251208]/95 border border-white/25 shadow-2xl p-2 z-50 rounded-[16px] backdrop-blur-xl">
                    <div className="text-[10px] font-mono-tabular tracking-wider text-[#FFF4E6]/75 px-3 py-1.5 border-b border-white/15">
                      Select destination
                    </div>
                    {Object.values(EXPLORATION_REGIONS).map((reg) => (
                      <button
                        key={reg.id}
                        type="button"
                        onClick={() => {
                          selectRegion(reg.id as ExplorationRegionId);
                          setDestinationMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-[12.5px] transition-colors rounded-[10px] flex items-center justify-between ${
                          currentRegion.id === reg.id
                            ? 'bg-white/25 text-[#FFF4E6] font-semibold border border-white/40'
                            : 'text-[#FFF4E6]/80 hover:bg-white/10 hover:text-[#FFF4E6]'
                        }`}
                      >
                        <span className="truncate">{reg.name}</span>
                        {currentRegion.id === reg.id && <span>•</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
