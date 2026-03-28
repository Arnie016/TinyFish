import { motion } from 'framer-motion';

interface ScanningViewProps {
  url: string;
  progress: number;
  status: string;
}

export function ScanningView({ url, progress, status }: ScanningViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
          <h2 className="text-lg font-bold text-text-primary">Extracting Workflow</h2>
        </div>
        <p className="text-xs text-text-secondary font-mono truncate">{url}</p>
      </div>

      {/* Browser mockup */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-danger/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
          </div>
          <div className="flex-1 mx-2">
            <div className="bg-bg rounded-md px-3 py-1 text-[11px] text-text-muted font-mono truncate">
              {url}
            </div>
          </div>
        </div>
        <div className="relative h-48 bg-bg overflow-hidden">
          {/* Animated scan lines */}
          <motion.div
            className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent"
            animate={{ y: [0, 192, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
          {/* Shimmer overlay */}
          <div className="absolute inset-0 shimmer" />
          {/* Fake content blocks */}
          <div className="p-4 space-y-3 opacity-20">
            <div className="h-5 w-48 rounded bg-border" />
            <div className="h-3 w-72 rounded bg-border" />
            <div className="h-3 w-64 rounded bg-border" />
            <div className="h-3 w-56 rounded bg-border" />
            <div className="mt-4 h-4 w-36 rounded bg-border" />
            <div className="h-3 w-80 rounded bg-border" />
            <div className="h-3 w-60 rounded bg-border" />
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-secondary">{status}</span>
          <span className="text-xs font-mono text-accent">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-dim to-accent"
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
        </div>
      </div>

      {/* TinyFish badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20">
        <span className="text-sm">🐟</span>
        <span className="text-xs text-accent font-medium">TinyFish MCP — Live Browser Extraction</span>
      </div>
    </div>
  );
}
