import { motion, AnimatePresence } from 'framer-motion';
import { useRadarStore } from '../store/radar-store';
import type { ActivityEventType } from '../store/types';

const EVENT_CONFIG: Record<ActivityEventType, { icon: string; color: string }> = {
  scan_started: { icon: '🔍', color: '#7C3AED' },
  scan_complete: { icon: '✓', color: '#10B981' },
  similarity_found: { icon: '◉', color: '#3B82F6' },
  compile_started: { icon: '⚙', color: '#F59E0B' },
  compile_complete: { icon: '✦', color: '#10B981' },
  run_started: { icon: '▶', color: '#3B82F6' },
  run_step: { icon: '→', color: '#6B7280' },
  run_complete: { icon: '✓', color: '#10B981' },
  patch_detected: { icon: '⚠', color: '#F59E0B' },
  patch_applied: { icon: '✓', color: '#10B981' },
  skill_created: { icon: '★', color: '#7C3AED' },
  tinyfish_progress: { icon: '🐟', color: '#3B82F6' },
  source_discovered: { icon: '◎', color: '#10B981' },
  info: { icon: 'ℹ', color: '#6B7280' },
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function ActivityFeed() {
  const activity = useRadarStore((s) => s.activity);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-1 mb-3">
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Live Activity</h2>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        <AnimatePresence initial={false}>
          {activity.map((evt) => {
            const config = EVENT_CONFIG[evt.type];
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="rounded-lg border border-border bg-surface px-3 py-2 overflow-hidden"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="text-xs mt-0.5 w-5 h-5 flex items-center justify-center rounded-md shrink-0"
                    style={{ backgroundColor: `${config.color}20`, color: config.color }}
                  >
                    {config.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-text-primary truncate">{evt.title}</span>
                      <span className="text-[10px] font-mono text-text-muted shrink-0">{formatTime(evt.timestamp)}</span>
                    </div>
                    {evt.detail && (
                      <p className="text-[11px] text-text-secondary mt-0.5 truncate">{evt.detail}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {activity.length === 0 && (
          <div className="text-xs text-text-muted text-center py-8">
            Waiting for events...
          </div>
        )}
      </div>
    </div>
  );
}
