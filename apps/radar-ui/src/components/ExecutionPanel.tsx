import { motion } from 'framer-motion';
import { useRadarStore } from '../store/radar-store';
import { EXECUTION_TARGETS } from '../store/mock-data';

export function ExecutionPanel({ skillId }: { skillId: string }) {
  const skill = useRadarStore((s) => s.skills.find((sk) => sk.skill_id === skillId));
  if (!skill) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Run Skill</h3>
        <p className="text-xs text-text-secondary">
          Execute <span className="font-mono text-accent">{skill.name}</span> in your target environment
        </p>
      </div>

      <div className="space-y-2">
        {EXECUTION_TARGETS.map((target, i) => (
          <motion.button
            key={target.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            disabled={!target.available}
            className={`
              w-full text-left rounded-xl border px-4 py-3 transition-all
              ${target.available
                ? 'border-border bg-surface hover:border-accent hover:bg-accent/5 cursor-pointer'
                : 'border-border/50 bg-surface/50 opacity-40 cursor-not-allowed'
              }
            `}
            whileHover={target.available ? { scale: 1.01 } : {}}
            whileTap={target.available ? { scale: 0.99 } : {}}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-lg text-accent">
                {target.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{target.name}</span>
                  {target.available ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success-dim text-success font-medium">
                      ready
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-border text-text-muted font-medium">
                      soon
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-secondary truncate">{target.description}</p>
              </div>
              {target.available && (
                <span className="text-text-muted text-sm">→</span>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Skill artifacts */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Skill Artifacts</h4>
        <div className="space-y-1.5">
          <ArtifactRow name="SKILL.md" desc="Instructions, inputs, outputs, steps" icon="📄" />
          <ArtifactRow name="agents/openai.yaml" desc="Agent config, policy, MCP binding" icon="⚙" />
          <ArtifactRow name="evals/" desc="3 test prompts (trigger, edge, negative)" icon="✓" />
          {skill.api_endpoints && skill.api_endpoints.length > 0 && (
            <ArtifactRow
              name="API Endpoints"
              desc={skill.api_endpoints.join(', ')}
              icon="⟷"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ArtifactRow({ name, desc, icon }: { name: string; desc: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-5 text-center text-text-muted">{icon}</span>
      <span className="font-mono text-accent">{name}</span>
      <span className="text-text-muted truncate">— {desc}</span>
    </div>
  );
}
