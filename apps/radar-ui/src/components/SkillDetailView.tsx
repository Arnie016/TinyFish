import { useRadarStore } from '../store/radar-store';
import { ExecutionPanel } from './ExecutionPanel';
import { SOURCE_ORIGIN_CONFIG } from '../store/mock-data';

function formatDate(iso: string | null) {
  if (!iso) return '\u2014';
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

  const originCfg = SOURCE_ORIGIN_CONFIG[skill.source_origin] || SOURCE_ORIGIN_CONFIG.manual;

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
              style={{ backgroundColor: `${statusColors[skill.status]}20`, color: statusColors[skill.status] }}
            >
              {skill.status}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-accent/10 text-accent font-bold">
              v{skill.version}
            </span>
          </div>
        </div>

        {/* Source origin + tags */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: `${originCfg.color}20`, color: originCfg.color }}
          >
            <span>{originCfg.icon}</span>
            {originCfg.label}
          </span>
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
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span>\u2442</span>
            <span>Forked from <span className="font-mono text-accent">{skill.forked_from}</span></span>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Usage Count" value={String(skill.usage_count)} icon="\u25B6" />
        <MetricCard label="Eval Score" value={skill.eval_score ? `${(skill.eval_score * 100).toFixed(0)}%` : '\u2014'} icon="\u2713" />
        <MetricCard label="Last Used" value={formatDate(skill.last_used_at)} icon="\u25F7" />
        <MetricCard label="Last Patched" value={formatDate(skill.last_patched_at)} icon="\u27F3" />
      </div>

      {/* API Endpoints */}
      {skill.api_endpoints && skill.api_endpoints.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">API Endpoints</h3>
          <div className="space-y-1">
            {skill.api_endpoints.map((ep) => (
              <div key={ep} className="font-mono text-xs text-accent px-2 py-1 rounded bg-bg">
                {ep}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context snippets */}
      {skill.context_snippets && skill.context_snippets.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Context</h3>
          <div className="space-y-1">
            {skill.context_snippets.map((snip, i) => (
              <div key={i} className="font-mono text-[11px] text-text-secondary px-2 py-1 rounded bg-bg">
                {snip}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Sources</h3>
        {skill.source_urls.map((url) => (
          <div key={url} className="flex items-center gap-2 text-xs">
            <span className="text-accent">\u2192</span>
            <span className="font-mono text-text-primary truncate">{url}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-text-muted">
          <span>Scanned: {formatDate(skill.last_scanned_at)}</span>
          <span>\u00B7</span>
          <span>Hash: {skill.source_hashes[0]}</span>
          {skill.extraction_meta?.tinyfish_run_id && (
            <>
              <span>\u00B7</span>
              <span className="text-accent">TF: {skill.extraction_meta.tinyfish_run_id}</span>
            </>
          )}
        </div>
      </div>

      {/* Execution targets */}
      <ExecutionPanel skillId={skillId} />
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
