import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

export function MoodPalette() {
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);

  if (!sceneMetadata) return null;

  return (
    <div className="space-y-3">
      {/* Color swatches */}
      <div>
        <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5">Color Palette</div>
        <div className="flex gap-1.5">
          {sceneMetadata.color_palette.map((color, i) => (
            <motion.div
              key={color}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25, delay: i * 0.08 }}
              className="w-7 h-7 rounded-md border border-white/10"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Mood keywords */}
      <div>
        <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5">Mood</div>
        <div className="flex flex-wrap gap-1">
          {sceneMetadata.mood_keywords.map((keyword, i) => (
            <motion.span
              key={keyword}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: i * 0.06 }}
              className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-magenta/10 text-magenta border border-magenta/20"
            >
              {keyword}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
