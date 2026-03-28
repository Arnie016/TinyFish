import { motion, AnimatePresence } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

const CATEGORY_COLORS: Record<string, string> = {
  setpiece: '#7C3AED',
  prop: '#06B6D4',
  character: '#EC4899',
  vehicle: '#F59E0B',
  fx: '#10B981',
  ui: '#6366F1',
};

export function SceneSpecPanel() {
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);
  const demoPhase = useFrameCrawlerStore((s) => s.demoPhase);

  if (!sceneMetadata) return null;

  const env = sceneMetadata.environment;
  const objectsByCategory = sceneMetadata.objects.reduce((acc, obj) => {
    acc[obj.category] = (acc[obj.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgConfidence = sceneMetadata.objects.reduce((sum, o) => sum + o.confidence, 0) / sceneMetadata.objects.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-3 rounded-full bg-accent" />
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">SceneSpec</span>
        <span className="text-[9px] font-mono text-success ml-auto">validated</span>
      </div>

      {/* Environment summary */}
      <div className="rounded-lg border border-border bg-surface/60 p-2.5 space-y-2">
        <div className="text-[11px] font-medium text-text-primary">{sceneMetadata.scene_goal}</div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1">
          {[
            ['Location', env.location_type],
            ['Time', env.time_of_day],
            ['Weather', env.weather],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[8px] text-text-muted uppercase">{label}</div>
              <div className="text-[10px] text-text-secondary">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Objects', value: sceneMetadata.objects.length, color: '#7C3AED' },
          { label: 'Lights', value: sceneMetadata.lighting.lights.length, color: '#F59E0B' },
          { label: 'Sources', value: sceneMetadata.citations.length, color: '#06B6D4' },
          { label: 'Conf.', value: `${(avgConfidence * 100).toFixed(0)}%`, color: '#10B981' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-md border border-border bg-surface/40 px-2 py-1.5 text-center">
            <div className="text-sm font-bold text-text-primary">{stat.value}</div>
            <div className="text-[8px] text-text-muted uppercase">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Object breakdown by category */}
      <div className="rounded-lg border border-border bg-surface/40 p-2.5 space-y-1.5">
        <div className="text-[9px] text-text-muted uppercase tracking-wider">Objects by type</div>
        <div className="space-y-1">
          {Object.entries(objectsByCategory).map(([cat, count]) => {
            const color = CATEGORY_COLORS[cat] || '#6B7280';
            const pct = (count / sceneMetadata.objects.length) * 100;
            return (
              <div key={cat} className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-text-muted w-14 capitalize">{cat}</span>
                <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                  />
                </div>
                <span className="text-[9px] font-mono text-text-muted w-4 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lighting summary */}
      <div className="rounded-lg border border-border bg-surface/40 p-2.5 space-y-1.5">
        <div className="text-[9px] text-text-muted uppercase tracking-wider">Lighting</div>
        <div className="flex flex-wrap gap-1.5">
          {sceneMetadata.lighting.lights.map((light) => (
            <div key={light.id} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-bg border border-border">
              <div
                className="w-2.5 h-2.5 rounded-full border border-white/10"
                style={{ backgroundColor: light.color, boxShadow: `0 0 6px ${light.color}40` }}
              />
              <span className="text-[9px] text-text-secondary">{light.label}</span>
              <span className="text-[8px] font-mono text-text-muted">{light.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Color palette + mood */}
      <div className="rounded-lg border border-border bg-surface/40 p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {sceneMetadata.color_palette.map((color) => (
              <motion.div
                key={color}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-4 h-4 rounded border border-white/10"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <AnimatePresence>
            {sceneMetadata.mood_keywords.map((kw, i) => (
              <motion.span
                key={kw}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-magenta/10 text-magenta border border-magenta/15"
              >
                {kw}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Object list (compact) */}
      {demoPhase >= 5 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-border bg-surface/40 p-2.5 space-y-1"
        >
          <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Objects</div>
          {sceneMetadata.objects.map((obj) => (
            <div key={obj.id} className="flex items-center gap-1.5 py-0.5">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[obj.category] || '#6B7280' }}
              />
              <span className="text-[9px] text-text-secondary flex-1 truncate">{obj.name}</span>
              <span className="text-[8px] font-mono text-text-muted">{(obj.confidence * 100).toFixed(0)}%</span>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
