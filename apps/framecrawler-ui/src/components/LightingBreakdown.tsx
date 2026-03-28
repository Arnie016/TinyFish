import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

const TYPE_LABELS: Record<string, string> = {
  key: 'KEY',
  fill: 'FILL',
  rim: 'RIM',
  practical: 'PRAC',
};

export function LightingBreakdown() {
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);
  const visibleLightIds = useFrameCrawlerStore((s) => s.visibleLightIds);

  if (!sceneMetadata) return null;

  const lights = sceneMetadata.lighting.lights;

  return (
    <div className="space-y-2">
      {lights.map((light, i) => {
        const isVisible = visibleLightIds.includes(light.id);

        return (
          <motion.div
            key={light.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-2 px-2 py-1.5"
          >
            {/* Color swatch */}
            <div
              className="w-4 h-4 rounded-full shrink-0 border border-white/10"
              style={{
                backgroundColor: light.color,
                boxShadow: isVisible ? `0 0 8px ${light.color}60` : 'none',
              }}
            />

            {/* Type badge */}
            <span className="text-[9px] font-mono font-bold text-text-muted w-7 shrink-0">
              {TYPE_LABELS[light.type] || light.type.toUpperCase()}
            </span>

            {/* Label */}
            <span className="text-[11px] text-text-primary flex-1 truncate">{light.label}</span>

            {/* Intensity */}
            <span className="text-[9px] font-mono text-text-muted shrink-0">
              {light.intensity.toFixed(1)}
            </span>

            {/* Status */}
            {isVisible ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: light.color }}
              />
            ) : (
              <div className="w-2 h-2 rounded-full bg-border shrink-0" />
            )}
          </motion.div>
        );
      })}

      {/* Overall feel */}
      <div className="mt-2 px-2 py-2 rounded-md bg-surface/50 border border-border">
        <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Overall Feel</div>
        <div className="text-[10px] text-text-secondary leading-snug">
          {sceneMetadata.lighting.overall_feel}
        </div>
      </div>
    </div>
  );
}
