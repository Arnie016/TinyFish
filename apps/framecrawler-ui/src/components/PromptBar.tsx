import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

export function PromptBar() {
  const promptText = useFrameCrawlerStore((s) => s.promptText);
  const isTyping = useFrameCrawlerStore((s) => s.isTyping);
  const demoPhase = useFrameCrawlerStore((s) => s.demoPhase);

  if (demoPhase === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-surface/60 px-3 py-2"
    >
      <div className="text-[8px] text-text-muted uppercase tracking-wider mb-1">Scene prompt</div>
      <div className="font-mono text-[11px] text-text-primary flex items-center">
        <span>{promptText}</span>
        {isTyping && (
          <motion.span
            className="inline-block w-0.5 h-3.5 bg-cyan ml-0.5"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}
        {!isTyping && promptText && (
          <span className="text-[8px] font-mono text-success ml-auto shrink-0 px-1.5 py-0.5 rounded bg-success/10 border border-success/20">OK</span>
        )}
      </div>
    </motion.div>
  );
}
