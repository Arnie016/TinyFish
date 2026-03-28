import { motion } from 'framer-motion';
import { TinyFishLiveView } from './TinyFishLiveView';
import type { TinyFishEvent } from '../store/types';

interface ScanningViewProps {
  url: string;
  progress: number;
  status: string;
  tinyFishEvents: TinyFishEvent[];
}

export function ScanningView({ url, progress, status, tinyFishEvents }: ScanningViewProps) {
  const isActive = progress < 100;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <motion.div
            className="w-2.5 h-2.5 rounded-full bg-accent"
            animate={isActive ? { opacity: [1, 0.3, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <h2 className="text-lg font-bold text-text-primary">Extracting Workflow</h2>
        </div>
        <p className="text-xs text-text-secondary font-mono truncate">{url}</p>
      </div>

      {/* TinyFish live browser */}
      <TinyFishLiveView
        events={tinyFishEvents}
        url={url}
        progress={progress}
        isActive={isActive}
      />

      {/* Current step status */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border">
        {isActive ? (
          <motion.div
            className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent shrink-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        ) : (
          <span className="text-success text-sm">✓</span>
        )}
        <span className="text-xs text-text-secondary">{status}</span>
        <span className="ml-auto text-xs font-mono text-accent">{progress}%</span>
      </div>
    </div>
  );
}
