import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

export function BlenderBridge() {
  const blenderConnected = useFrameCrawlerStore((s) => s.blenderConnected);
  const blenderLastPush = useFrameCrawlerStore((s) => s.blenderLastPush);
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);
  const pushToBlender = useFrameCrawlerStore((s) => s.pushToBlender);

  if (!sceneMetadata) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-3 rounded-full bg-warning" />
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Blender</span>
      </div>

      <div className="rounded-lg border border-border bg-surface/60 p-2.5 space-y-2.5">
        {/* Connection status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${blenderConnected ? 'bg-success' : 'bg-border'}`} />
            <span className="text-[10px] text-text-primary font-medium">
              {blenderConnected ? 'Connected' : 'Not pushed yet'}
            </span>
          </div>
          {blenderLastPush && (
            <span className="text-[8px] font-mono text-text-muted">{blenderLastPush}</span>
          )}
        </div>

        {/* Push button */}
        <button
          onClick={() => pushToBlender()}
          className="w-full text-[11px] font-semibold px-3 py-2 rounded-lg bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30 active:scale-[0.98] transition-all cursor-pointer"
        >
          {blenderConnected ? 'Push Update to Blender' : 'Push to Blender'}
        </button>

        {/* What gets pushed */}
        {blenderConnected && (
          <div className="text-[9px] text-text-muted leading-snug">
            Writes <span className="font-mono text-text-secondary">scene_spec.json</span> — Blender addon auto-rebuilds
          </div>
        )}

        {/* Keyboard hint */}
        <div className="text-[8px] text-text-muted font-mono text-center">
          Press B to push
        </div>
      </div>
    </motion.div>
  );
}
