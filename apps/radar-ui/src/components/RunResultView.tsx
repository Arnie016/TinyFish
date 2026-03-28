import { motion } from 'framer-motion';
import type { RunResult } from '../store/types';

const STEP_STATUS_CONFIG = {
  pending: { color: '#4B5563', bg: 'rgba(75,85,99,0.15)', icon: '○' },
  running: { color: '#7C3AED', bg: 'rgba(124,58,237,0.15)', icon: '◉' },
  done: { color: '#10B981', bg: 'rgba(16,185,129,0.15)', icon: '✓' },
};

export function RunResultView({ result }: { result: RunResult }) {
  const allDone = result.steps.every((s) => s.status === 'done');

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-lg ${allDone ? 'text-success' : 'text-accent'}`}>▶</span>
          <h2 className="text-lg font-bold text-text-primary">
            {allDone ? 'Run Complete' : 'Running Skill'}
          </h2>
        </div>
        <p className="text-xs text-text-secondary">
          <span className="font-mono text-accent">{result.skill_name}</span>
          {' → '}
          <span className="font-mono text-text-primary">{result.project_name}</span>
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {result.steps.map((step) => {
          const cfg = STEP_STATUS_CONFIG[step.status];
          return (
            <motion.div
              key={step.number}
              layout
              className="rounded-xl border bg-surface overflow-hidden"
              style={{ borderColor: step.status === 'running' ? cfg.color : 'var(--color-border)' }}
              animate={step.status === 'running' ? { boxShadow: `0 0 12px ${cfg.bg}` } : { boxShadow: 'none' }}
            >
              <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <motion.div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    animate={step.status === 'running' ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 1, repeat: step.status === 'running' ? Infinity : 0 }}
                  >
                    {cfg.icon}
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{step.title}</span>
                    </div>
                    {step.command && (
                      <div className="mt-1.5 px-3 py-1.5 rounded-md bg-bg font-mono text-xs text-accent">
                        $ {step.command}
                      </div>
                    )}
                    <p className="text-xs text-text-secondary mt-1.5">{step.detail}</p>
                    {step.evidence && (
                      <div className="mt-2 px-3 py-2 rounded-md border border-border bg-bg text-[11px]">
                        <p className="text-text-muted font-mono">"{step.evidence.snippet}"</p>
                        <p className="text-text-muted mt-1 truncate text-[10px]">{step.evidence.url}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {allDone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border-2 border-success bg-success-dim p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center text-success font-bold">
              ✓
            </div>
            <div>
              <span className="text-sm font-bold text-success">All steps completed</span>
              <p className="text-xs text-text-secondary mt-0.5">
                {result.steps.length}/{result.steps.length} steps · Evidence citations attached
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
