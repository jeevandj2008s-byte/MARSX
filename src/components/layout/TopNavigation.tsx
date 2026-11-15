import React, { useEffect, useState } from 'react';
import {
  CloudSun,
  Crosshair,
  FileSpreadsheet,
  Globe,
  LayoutDashboard,
  Mountain,
  PanelRightClose,
  PanelRightOpen,
  Route,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useMission } from '../../context/MissionContext';
import type { ViewId } from '../../types/mission';

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
  badge?: (ctx: { targets: number; waypoints: number; warnings: number }) => string | null;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
  },
  {
    id: 'explorer',
    label: 'Explorer',
    icon: Globe,
  },
  {
    id: 'terrain',
    label: 'Terrain',
    icon: Mountain,
    badge: ({ warnings }) => (warnings > 0 ? `${warnings}` : null),
  },
  {
    id: 'targets',
    label: 'Targets',
    icon: Crosshair,
    badge: ({ targets }) => `${targets}`,
  },
  {
    id: 'planner',
    label: 'Route Planner',
    icon: Route,
    badge: ({ waypoints }) => `${waypoints} WP`,
  },
  {
    id: 'environment',
    label: 'Environment',
    icon: CloudSun,
  },
  {
    id: 'assistant',
    label: 'AI Assistant',
    icon: Sparkles,
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileSpreadsheet,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
  },
];

export const TopNavigation: React.FC = () => {
  const {
    activeView,
    setActiveView,
    metrics,
    waypoints,
    rightPanelOpen,
    setRightPanelOpen,
  } = useMission();

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const badgeContext = {
    targets: metrics.selectedTargetsCount,
    waypoints: waypoints.length,
    warnings: metrics.warnings.length,
  };

  return (
    <div
      className={`shrink-0 z-30 no-print transition-all duration-700 ease-out ${
        isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      {/* Navigation Row at the very top */}
      <nav
        aria-label="Workstation Navigation"
        className="glass-panel rounded-[16px] px-2.5 py-1.5 flex items-center justify-between gap-2 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0 py-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const badgeText = item.badge ? item.badge(badgeContext) : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative px-3 sm:px-3.5 py-1.5 rounded-[12px] flex items-center gap-2 text-[12.5px] font-medium transition-all duration-150 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-white/[0.28] border border-white/60 text-[#FFF4E6] shadow-[0_2px_10px_rgba(0,0,0,0.15)] font-semibold'
                    : 'text-[#FFF4E6]/80 hover:text-[#FFF4E6] hover:bg-white/[0.14] border border-transparent hover:-translate-y-0.5'
                }`}
              >
                <Icon
                  size={15}
                  strokeWidth={isActive ? 2 : 1.5}
                  className={
                    isActive
                      ? 'text-[#FFF4E6] shrink-0'
                      : 'text-[#FFF4E6]/75 shrink-0'
                  }
                />
                <span className="whitespace-nowrap tracking-wide">
                  {item.label}
                </span>

                {badgeText && (
                  <span
                    className={`font-mono-tabular text-[10.5px] px-1.5 py-0.5 rounded-[6px] shrink-0 ${
                      isActive
                        ? 'bg-white/35 text-[#FFF4E6] font-bold border border-white/40'
                        : 'bg-white/12 text-[#FFF4E6]/75 border border-white/15'
                    }`}
                  >
                    {badgeText}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Small Inspector Toggle Icon at the right end of the navigation row */}
        <div className="flex items-center pl-1.5 sm:pl-2 border-l border-white/20 shrink-0">
          <button
            type="button"
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            aria-label={rightPanelOpen ? 'Close inspector' : 'Open inspector'}
            title={rightPanelOpen ? 'Close inspector' : 'Open inspector'}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-[10px] flex items-center justify-center transition-all duration-150 cursor-pointer ${
              rightPanelOpen
                ? 'bg-white/[0.28] border border-white/60 text-[#FFF4E6] shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                : 'bg-white/[0.10] hover:bg-white/[0.18] border border-white/20 text-[#FFF4E6]/80 hover:text-[#FFF4E6]'
            }`}
          >
            {rightPanelOpen ? (
              <PanelRightClose size={15} strokeWidth={1.75} />
            ) : (
              <PanelRightOpen size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
};
