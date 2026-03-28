import { useState } from 'react';
import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

function BudgetBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct < 60 ? '#10B981' : pct < 80 ? '#F59E0B' : '#EF4444';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-text-secondary">{label}</span>
        <span className="text-[8px] font-mono text-text-muted">
          {typeof value === 'number' && value > 999 ? `${(value / 1000).toFixed(1)}K` : value} / {max > 999 ? `${(max / 1000).toFixed(0)}K` : max} {unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        />
      </div>
    </div>
  );
}

export function PerformanceBar() {
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);
  const [showObjects, setShowObjects] = useState(false);

  if (!sceneMetadata) return null;

  const objects = sceneMetadata.objects;
  const totalPolys = objects.reduce((sum, o) => sum + (o.performance?.polyCount ?? 0), 0);
  const totalTexMB = objects.reduce((sum, o) => sum + (o.performance?.textureMemoryMB ?? 0), 0);
  const lodCount = objects.filter((o) => o.performance?.suggestLOD).length;

  const healthPct = (totalPolys / 100000) * 100;
  const healthLabel = healthPct < 60 ? 'Good' : healthPct < 80 ? 'Caution' : 'Critical';
  const healthColor = healthPct < 60 ? '#10B981' : healthPct < 80 ? '#F59E0B' : '#EF4444';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-3 rounded-full" style={{ backgroundColor: healthColor }} />
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Performance</span>
        <span
          className="text-[8px] font-mono px-1.5 py-0.5 rounded-full ml-auto border"
          style={{ color: healthColor, borderColor: `${healthColor}30`, backgroundColor: `${healthColor}10` }}
        >
          {healthLabel}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface/40 p-2.5 space-y-2">
        <BudgetBar label="Polygon Budget" value={totalPolys} max={100000} unit="polys" />
        <BudgetBar label="Texture Memory" value={Math.round(totalTexMB * 10) / 10} max={256} unit="MB" />

        {lodCount > 0 && (
          <div className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-warning/8 border border-warning/15">
            <span className="text-[9px] text-warning">{lodCount} objects suggest LOD proxy</span>
          </div>
        )}

        {/* Collapsible per-object breakdown */}
        <button
          onClick={() => setShowObjects(!showObjects)}
          className="text-[8px] text-text-muted hover:text-text-primary cursor-pointer w-full text-left"
        >
          {showObjects ? '\u25B4' : '\u25BE'} Per-object breakdown
        </button>

        {showObjects && (
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {objects
              .filter((o) => o.performance)
              .sort((a, b) => (b.performance?.polyCount ?? 0) - (a.performance?.polyCount ?? 0))
              .map((obj) => (
                <div key={obj.id} className="flex items-center gap-1.5 py-0.5">
                  <span className="text-[8px] text-text-secondary flex-1 truncate">{obj.name}</span>
                  {obj.performance?.suggestLOD && (
                    <span className="text-[7px] font-mono text-warning px-1 rounded bg-warning/10 border border-warning/15">LOD</span>
                  )}
                  <span className="text-[7px] font-mono text-text-muted shrink-0">
                    {((obj.performance?.polyCount ?? 0) / 1000).toFixed(1)}K
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
