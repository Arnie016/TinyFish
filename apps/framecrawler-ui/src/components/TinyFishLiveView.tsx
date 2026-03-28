import { motion, AnimatePresence } from 'framer-motion';
import type { TinyFishSession, TinyFishEvent } from '../store/types';

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  STARTED: { icon: '\u25B6', color: '#7C3AED' },
  STREAMING_URL: { icon: '\u25CE', color: '#06B6D4' },
  PROGRESS: { icon: '\u2192', color: '#10B981' },
  HEARTBEAT: { icon: '\u2661', color: '#4B5563' },
  COMPLETE: { icon: '\u2713', color: '#10B981' },
  ERROR: { icon: '\u2717', color: '#EF4444' },
};

function BrowserScreen({ session }: { session: TinyFishSession }) {
  const isActive = session.status === 'running';
  const lastUrl = session.events
    .filter((e) => e.type === 'PROGRESS' && e.message.length > 10)
    .pop()?.message || session.label;

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-bg flex flex-col">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-surface border-b border-border">
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-danger/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-warning/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-success/60" />
        </div>
        <div className="flex-1 min-w-0 mx-1">
          <div className="bg-bg rounded px-1.5 py-0.5 text-[7px] text-text-muted font-mono truncate">
            {session.streamingUrl ? 'observe.tinyfish.ai' : 'connecting...'}
          </div>
        </div>
        {isActive && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-success shrink-0"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>

      {/* Live browser iframe or placeholder */}
      <div className="relative h-32 bg-bg overflow-hidden">
        {session.streamingUrl ? (
          <iframe
            src={session.streamingUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title={`TinyFish: ${session.label}`}
          />
        ) : (
          <>
            {isActive && (
              <motion.div
                className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan to-transparent"
                animate={{ y: [0, 128, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              />
            )}
            <div className="absolute inset-0 shimmer" />
            <div className="p-2 space-y-1.5 opacity-15">
              <div className="h-3 w-24 rounded bg-border" />
              <div className="h-2 w-36 rounded bg-border" />
              <div className="h-2 w-28 rounded bg-border" />
              <div className="h-2 w-32 rounded bg-border" />
            </div>
          </>
        )}

        {/* Status overlay */}
        {session.status === 'complete' && (
          <div className="absolute inset-0 bg-bg/60 flex items-center justify-center">
            <span className="text-[10px] font-medium text-success px-2 py-1 rounded bg-success/10 border border-success/20">
              Complete
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-border">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan/80 to-cyan"
          animate={{ width: `${session.progress}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
      </div>

      {/* Label + event count */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-border/50">
        <span className="text-[8px] font-medium text-text-primary truncate">{session.label}</span>
        <span className="text-[7px] font-mono text-text-muted shrink-0">{session.events.length} events</span>
      </div>
    </div>
  );
}

function EventStream({ events }: { events: TinyFishEvent[] }) {
  const recent = events.slice(-10);

  return (
    <div className="max-h-24 overflow-y-auto space-y-0.5 pr-1">
      <AnimatePresence initial={false}>
        {recent.map((evt, i) => {
          const cfg = EVENT_ICONS[evt.type] || EVENT_ICONS.PROGRESS;
          return (
            <motion.div
              key={`${evt.timestamp}-${i}`}
              initial={{ opacity: 0, x: -6, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[8px]"
            >
              <span
                className="w-3 h-3 rounded flex items-center justify-center text-[7px] shrink-0"
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
  );
}

interface TinyFishLiveViewProps {
  sessions: TinyFishSession[];
  events: TinyFishEvent[];
  progress: number;
  isActive: boolean;
}

export function TinyFishLiveView({ sessions, events, isActive }: TinyFishLiveViewProps) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">🐟</span>
          <span className="text-[9px] font-semibold text-text-primary">TinyFish Live</span>
          {isActive && (
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-success"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>
        <span className="text-[8px] font-mono text-cyan">
          {sessions.filter((s) => s.status === 'running').length} active
        </span>
      </div>

      {/* Browser screens grid — 2 columns */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {sessions.map((session) => (
            <BrowserScreen key={session.id} session={session} />
          ))}
        </div>
      )}

      {/* Merged event stream */}
      {events.length > 0 && <EventStream events={events} />}
    </div>
  );
}
