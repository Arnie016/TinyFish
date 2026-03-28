import { useRadarStore } from '../store/radar-store';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SkillDetailView({ skillId }: { skillId: string }) {
  const skill = useRadarStore((s) => s.skills.find((sk) => sk.skill_id === skillId));
  if (!skill) return <div className="text-text-muted text-sm p-4">Skill not found</div>;

  const statusColors: Record<string, string> = {
    active: '#10B981',
    draft: '#F59E0B',
    deprecated: '#EF4444',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{skill.name}</h2>
            <p className="text-xs text-text-secondary mt-1">{skill.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{
                backgroundColor: `${statusColors[skill.status]}20`,
                color: statusColors[skill.status],
              }}
            >
              {skill.status}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-accent/10 text-accent font-bold">
              v{skill.version}
            </span>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {skill.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-accent/10 text-accent">
              {tag}
            </span>
          ))}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-border text-text-muted">
            {skill.category}
          </span>
        </div>

        {skill.forked_from && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
            <span>⑂</span>
            <span>
              Forked from <span className="font-mono text-accent">{skill.forked_from}</span>
            </span>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Usage Count" value={String(skill.usage_count)} icon="▶" />
        <MetricCard label="Eval Score" value={skill.eval_score ? `${(skill.eval_score * 100).toFixed(0)}%` : '—'} icon="✓" />
        <MetricCard label="Last Used" value={formatDate(skill.last_used_at)} icon="◷" />
        <MetricCard label="Last Patched" value={formatDate(skill.last_patched_at)} icon="⟳" />
      </div>

      {/* Sources */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Sources</h3>
        {skill.source_urls.map((url) => (
          <div key={url} className="flex items-center gap-2 text-xs">
            <span className="text-accent">→</span>
            <span className="font-mono text-text-primary truncate">{url}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-text-muted">
          <span>Last scanned: {formatDate(skill.last_scanned_at)}</span>
          <span>·</span>
          <span>Hash: {skill.source_hashes[0]}</span>
        </div>
      </div>

      {/* Surface */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Surface</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-accent/10 text-accent border border-accent/20">
            {skill.surface_type}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm text-text-muted">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">{label}</span>
      </div>
      <span className="text-lg font-bold text-text-primary">{value}</span>
    </div>
  );
}
