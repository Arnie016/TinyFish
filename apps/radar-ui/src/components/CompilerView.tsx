import { motion } from 'framer-motion';
import type { WorkflowSpec, CompilerDecision } from '../store/types';

const DECISION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  reuse: { label: 'REUSE', color: '#10B981', bg: 'rgba(16,185,129,0.15)', icon: '↩' },
  fork: { label: 'FORK', color: '#7C3AED', bg: 'rgba(124,58,237,0.15)', icon: '⑂' },
  compose: { label: 'COMPOSE', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: '⊕' },
  create: { label: 'CREATE', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', icon: '✦' },
};

interface CompilerViewProps {
  spec: WorkflowSpec;
  decision: CompilerDecision | null;
  compiling: boolean;
}

export function CompilerView({ spec, decision, compiling }: CompilerViewProps) {
  const decConfig = decision ? DECISION_CONFIG[decision.decision] : null;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-accent text-lg">⚙</span>
          <h2 className="text-lg font-bold text-text-primary">Skill Compiler</h2>
        </div>
        <p className="text-xs text-text-secondary">Analyzing workflow and searching existing skills</p>
      </div>

      {/* Workflow summary */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">Input Workflow</span>
        </div>
        <h3 className="font-semibold text-sm text-text-primary">{spec.title}</h3>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {spec.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-accent/10 text-accent">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Similar skills */}
      {decision && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-1">
            Similar Skills
          </h3>
          {decision.nearest_skills.map((ns, i) => (
            <motion.div
              key={ns.skill_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5"
            >
              <span className="text-sm text-text-primary font-medium">{ns.skill_id}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: ns.score >= 0.7 ? '#7C3AED' : ns.score >= 0.5 ? '#3B82F6' : '#4B5563',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${ns.score * 100}%` }}
                    transition={{ delay: i * 0.1 + 0.3, duration: 0.5 }}
                  />
                </div>
                <span
                  className="text-xs font-mono font-bold w-10 text-right"
                  style={{
                    color: ns.score >= 0.7 ? '#7C3AED' : ns.score >= 0.5 ? '#3B82F6' : '#4B5563',
                  }}
                >
                  {(ns.score * 100).toFixed(0)}%
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Decision badge */}
      {decision && decConfig && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border-2 p-4"
          style={{ borderColor: decConfig.color, backgroundColor: decConfig.bg }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold"
              style={{ backgroundColor: `${decConfig.color}30`, color: decConfig.color }}
            >
              {decConfig.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: decConfig.color }}>
                  {decConfig.label}
                </span>
                {decision.forked_from && (
                  <span className="text-xs text-text-secondary">
                    from <span className="font-mono text-text-primary">{decision.forked_from}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{decision.reason}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Compiling state */}
      {compiling && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-accent/30 bg-accent/5 p-4"
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <div>
              <span className="text-sm font-medium text-accent">Compiling skill...</span>
              <p className="text-xs text-text-secondary mt-0.5">Generating SKILL.md, agent config, and eval prompts</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
