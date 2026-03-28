import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { SkillRegistry } from './components/SkillRegistry';
import { ActivityFeed } from './components/ActivityFeed';
import { DetailPanel } from './components/DetailPanel';
import { useKeyboardDemo } from './hooks/use-keyboard-demo';

function App() {
  useKeyboardDemo();

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <Header />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stats row */}
        <div className="px-6 py-4">
          <StatsBar />
        </div>

        {/* Main content: three columns */}
        <div className="flex-1 flex gap-4 px-6 pb-4 overflow-hidden min-h-0">
          {/* Left: Skill registry */}
          <div className="w-[380px] shrink-0 overflow-y-auto pr-1">
            <SkillRegistry />
          </div>

          {/* Center: Detail panel */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <DetailPanel />
          </div>

          {/* Right: Activity feed */}
          <div className="w-[300px] shrink-0 overflow-hidden">
            <ActivityFeed />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
