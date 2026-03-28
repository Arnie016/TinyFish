import { motion } from 'framer-motion';
import type { WorkflowSpec } from '../store/types';

export function WorkflowSpecView({ spec }: { spec: WorkflowSpec }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-accent text-lg">◈</span>
          <h2 className="text-lg font-bold text-text-primary">Workflow Extracted</h2>
        </div>
        <p className="text-xs text-text-secondary">{spec.source_urls[0]}</p>
      </div>

      {/* Title + metadata */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-text-primary">{spec.title}</h3>
            <p className="text-xs text-text-secondary mt-1">{spec.description}</p>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-success-dim text-success text-xs font-bold shrink-0">
            {(spec.confidence * 100).toFixed(0)}%
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {spec.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-accent/10 text-accent">
              {tag}
            </span>
          ))}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-border text-text-muted">
            {spec.category}
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-1">
          Steps ({spec.steps.length})
        </h3>
        {spec.steps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-accent/15 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-border text-text-muted uppercase">
                    {step.action}
                  </span>
                </div>
                <p className="text-sm text-text-primary">{step.instruction}</p>
                <p className="text-xs text-text-muted mt-1">→ {step.expected_output}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Evidence */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-1">
          Evidence ({spec.evidence.length})
        </h3>
        {spec.evidence.map((ev, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-xs"
          >
            <p className="text-text-primary font-mono text-[11px]">"{ev.snippet}"</p>
            <p className="text-text-muted mt-1 truncate">{ev.url}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
