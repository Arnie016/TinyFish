import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';
import { PromptBar } from './PromptBar';
import { SceneViewport } from './SceneViewport';
import { PHASE_LABELS } from '../store/types';
import type { DemoPhase } from '../store/types';

export function ViewportPanel() {
  const demoPhase = useFrameCrawlerStore((s) => s.demoPhase);
  const visibleObjectIds = useFrameCrawlerStore((s) => s.visibleObjectIds);
  const visibleLightIds = useFrameCrawlerStore((s) => s.visibleLightIds);
  const blenderConnected = useFrameCrawlerStore((s) => s.blenderConnected);
  const blenderLastPush = useFrameCrawlerStore((s) => s.blenderLastPush);
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);
  const pushToBlender = useFrameCrawlerStore((s) => s.pushToBlender);

  return (
    <div className="h-full flex flex-col gap-3">
      <PromptBar />

      <div className="flex-1 relative min-h-0">
        <SceneViewport />

        {/* Status overlay — bottom left */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none">
          <div className="glass rounded-lg px-3 py-2 space-y-1">
            <div className="text-[10px] text-text-muted uppercase tracking-wider">Preview</div>
            <div className="text-xs font-medium text-text-primary">Neon Market of Lost Signals</div>
            {demoPhase >= 5 && (
              <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary">
                <span>{visibleObjectIds.length} objects</span>
                <span>{visibleLightIds.length} lights</span>
              </div>
            )}
          </div>

          {demoPhase > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {demoPhase >= 8 ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-xs font-medium text-success">Ready for Artist</span>
                  </>
                ) : (
                  <>
                    <motion.div
                      className="w-2 h-2 rounded-full bg-accent"
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    <span className="text-xs font-medium text-accent">
                      {PHASE_LABELS[demoPhase as DemoPhase]}
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Blender connection — top right */}
        <div className="absolute top-3 right-3 pointer-events-auto">
          <div className="glass rounded-lg px-3 py-2 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${blenderConnected ? 'bg-success' : 'bg-border'}`} />
              <span className="text-[10px] font-medium text-text-primary">Blender</span>
              {blenderConnected && (
                <span className="text-[9px] font-mono text-success">Connected</span>
              )}
            </div>

            {blenderLastPush && (
              <div className="text-[9px] text-text-muted font-mono">
                Last push: {blenderLastPush}
              </div>
            )}

            {sceneMetadata && (
              <button
                onClick={() => pushToBlender()}
                className="w-full text-[10px] font-medium px-2 py-1.5 rounded-md bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30 transition-colors cursor-pointer"
              >
                Push to Blender
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
