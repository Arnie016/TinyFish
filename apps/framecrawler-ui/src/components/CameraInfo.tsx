import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

export function CameraInfo() {
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);
  const cameraAnimating = useFrameCrawlerStore((s) => s.cameraAnimating);

  if (!sceneMetadata) return null;

  const cam = sceneMetadata.camera;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs">&#x1F3AC;</span>
        <span className="text-[11px] font-medium text-text-primary">{cam.shot_type}</span>
        {cameraAnimating && (
          <motion.span
            className="text-[9px] font-mono text-cyan px-1.5 py-0.5 rounded bg-cyan/10 border border-cyan/20"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ANIMATING
          </motion.span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="px-2 py-1.5 rounded bg-surface/50 border border-border">
          <div className="text-[9px] text-text-muted uppercase">Lens</div>
          <div className="text-[10px] text-text-secondary">{cam.lens_feel}</div>
        </div>
        <div className="px-2 py-1.5 rounded bg-surface/50 border border-border">
          <div className="text-[9px] text-text-muted uppercase">Waypoints</div>
          <div className="text-[10px] text-text-secondary">{cam.path.length} points</div>
        </div>
      </div>

      <div className="px-2 py-1.5 rounded bg-surface/50 border border-border">
        <div className="text-[9px] text-text-muted uppercase mb-0.5">Framing Notes</div>
        <div className="text-[10px] text-text-secondary leading-snug">{cam.framing_notes}</div>
      </div>
    </motion.div>
  );
}
