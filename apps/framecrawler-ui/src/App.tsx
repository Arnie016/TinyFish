import { Header } from './components/Header';
import { PipelineProgress } from './components/PipelineProgress';
import { PromptBar } from './components/PromptBar';
import { ContextualTip } from './components/ContextualTip';
import { PipelineStages } from './components/PipelineStages';
import { ResearchPanel } from './components/ResearchPanel';
import { ArtifactGraph } from './components/ArtifactGraph';
import { SceneSpecPanel } from './components/SceneSpecPanel';
import { ValidationPanel } from './components/ValidationPanel';
import { PerformanceBar } from './components/PerformanceBar';
import { BlenderBridge } from './components/BlenderBridge';
import { ActivityFeed } from './components/ActivityFeed';
import { useKeyboardDemo } from './hooks/use-keyboard-demo';
import { useFrameCrawlerStore } from './store/framecrawler-store';

function App() {
  useKeyboardDemo();
  const demoPhase = useFrameCrawlerStore((s) => s.demoPhase);
  const activity = useFrameCrawlerStore((s) => s.activity);
  const activeTip = useFrameCrawlerStore((s) => s.activeTip);
  const validationResult = useFrameCrawlerStore((s) => s.validationResult);
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);

  return (
    <div className="h-screen w-full flex flex-col bg-bg overflow-hidden">
      <Header />
      <PipelineProgress />

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3 min-h-0">
        <PromptBar />

        {/* Contextual tip banner */}
        {activeTip && <ContextualTip />}

        {/* Pipeline version checkpoints */}
        {demoPhase >= 2 && <PipelineStages />}

        {/* TinyFish research visualization */}
        {demoPhase >= 2 && <ResearchPanel />}

        {/* Artifact bank — drag & drop graph */}
        {demoPhase >= 3 && <ArtifactGraph />}

        {/* SceneSpec building up */}
        {demoPhase >= 4 && <SceneSpecPanel />}

        {/* QA validation checklist */}
        {demoPhase >= 4 && validationResult && <ValidationPanel />}

        {/* Performance budget bars */}
        {demoPhase >= 4 && sceneMetadata && <PerformanceBar />}

        {/* Blender connection + push */}
        {demoPhase >= 4 && <BlenderBridge />}

        {/* Activity feed */}
        {activity.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-3 rounded-full bg-text-muted" />
              <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Activity</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <ActivityFeed />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
