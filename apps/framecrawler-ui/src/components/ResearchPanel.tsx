import { AnimatePresence, motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';
import { TinyFishLiveView } from './TinyFishLiveView';
import { SourceCard } from './SourceCard';

export function ResearchPanel() {
  const tinyFishEvents = useFrameCrawlerStore((s) => s.tinyFishEvents);
  const tinyFishActive = useFrameCrawlerStore((s) => s.tinyFishActive);
  const tinyFishSessions = useFrameCrawlerStore((s) => s.tinyFishSessions);
  const scanProgress = useFrameCrawlerStore((s) => s.scanProgress);
  const researchSources = useFrameCrawlerStore((s) => s.researchSources);

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-3 rounded-full bg-cyan" />
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">TinyFish Research</span>
        {tinyFishActive && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-success ml-auto"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
        {researchSources.length > 0 && (
          <span className="text-[9px] font-mono text-cyan ml-auto">
            {researchSources.length} sources
          </span>
        )}
      </div>

      {/* Live browser screens */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <TinyFishLiveView
          sessions={tinyFishSessions}
          events={tinyFishEvents}
          progress={scanProgress}
          isActive={tinyFishActive}
        />
      </motion.div>

      {/* Source cards */}
      <AnimatePresence>
        {researchSources.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-1.5"
          >
            {researchSources.map((source, i) => (
              <SourceCard key={source.id} source={source} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
