import { motion, AnimatePresence } from 'framer-motion';
import { useRadarStore } from '../store/radar-store';
import type { SkillRecord } from '../store/types';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-success-dim', text: 'text-success', dot: 'bg-success' },
  draft: { bg: 'bg-warning-dim', text: 'text-warning', dot: 'bg-warning' },
  deprecated: { bg: 'bg-danger-dim', text: 'text-danger', dot: 'bg-danger' },
};

function SkillRow({ skill, isSelected }: { skill: SkillRecord; isSelected: boolean }) {
  const selectSkill = useRadarStore((s) => s.selectSkill);
  const colors = STATUS_COLORS[skill.status] || STATUS_COLORS.active;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileHover={{ x: 4 }}
      onClick={() => selectSkill(skill.skill_id)}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors cursor-pointer ${
        isSelected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface hover:border-border-bright hover:bg-surface-hover'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-text-primary truncate">{skill.name}</span>
              <span className="text-[10px] font-mono text-text-muted">v{skill.version}</span>
            </div>
            <span className="text-xs text-text-secondary truncate mt-0.5">{skill.description}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <div className="flex gap-1">
            {skill.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-accent/10 text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
            {skill.status}
          </div>
        </div>
      </div>
      {skill.forked_from && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-text-muted">
          <span>⑂</span>
          <span>forked from {skill.forked_from}</span>
        </div>
      )}
    </motion.button>
  );
}

export function SkillRegistry() {
  const skills = useRadarStore((s) => s.skills);
  const detailView = useRadarStore((s) => s.detailView);
  const selectedId = detailView.kind === 'skill' ? detailView.skill_id : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Skill Registry</h2>
        <span className="text-xs text-text-muted font-mono">{skills.length} skills</span>
      </div>
      <AnimatePresence mode="popLayout">
        {skills.map((skill) => (
          <SkillRow key={skill.skill_id} skill={skill} isSelected={skill.skill_id === selectedId} />
        ))}
      </AnimatePresence>
    </div>
  );
}
