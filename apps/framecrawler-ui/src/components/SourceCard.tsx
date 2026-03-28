import { motion } from 'framer-motion';
import type { ResearchSource } from '../store/types';

interface SourceCardProps {
  source: ResearchSource;
  index: number;
}

export function SourceCard({ source, index }: SourceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25, delay: index * 0.08 }}
      className="rounded-md border border-border bg-surface/60 p-2 space-y-1.5"
    >
      <div className="flex items-start gap-2">
        {/* Thumbnail gradient */}
        <div
          className="w-8 h-8 rounded shrink-0"
          style={{
            background: `linear-gradient(135deg, ${source.thumbnail_gradient[0]}, ${source.thumbnail_gradient[1]})`,
          }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-text-primary leading-tight truncate">
              {source.title}
            </span>
            <span className="text-[8px] font-mono text-cyan shrink-0">
              {(source.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-[9px] text-text-muted truncate mt-0.5">
            {source.snippets[0]}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-0.5">
        {source.tags.map((tag) => (
          <span
            key={tag}
            className="text-[8px] font-mono px-1 py-0 rounded bg-accent/8 text-accent/70 border border-accent/10"
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
