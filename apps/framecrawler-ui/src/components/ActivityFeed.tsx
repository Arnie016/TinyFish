import { motion, AnimatePresence } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';
import type { ActivityEventType } from '../store/types';

const EVENT_CONFIG: Record<string, { icon: string; color: string }> = {
  research_started: { icon: '\u{1F50D}', color: '#06B6D4' },
  tinyfish_progress: { icon: '\u{1F41F}', color: '#06B6D4' },
  research_complete: { icon: '\u2713', color: '#10B981' },
  source_extracted: { icon: '\u{1F4CE}', color: '#EC4899' },
  plan_started: { icon: '\u{1F4D0}', color: '#7C3AED' },
  plan_complete: { icon: '\u2713', color: '#10B981' },
  object_placed: { icon: '\u25A0', color: '#7C3AED' },
  light_added: { icon: '\u2600', color: '#F59E0B' },
  camera_set: { icon: '\u{1F3AC}', color: '#06B6D4' },
  scene_ready: { icon: '\u2713', color: '#10B981' },
  info: { icon: '\u2022', color: '#6B7280' },
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ActivityFeed() {
  const activity = useFrameCrawlerStore((s) => s.activity);

  return (
    <div className="space-y-1">
      <AnimatePresence initial={false}>
        {activity.slice(0, 20).map((evt) => {
          const cfg = EVENT_CONFIG[evt.type as ActivityEventType] || EVENT_CONFIG.info;
          return (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, height: 0, x: 10 }}
              animate={{ opacity: 1, height: 'auto', x: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex items-start gap-2 px-2 py-1.5 rounded"
            >
              <span className="text-[10px] mt-0.5 shrink-0">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-text-primary truncate">{evt.title}</div>
                {evt.detail && (
                  <div className="text-[9px] text-text-muted truncate">{evt.detail}</div>
                )}
              </div>
              <span className="text-[8px] font-mono text-text-muted shrink-0 mt-0.5">
                {formatTime(evt.timestamp)}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
