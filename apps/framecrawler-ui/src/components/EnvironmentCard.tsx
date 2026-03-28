import { motion } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

export function EnvironmentCard() {
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);

  if (!sceneMetadata) return null;

  const env = sceneMetadata.environment;

  const fields = [
    { label: 'Location', value: env.location_type },
    { label: 'Time', value: env.time_of_day },
    { label: 'Weather', value: env.weather },
    { label: 'Mood', value: env.mood },
    { label: 'Scale', value: env.scale },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-surface/50 p-3 space-y-2"
    >
      <div className="text-[10px] font-semibold text-text-primary uppercase tracking-wider">
        Environment
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {fields.map((field) => (
          <div key={field.label}>
            <div className="text-[9px] text-text-muted uppercase">{field.label}</div>
            <div className="text-[10px] text-text-secondary">{field.value}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
