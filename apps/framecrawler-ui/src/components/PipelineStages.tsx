import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

function formatTime(ts: number | null) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#2a2a40',
  active: '#7C3AED',
  complete: '#10B981',
  failed: '#EF4444',
};

export function PipelineStages() {
  const checkpoints = useFrameCrawlerStore((s) => s.pipelineCheckpoints);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-1.5"
    >
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-3 rounded-full bg-accent" />
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Pipeline</span>
      </div>

      <div className="rounded-lg border border-border bg-surface/40 p-2.5">
        {checkpoints.map((cp, i) => {
          const color = STATUS_COLORS[cp.status];
          const isLast = i === checkpoints.length - 1;

          return (
            <div key={cp.stage} className="flex gap-2">
              {/* Timeline column */}
              <div className="flex flex-col items-center w-3 shrink-0">
                <motion.div
                  className="w-2.5 h-2.5 rounded-full border-2 shrink-0"
                  style={{
                    borderColor: color,
                    backgroundColor: cp.status === 'complete' ? color : 'transparent',
                  }}
                  animate={cp.status === 'active' ? {
                    boxShadow: [`0 0 0px ${color}`, `0 0 8px ${color}`, `0 0 0px ${color}`],
                  } : {}}
                  transition={cp.status === 'active' ? { duration: 1.5, repeat: Infinity } : {}}
                />
                {!isLast && (
                  <div className="w-px flex-1 min-h-[16px]" style={{ backgroundColor: `${color}40` }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-2 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-text-primary">{cp.label}</span>
                  {cp.status === 'active' && (
                    <span className="text-[7px] font-mono text-accent px-1 rounded bg-accent/10 border border-accent/20">ACTIVE</span>
                  )}
                  {cp.timestamp && (
                    <span className="text-[7px] font-mono text-text-muted ml-auto">{formatTime(cp.timestamp)}</span>
                  )}
                </div>
                <div className="text-[8px] text-text-muted">{cp.description}</div>
                {cp.stats && Object.keys(cp.stats).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(cp.stats).map(([k, v]) => (
                      <span key={k} className="text-[7px] font-mono px-1 py-0 rounded bg-success/10 text-success border border-success/15">
                        {v} {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
