import { motion, AnimatePresence } from 'framer-motion';
import { useRadarStore } from '../store/radar-store';

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  glowColor: string;
}

function StatCard({ label, value, icon, color, glowColor }: StatCardProps) {
  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-2xl border border-border bg-surface px-5 py-4"
      whileHover={{ scale: 1.02, borderColor: color }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{ background: `radial-gradient(circle at 50% 50%, ${glowColor}, transparent 70%)` }}
      />
      <div className="relative flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={value}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-3xl font-bold tracking-tight"
              style={{ color }}
            >
              {value}
            </motion.div>
          </AnimatePresence>
          <div className="text-xs font-medium tracking-wide text-text-secondary uppercase">{label}</div>
        </div>
      </div>
    </motion.div>
  );
}

export function StatsBar() {
  const skills = useRadarStore((s) => s.skills);
  const patchedToday = useRadarStore((s) => s.patchedToday);
  const totalRuns = useRadarStore((s) => s.totalRuns);

  const active = skills.filter((s) => s.status === 'active').length;

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="Total Skills" value={skills.length} icon="◈" color="#7C3AED" glowColor="rgba(124,58,237,0.12)" />
      <StatCard label="Active" value={active} icon="⚡" color="#10B981" glowColor="rgba(16,185,129,0.12)" />
      <StatCard label="Total Runs" value={totalRuns} icon="▶" color="#3B82F6" glowColor="rgba(59,130,246,0.12)" />
      <StatCard label="Patched Today" value={patchedToday} icon="⟳" color="#F59E0B" glowColor="rgba(245,158,11,0.12)" />
    </div>
  );
}
