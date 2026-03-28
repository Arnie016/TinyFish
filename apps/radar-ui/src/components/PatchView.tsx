import { motion } from 'framer-motion';
import type { PatchJob } from '../store/types';

export function PatchView({ patch }: { patch: PatchJob }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-lg ${patch.approved ? 'text-success' : 'text-warning'}`}>
            {patch.approved ? '✓' : '⚠'}
          </span>
          <h2 className="text-lg font-bold text-text-primary">
            {patch.approved ? 'Patch Applied' : 'Patch Available'}
          </h2>
        </div>
        <p className="text-xs text-text-secondary">
          <span className="font-mono text-text-primary">{patch.skill_id}</span>
          {' · '}
          <span className="font-mono text-text-muted">v{patch.previous_version}</span>
          {' → '}
          <span className="font-mono text-accent">v{patch.proposed_version}</span>
        </p>
      </div>

      {/* Status badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-xl border-2 p-4 ${
          patch.approved
            ? 'border-success bg-success-dim'
            : 'border-warning bg-warning-dim'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold ${
              patch.approved ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
            }`}
          >
            {patch.approved ? '✓' : '⟳'}
          </div>
          <div>
            <span className={`text-sm font-bold ${patch.approved ? 'text-success' : 'text-warning'}`}>
              {patch.approved ? 'Patch Approved & Applied' : 'Source Drift Detected'}
            </span>
            <p className="text-xs text-text-secondary mt-0.5">{patch.summary}</p>
          </div>
        </div>
      </motion.div>

      {/* Changed sources */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Changed Sources</h3>
        {patch.changed_sources.map((url) => (
          <div key={url} className="flex items-center gap-2 text-xs">
            <span className="text-warning">⚠</span>
            <span className="font-mono text-text-primary truncate">{url}</span>
          </div>
        ))}
      </div>

      {/* Diff */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2 bg-surface border-b border-border">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Diff</h3>
        </div>
        <div className="bg-bg p-3 font-mono text-xs space-y-0.5">
          {patch.diff_lines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`px-3 py-0.5 rounded ${
                line.type === 'added'
                  ? 'bg-success/10 text-success'
                  : line.type === 'removed'
                    ? 'bg-danger/10 text-danger'
                    : 'text-text-muted'
              }`}
            >
              <span className="select-none mr-2">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
              </span>
              {line.content}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold block mb-1">Change Type</span>
          <span className="text-sm font-bold text-text-primary capitalize">{patch.change_type}</span>
        </div>
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold block mb-1">Eval Required</span>
          <span className="text-sm font-bold text-text-primary">{patch.eval_required ? 'Yes' : 'No'}</span>
        </div>
      </div>
    </div>
  );
}
