import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

const CATEGORY_BORDER: Record<string, string> = {
  research: '#06B6D4',
  plan: '#7C3AED',
  build: '#10B981',
  lighting: '#F59E0B',
  general: '#6B7280',
};

export function ContextualTip() {
  const activeTip = useFrameCrawlerStore((s) => s.activeTip);
  const dismissTip = useFrameCrawlerStore((s) => s.dismissTip);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeTip) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => dismissTip(activeTip.id), 8000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeTip, dismissTip]);

  if (!activeTip) return null;

  const borderColor = CATEGORY_BORDER[activeTip.category] || '#6B7280';

  return (
    <motion.div
      key={activeTip.id}
      initial={{ opacity: 0, y: -6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -6, height: 0 }}
      className="rounded-md px-2.5 py-1.5 flex items-center gap-2 border bg-surface/60"
      style={{ borderColor: `${borderColor}40` }}
    >
      <span className="text-[10px] shrink-0">{activeTip.icon}</span>
      <span className="text-[9px] text-text-secondary flex-1 leading-snug">{activeTip.message}</span>
      <button
        onClick={() => dismissTip(activeTip.id)}
        className="text-[10px] text-text-muted hover:text-text-primary shrink-0 cursor-pointer leading-none"
      >
        &times;
      </button>
    </motion.div>
  );
}
