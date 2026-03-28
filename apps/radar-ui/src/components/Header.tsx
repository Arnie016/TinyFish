import { motion } from 'framer-motion';
import { useRadarStore } from '../store/radar-store';

export function Header() {
  const demoPhase = useRadarStore((s) => s.demoPhase);
  const isLive = demoPhase > 0;

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface/50 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-purple-400 flex items-center justify-center"
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.4 }}
          >
            <span className="text-white text-sm font-bold">◈</span>
          </motion.div>
          <span className="text-lg font-bold tracking-tight text-text-primary">Radar</span>
        </div>
        <div className="h-5 w-px bg-border mx-1" />
        <span className="text-xs text-text-muted">Workflow Compiler</span>
      </div>

      <div className="flex items-center gap-3">
        {isLive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20"
          >
            <motion.div
              className="w-2 h-2 rounded-full bg-success"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-xs font-medium text-success">Live</span>
          </motion.div>
        )}
        <div className="text-[10px] text-text-muted font-mono">
          Keys: 1-7 demo · 0 reset · A auto
        </div>
      </div>
    </header>
  );
}
