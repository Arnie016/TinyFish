import { motion, AnimatePresence } from 'framer-motion';
import type { TinyFishEvent } from '../store/types';

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  STARTED: { icon: '▶', color: '#7C3AED' },
  STREAMING_URL: { icon: '◎', color: '#3B82F6' },
  PROGRESS: { icon: '→', color: '#10B981' },
  HEARTBEAT: { icon: '♡', color: '#4B5563' },
  COMPLETE: { icon: '✓', color: '#10B981' },
};

interface TinyFishLiveViewProps {
  events: TinyFishEvent[];
  url: string;
  progress: number;
  isActive: boolean;
}

export function TinyFishLiveView({ events, url, progress, isActive }: TinyFishLiveViewProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🐟</span>
          <span className="text-xs font-semibold text-text-primary">TinyFish Live Browser</span>
          {isActive && (
            <motion.div
              className="w-2 h-2 rounded-full bg-success"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>
        {events.find((e) => e.type === 'STREAMING_URL') && (
          <span className="text-[10px] font-mono text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
            Session Live
          </span>
        )}
      </div>

      {/* Browser mockup */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border-b border-border">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-danger/60" />
            <div className="w-2 h-2 rounded-full bg-warning/60" />
            <div className="w-2 h-2 rounded-full bg-success/60" />
          </div>
          <div className="flex-1 mx-2">
            <div className="bg-bg rounded px-2 py-0.5 text-[10px] text-text-muted font-mono truncate">
              {url}
            </div>
          </div>
        </div>

        {/* Browser viewport */}
        <div className="relative h-28 bg-bg overflow-hidden">
          {isActive && (
            <motion.div
              className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent"
              animate={{ y: [0, 112, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            />
          )}
          <div className="absolute inset-0 shimmer" />
          <div className="p-3 space-y-2 opacity-15">
            <div className="h-4 w-40 rounded bg-border" />
            <div className="h-2.5 w-56 rounded bg-border" />
            <div className="h-2.5 w-48 rounded bg-border" />
            <div className="h-2.5 w-52 rounded bg-border" />
            <div className="mt-2 h-3 w-32 rounded bg-border" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-border">
          <motion.div
            className="h-full bg-gradient-to-r from-accent-dim to-accent"
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
        </div>
      </div>

      {/* SSE event stream */}
      <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
        <AnimatePresence initial={false}>
          {events.map((evt, i) => {
            const cfg = EVENT_ICONS[evt.type] || EVENT_ICONS.PROGRESS;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                className="flex items-center gap-2 px-2 py-1 rounded text-[10px]"
              >
                <span
                  className="w-4 h-4 rounded flex items-center justify-center text-[8px] shrink-0"
                  style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
                >
                  {cfg.icon}
                </span>
                <span className="text-text-secondary font-mono truncate">{evt.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
