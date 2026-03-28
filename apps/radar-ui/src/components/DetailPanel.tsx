import { motion, AnimatePresence } from 'framer-motion';
import { useRadarStore } from '../store/radar-store';
import { ScanningView } from './ScanningView';
import { WorkflowSpecView } from './WorkflowSpecView';
import { CompilerView } from './CompilerView';
import { SkillDetailView } from './SkillDetailView';
import { RunResultView } from './RunResultView';
import { PatchView } from './PatchView';

export function DetailPanel() {
  const view = useRadarStore((s) => s.detailView);

  return (
    <div className="h-full overflow-y-auto pr-1">
      <AnimatePresence mode="wait">
        {view.kind === 'none' && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center h-full"
          >
            <div className="text-center">
              <div className="text-4xl mb-3 opacity-20">◈</div>
              <p className="text-sm text-text-muted">Select a skill or trigger a demo action</p>
              <p className="text-xs text-text-muted mt-1">
                Press <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono">1</kbd>–
                <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono">7</kbd> to step through the demo
              </p>
            </div>
          </motion.div>
        )}

        {view.kind === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ScanningView url={view.url} progress={view.progress} status={view.status} />
          </motion.div>
        )}

        {view.kind === 'workflow_spec' && (
          <motion.div
            key="spec"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <WorkflowSpecView spec={view.spec} />
          </motion.div>
        )}

        {view.kind === 'compiler' && (
          <motion.div
            key="compiler"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <CompilerView spec={view.spec} decision={view.decision} compiling={view.compiling} />
          </motion.div>
        )}

        {view.kind === 'skill' && (
          <motion.div
            key={`skill-${view.skill_id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <SkillDetailView skillId={view.skill_id} />
          </motion.div>
        )}

        {view.kind === 'run_result' && (
          <motion.div
            key="run"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <RunResultView result={view.result} />
          </motion.div>
        )}

        {view.kind === 'patch' && (
          <motion.div
            key="patch"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <PatchView patch={view.patch} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
