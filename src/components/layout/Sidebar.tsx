import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Crosshair,
  FileSpreadsheet,
  Globe,
  LayoutDashboard,
  Mountain,
  Route,
  Settings,
  Sparkles,
  X,
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
    label: 'Mission Overview',
    icon: LayoutDashboard,
  },
  {
    id: 'explorer',
    label: 'Planetary Explorer',
    icon: Globe,
  },
  {
    id: 'terrain',
    label: 'Terrain Analysis',
    icon: Mountain,
    badge: ({ warnings }) => (warnings > 0 ? `${warnings}` : null),
  },
  {
    id: 'targets',
    label: 'Science Targets',
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
    label: 'Environmental Context',
    icon: CloudSun,
  },
  {
    id: 'assistant',
    label: 'AI Mission Assistant',
    icon: Sparkles,
  },
  {
    id: 'reports',
    label: 'Mission Reports',
    icon: FileSpreadsheet,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
  },
];

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
    metrics,
    waypoints,
    currentRegion,
  } = useMission();

  const handleSelect = (viewId: ViewId) => {
    setActiveView(viewId);
    setMobileNavOpen(false);
  };

  const badgeContext = {
    targets: metrics.selectedTargetsCount,
    waypoints: waypoints.length,
    warnings: metrics.warnings.length,
  };

  const renderNavContent = (isMobile = false) => {
    const collapsed = !isMobile && sidebarCollapsed;
    return (
      <div className="flex flex-col h-full justify-between">
        <div className="p-3 space-y-2">
          <div className="px-2 py-1 flex items-center justify-between">
            {!collapsed && <span className="label-caps">Navigation</span>}
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation drawer"
                className="w-8 h-8 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center transition-colors duration-200"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            )}
          </div>

          <nav aria-label="Primary mission control navigation" className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              const badgeText = item.badge ? item.badge(badgeContext) : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-[14px] text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--surface-3)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      className={
                        isActive ? 'text-[var(--accent)] shrink-0' : 'text-[var(--text-muted)] shrink-0'
                      }
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!collapsed && badgeText && (
                    <span className="font-mono-tabular text-[11px] text-[var(--text-muted)] shrink-0">
                      {badgeText}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom CRS & Collapse Footer */}
        <div className="p-3 border-t border-[var(--border-subtle)] space-y-2.5">
          {!collapsed && (
            <div className="px-2 text-[12px] text-[var(--text-muted)] space-y-0.5">
              <div className="label-caps">Planetary CRS</div>
              <div className="font-mono-tabular text-[var(--text)] truncate">
                IAU:2000:49900
              </div>
              <div className="text-[11px] text-[var(--text-faint)] truncate">
                {currentRegion.quadrangle} · R=3396.19 km
              </div>
            </div>
          )}

          {!isMobile && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[12px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)] text-[12px] transition-colors duration-200"
            >
              {collapsed ? (
                <ChevronRight size={18} strokeWidth={1.5} />
              ) : (
                <>
                  <ChevronLeft size={18} strokeWidth={1.5} />
                  <span>Collapse sidebar</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop / Tablet Floating Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 glass-panel rounded-[22px] transition-all duration-200 no-print overflow-y-auto ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[236px]'
        }`}
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex p-3 no-print">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-[250px] max-w-[82vw] bg-[rgba(28,24,22,0.92)] backdrop-blur-xl border border-[var(--border)] rounded-[22px] h-full z-10 shadow-2xl overflow-y-auto">
            {renderNavContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
