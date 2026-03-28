import { motion, AnimatePresence } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';
import type { ValidationStatus } from '../store/types';

const STATUS_CONFIG: Record<ValidationStatus, { icon: string; color: string; bg: string }> = {
  pass: { icon: '\u2713', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  warn: { icon: '\u26A0', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  fail: { icon: '\u2717', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

const OVERALL_LABELS: Record<ValidationStatus, string> = {
  pass: 'Healthy',
  warn: 'Caution',
  fail: 'Critical',
};

export function ValidationPanel() {
  const result = useFrameCrawlerStore((s) => s.validationResult);
  const animating = useFrameCrawlerStore((s) => s.validationAnimating);

  if (!result) return null;

  const overall = STATUS_CONFIG[result.overallStatus];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-3 rounded-full" style={{ backgroundColor: overall.color }} />
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">QA Validation</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[8px] font-mono text-success">{result.passCount} pass</span>
          {result.warnCount > 0 && <span className="text-[8px] font-mono text-warning">{result.warnCount} warn</span>}
          {result.failCount > 0 && <span className="text-[8px] font-mono text-danger">{result.failCount} fail</span>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface/40 p-2.5 space-y-1">
        {/* Overall badge */}
        <div className="flex items-center gap-2 pb-1.5 border-b border-border mb-1.5">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
            style={{ backgroundColor: overall.bg, color: overall.color }}
          >
            {overall.icon}
          </div>
          <span className="text-[10px] font-medium" style={{ color: overall.color }}>
            Scene Health: {OVERALL_LABELS[result.overallStatus]}
          </span>
        </div>

        {/* Checks */}
        <AnimatePresence>
          {result.checks.map((check, i) => {
            const cfg = STATUS_CONFIG[check.status];
            return (
              <motion.div
                key={check.id}
                initial={animating ? { opacity: 0, x: -8 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: animating ? i * 0.12 : 0 }}
                className="flex items-center gap-2 py-0.5"
              >
                <span
                  className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] shrink-0"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  {cfg.icon}
                </span>
                <span className="text-[9px] text-text-primary flex-1 truncate">{check.label}</span>
                <span className="text-[8px] font-mono text-text-muted shrink-0">{check.detail}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
