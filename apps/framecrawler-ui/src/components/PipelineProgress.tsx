import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';
import type { DemoPhase } from '../store/types';
import { PHASE_LABELS } from '../store/types';

const STAGES: DemoPhase[] = [1, 2, 3, 4, 5, 6, 7, 8];

export function PipelineProgress() {
  const demoPhase = useFrameCrawlerStore((s) => s.demoPhase);

  return (
    <div className="px-3 py-2 flex items-center gap-0.5 border-b border-border/50">
      {STAGES.map((stage, i) => {
        const isActive = demoPhase === stage;
        const isDone = demoPhase > stage;

        return (
          <div key={stage} className="flex items-center gap-0.5 flex-1 min-w-0">
            {i > 0 && (
              <div
                className="w-2 h-px shrink-0"
                style={{
                  backgroundColor: isDone ? '#10B981' : isActive ? '#7C3AED' : '#1e1e30',
                }}
              />
            )}
            <div className="flex items-center gap-1 min-w-0">
              <motion.div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor: isDone ? '#10B981' : isActive ? '#7C3AED' : '#2a2a40',
                }}
                animate={isActive ? {
                  boxShadow: ['0 0 2px rgba(124,58,237,0.4)', '0 0 8px rgba(124,58,237,0.8)', '0 0 2px rgba(124,58,237,0.4)'],
                } : {}}
                transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
              />
              <span
                className={`text-[7px] font-medium truncate ${
                  isActive ? 'text-accent' : isDone ? 'text-success' : 'text-text-muted'
                }`}
              >
                {PHASE_LABELS[stage]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
