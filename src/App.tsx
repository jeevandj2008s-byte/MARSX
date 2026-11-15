/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextualRightPanel } from './components/layout/ContextualRightPanel';
import { MainWorkspace } from './components/layout/MainWorkspace';
import { MarsAtmosphere } from './components/layout/MarsAtmosphere';
import { TopNavigation } from './components/layout/TopNavigation';
import { MissionProvider } from './context/MissionContext';

export default function App() {
  return (
    <MissionProvider>
      {/* High-Res Mars Horizon Atmosphere across all pages */}
      <MarsAtmosphere />

      <div className="relative z-10 h-screen w-screen overflow-hidden p-2 sm:p-2.5 md:p-3 flex flex-col text-[var(--text)]">
        {/* Main Workstation Container with sleek borderline reflecting the horizon glow */}
        <div className="relative flex-1 min-h-0 flex flex-col gap-2 rounded-[22px] sm:rounded-[26px] p-2.5 sm:p-3 bg-[rgba(14,8,4,0.45)] border border-[rgba(255,215,140,0.22)] backdrop-blur-[2px] shadow-[0_0_30px_rgba(240,148,47,0.10),0_24px_60px_rgba(0,0,0,0.7)] overflow-hidden">
          <TopNavigation />
          <div className="flex-1 min-h-0 flex gap-2.5 overflow-hidden">
            <MainWorkspace />
            <ContextualRightPanel />
          </div>
        </div>
      </div>
    </MissionProvider>
  );
}
