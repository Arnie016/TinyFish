import { motion, AnimatePresence } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

const CATEGORY_ICONS: Record<string, string> = {
  setpiece: '\u25A0',
  prop: '\u25CB',
  character: '\u263A',
  vehicle: '\u25B7',
  fx: '\u2737',
  ui: '\u25C8',
};

const CATEGORY_COLORS: Record<string, string> = {
  setpiece: '#7C3AED',
  prop: '#06B6D4',
  character: '#EC4899',
  vehicle: '#F59E0B',
  fx: '#10B981',
  ui: '#6366F1',
};

export function ObjectList() {
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);
  const visibleObjectIds = useFrameCrawlerStore((s) => s.visibleObjectIds);
  const hoveredObjectId = useFrameCrawlerStore((s) => s.hoveredObjectId);
  const setHoveredObject = useFrameCrawlerStore((s) => s.setHoveredObject);

  if (!sceneMetadata) return null;

  const objects = sceneMetadata.objects;

  return (
    <div className="space-y-1">
      <AnimatePresence>
        {objects.map((obj, i) => {
          const isVisible = visibleObjectIds.includes(obj.id);
          const isHovered = hoveredObjectId === obj.id;
          const color = CATEGORY_COLORS[obj.category] || '#6B7280';

          return (
            <motion.div
              key={obj.id}
              initial={{ opacity: 0, x: 10, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              transition={{ delay: i * 0.06 }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                isHovered ? 'bg-surface-hover border border-border-bright' : 'border border-transparent hover:bg-surface'
              }`}
              onMouseEnter={() => setHoveredObject(obj.id)}
              onMouseLeave={() => setHoveredObject(null)}
            >
              {/* Category icon */}
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] shrink-0"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {CATEGORY_ICONS[obj.category] || '\u25CF'}
              </span>

              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-text-primary truncate">{obj.name}</div>
                <div className="text-[9px] text-text-muted truncate">{obj.placement_hint}</div>
              </div>

              {/* Build status */}
              {isVisible ? (
                <div className="w-2 h-2 rounded-full bg-success shrink-0" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-border shrink-0" />
              )}

              {/* Confidence */}
              <div className="w-8 text-right">
                <span className="text-[9px] font-mono text-text-muted">
                  {(obj.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
