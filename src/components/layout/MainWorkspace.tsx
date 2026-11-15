import React from 'react';
import { useMission } from '../../context/MissionContext';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { MissionAssistant } from '../ai/MissionAssistant';
import { MissionOverview } from '../dashboard/MissionOverview';
import { EnvironmentalPanel } from '../environment/EnvironmentalPanel';
import { PlanetaryExplorer } from '../map/PlanetaryExplorer';
import { MissionSettings } from '../mission/MissionSettings';
import { RoutePlannerView } from '../mission/RouteControls';
import { MissionReport } from '../reports/MissionReport';
import { ScienceTargetPanel } from '../science/ScienceTargetPanel';
import { TerrainAnalysis } from '../terrain/TerrainAnalysis';

export const MainWorkspace: React.FC = () => {
  const { activeView } = useMission();

  return (
    <main
      id="main-workspace"
      className="flex-1 min-w-0 h-full overflow-y-auto px-2 sm:px-3 py-1 scroll-smooth"
    >
      <div className="w-full pb-8">
        <ErrorBoundary fallbackTitle="Module Telemetry Error">
          {activeView === 'overview' && <MissionOverview />}
          {activeView === 'explorer' && <PlanetaryExplorer />}
          {activeView === 'terrain' && <TerrainAnalysis />}
          {activeView === 'targets' && <ScienceTargetPanel />}
          {activeView === 'planner' && <RoutePlannerView />}
          {activeView === 'environment' && <EnvironmentalPanel />}
          {activeView === 'assistant' && <MissionAssistant />}
          {activeView === 'reports' && <MissionReport />}
          {activeView === 'settings' && <MissionSettings />}
        </ErrorBoundary>
      </div>
    </main>
  );
};
