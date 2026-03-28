import { motion, AnimatePresence } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';
import { ObjectList } from './ObjectList';
import { LightingBreakdown } from './LightingBreakdown';
import { CameraInfo } from './CameraInfo';
import { MoodPalette } from './MoodPalette';
import { EnvironmentCard } from './EnvironmentCard';
import { ActivityFeed } from './ActivityFeed';

function SectionHeader({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-1 h-4 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function BreakdownPanel() {
  const demoPhase = useFrameCrawlerStore((s) => s.demoPhase);
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);
  const activity = useFrameCrawlerStore((s) => s.activity);

  if (demoPhase === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted">
        <div className="text-2xl mb-2">&#x1F3AC;</div>
        <div className="text-xs text-center">
          Scene breakdown<br />
          <span className="text-text-muted/50">Waiting for data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Activity Feed (always visible after phase 1) */}
      {activity.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <SectionHeader color="#6B7280" label="Activity" />
          <div className="max-h-36 overflow-y-auto">
            <ActivityFeed />
          </div>
        </motion.div>
      )}

      {/* Environment + Mood (phase 4+) */}
      <AnimatePresence>
        {sceneMetadata && demoPhase >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <EnvironmentCard />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sceneMetadata && demoPhase >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
          >
            <MoodPalette />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Object list (phase 4+) */}
      <AnimatePresence>
        {sceneMetadata && demoPhase >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.2 }}
          >
            <SectionHeader color="#7C3AED" label={`Objects (${sceneMetadata.objects.length})`} />
            <ObjectList />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lighting (phase 4+) */}
      <AnimatePresence>
        {sceneMetadata && demoPhase >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.3 }}
          >
            <SectionHeader color="#F59E0B" label={`Lighting (${sceneMetadata.lighting.lights.length})`} />
            <LightingBreakdown />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera (phase 4+) */}
      <AnimatePresence>
        {sceneMetadata && demoPhase >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.4 }}
          >
            <SectionHeader color="#06B6D4" label="Camera" />
            <CameraInfo />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review stats (phase 8) */}
      <AnimatePresence>
        {demoPhase >= 8 && sceneMetadata && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs font-semibold text-success">Scene Ready for Artist</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-text-primary">{sceneMetadata.objects.length}</div>
                <div className="text-[9px] text-text-muted uppercase">Objects</div>
              </div>
              <div>
                <div className="text-lg font-bold text-text-primary">{sceneMetadata.lighting.lights.length}</div>
                <div className="text-[9px] text-text-muted uppercase">Lights</div>
              </div>
              <div>
                <div className="text-lg font-bold text-text-primary">{sceneMetadata.citations.length}</div>
                <div className="text-[9px] text-text-muted uppercase">Citations</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
