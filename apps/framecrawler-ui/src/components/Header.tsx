import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

export function Header() {
  const demoPhase = useFrameCrawlerStore((s) => s.demoPhase);
  const isLive = demoPhase > 0;

  return (
    <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface/50 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <motion.div
          className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan to-accent flex items-center justify-center"
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.4 }}
        >
          <span className="text-white text-[9px] font-bold">&lt;/&gt;</span>
        </motion.div>
        <div>
          <div className="text-xs font-bold tracking-tight text-text-primary leading-none">FrameCrawler</div>
          <div className="text-[8px] text-text-muted leading-none mt-0.5">Web-to-Previs Copilot</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isLive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/20"
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-success"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-[9px] font-medium text-success">Live</span>
          </motion.div>
        )}
      </div>
    </header>
  );
}
