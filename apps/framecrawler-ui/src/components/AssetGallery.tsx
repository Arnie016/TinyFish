import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';
import { ARTIFACT_CATEGORY_COLORS } from '../store/mock-data';
import type { SceneObject, ObjectCategory } from '../store/types';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  scan: 'Scanned',
  'ai-gen': 'AI Generated',
  manual: 'Manual',
  'web-ref': 'Web Reference',
};

const LICENSE_COLORS: Record<string, { bg: string; text: string }> = {
  'CC0': { bg: 'bg-success/15', text: 'text-success' },
  'CC-BY': { bg: 'bg-cyan/15', text: 'text-cyan' },
  commercial: { bg: 'bg-warning/15', text: 'text-warning' },
  unknown: { bg: 'bg-danger/15', text: 'text-danger' },
};

const CATEGORY_ICONS: Record<ObjectCategory, string> = {
  setpiece: '\u25A3',
  prop: '\u2726',
  vehicle: '\u25B7',
  character: '\u263A',
  fx: '\u2248',
  ui: '\u25A8',
};

const CATEGORY_TO_ARTIFACT: Record<ObjectCategory, string> = {
  setpiece: 'architecture',
  prop: 'props',
  vehicle: 'vehicles',
  character: 'props',
  fx: 'environment',
  ui: 'props',
};

type SortKey = 'name' | 'importance' | 'confidence' | 'polyCount';
type ViewMode = 'grid' | 'list';

function ConfidenceRing({ value, size = 28 }: { value: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * value;
  const color = value >= 0.9 ? '#10B981' : value >= 0.8 ? '#06B6D4' : value >= 0.7 ? '#F59E0B' : '#EF4444';

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1e30" strokeWidth="2" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        opacity="0.9"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="8"
        fontFamily="var(--font-mono)"
      >
        {(value * 100).toFixed(0)}
      </text>
    </svg>
  );
}

function PolyBudgetBar({ count, max = 20000 }: { count: number; max?: number }) {
  const pct = Math.min(count / max, 1);
  const color = pct > 0.8 ? '#EF4444' : pct > 0.5 ? '#F59E0B' : '#10B981';

  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-[7px] font-mono text-text-muted whitespace-nowrap">{(count / 1000).toFixed(1)}k</span>
    </div>
  );
}

function AssetCard({ obj, index, viewMode }: { obj: SceneObject; index: number; viewMode: ViewMode }) {
  const [hovered, setHovered] = useState(false);
  const catColor = ARTIFACT_CATEGORY_COLORS[CATEGORY_TO_ARTIFACT[obj.category]] || '#6B7280';
  const licenseStyle = obj.provenance ? LICENSE_COLORS[obj.provenance.license] || LICENSE_COLORS.unknown : null;

  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03, type: 'spring', stiffness: 400, damping: 25 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md border transition-all ${
          hovered ? 'border-border-bright bg-surface-hover' : 'border-border bg-surface/50'
        }`}
      >
        {/* Color swatch */}
        <div
          className="w-6 h-6 rounded shrink-0 border border-white/5"
          style={{ backgroundColor: obj.color }}
        />

        {/* Name + category */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-text-primary truncate">{obj.name}</span>
            <span
              className="text-[7px] font-mono px-1 py-0 rounded capitalize shrink-0"
              style={{ backgroundColor: `${catColor}15`, color: catColor }}
            >
              {obj.category}
            </span>
          </div>
          <div className="text-[8px] text-text-muted truncate">{obj.material}</div>
        </div>

        {/* Confidence */}
        <ConfidenceRing value={obj.confidence} size={24} />

        {/* Polys */}
        {obj.performance && (
          <div className="w-16 shrink-0">
            <PolyBudgetBar count={obj.performance.polyCount} />
          </div>
        )}

        {/* License badge */}
        {obj.provenance && licenseStyle && (
          <span className={`text-[7px] font-mono px-1 py-0 rounded shrink-0 ${licenseStyle.bg} ${licenseStyle.text}`}>
            {obj.provenance.license}
          </span>
        )}
      </motion.div>
    );
  }

  // Grid card
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`rounded-lg border overflow-hidden transition-all ${
        hovered ? 'border-border-bright bg-surface-hover shadow-lg shadow-black/20' : 'border-border bg-surface/60'
      }`}
    >
      {/* Color preview header */}
      <div
        className="relative h-16 flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${obj.color}, ${catColor}40)`,
        }}
      >
        {/* Geometry icon */}
        <span className="text-2xl opacity-30 select-none">{CATEGORY_ICONS[obj.category]}</span>

        {/* Importance stars */}
        <div className="absolute top-1 right-1 flex gap-px">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`w-1 h-1 rounded-full ${i < obj.importance ? 'bg-white/60' : 'bg-white/15'}`}
            />
          ))}
        </div>

        {/* Category pill */}
        <span
          className="absolute bottom-1 left-1.5 text-[7px] font-mono px-1.5 py-0.5 rounded-full capitalize backdrop-blur-sm"
          style={{ backgroundColor: `${catColor}30`, color: catColor, border: `1px solid ${catColor}25` }}
        >
          {obj.category}
        </span>
      </div>

      {/* Body */}
      <div className="p-2 space-y-1.5">
        {/* Title */}
        <div className="flex items-start gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-medium text-text-primary leading-tight truncate">{obj.name}</div>
            <div className="text-[8px] text-text-muted truncate mt-0.5">{obj.material}</div>
          </div>
          <ConfidenceRing value={obj.confidence} />
        </div>

        {/* Description */}
        <div className="text-[8px] text-text-secondary leading-relaxed line-clamp-2">{obj.description}</div>

        {/* Stats row */}
        <div className="flex items-center gap-2 pt-0.5">
          {/* Size */}
          <span className="text-[7px] font-mono text-text-muted">{obj.approx_size}</span>
          <div className="flex-1" />
          {/* LOD badge */}
          {obj.performance?.suggestLOD && (
            <span className="text-[6px] font-mono px-1 py-0 rounded bg-warning/15 text-warning">LOD</span>
          )}
        </div>

        {/* Performance bar */}
        {obj.performance && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[7px] text-text-muted">Polys</span>
              <span className="text-[7px] text-text-muted">VRAM {obj.performance.textureMemoryMB.toFixed(1)} MB</span>
            </div>
            <PolyBudgetBar count={obj.performance.polyCount} />
          </div>
        )}

        {/* Provenance footer */}
        {obj.provenance && (
          <div className="flex items-center gap-1 pt-1 border-t border-border/50">
            <span className="text-[7px] font-mono text-text-muted">
              {SOURCE_TYPE_LABELS[obj.provenance.sourceType] || obj.provenance.sourceType}
            </span>
            <div className="flex-1" />
            {licenseStyle && (
              <span className={`text-[7px] font-mono px-1 py-0 rounded ${licenseStyle.bg} ${licenseStyle.text}`}>
                {obj.provenance.license}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function AssetGallery() {
  const sceneMetadata = useFrameCrawlerStore((s) => s.sceneMetadata);
  const [filterCategory, setFilterCategory] = useState<ObjectCategory | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('importance');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expanded, setExpanded] = useState(true);

  if (!sceneMetadata) return null;

  const objects = sceneMetadata.objects;

  // Filter
  const filtered = filterCategory ? objects.filter((o) => o.category === filterCategory) : objects;

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'importance':
        return b.importance - a.importance;
      case 'confidence':
        return b.confidence - a.confidence;
      case 'polyCount':
        return (b.performance?.polyCount ?? 0) - (a.performance?.polyCount ?? 0);
      default:
        return 0;
    }
  });

  const categories = [...new Set(objects.map((o) => o.category))];

  // Summary stats
  const totalPolys = objects.reduce((s, o) => s + (o.performance?.polyCount ?? 0), 0);
  const totalVRAM = objects.reduce((s, o) => s + (o.performance?.textureMemoryMB ?? 0), 0);
  const avgConf = objects.reduce((s, o) => s + o.confidence, 0) / objects.length;
  const licenseIssues = objects.filter((o) => o.provenance?.license === 'unknown').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-3 rounded-full bg-cyan" />
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
          Asset Gallery
        </span>
        <span className="text-[9px] font-mono text-text-muted ml-auto">
          {objects.length} assets
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[9px] text-text-muted hover:text-text-primary cursor-pointer"
        >
          {expanded ? '\u25B4' : '\u25BE'}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-2"
          >
            {/* Summary strip */}
            <div className="flex items-center gap-3 px-2 py-1.5 rounded-md border border-border bg-surface/40">
              <div className="flex items-center gap-1">
                <span className="text-[7px] text-text-muted uppercase">Polys</span>
                <span className="text-[9px] font-mono text-text-primary">{(totalPolys / 1000).toFixed(1)}k</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1">
                <span className="text-[7px] text-text-muted uppercase">VRAM</span>
                <span className="text-[9px] font-mono text-text-primary">{totalVRAM.toFixed(1)} MB</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1">
                <span className="text-[7px] text-text-muted uppercase">Avg Conf</span>
                <span className="text-[9px] font-mono text-cyan">{(avgConf * 100).toFixed(0)}%</span>
              </div>
              {licenseIssues > 0 && (
                <>
                  <div className="w-px h-3 bg-border" />
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] text-text-muted uppercase">License Issues</span>
                    <span className="text-[9px] font-mono text-warning">{licenseIssues}</span>
                  </div>
                </>
              )}
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category filters */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setFilterCategory(null)}
                  className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    filterCategory === null
                      ? 'bg-accent/20 text-accent border-accent/30'
                      : 'bg-transparent text-text-muted border-border hover:border-border-bright'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => {
                  const catColor = ARTIFACT_CATEGORY_COLORS[CATEGORY_TO_ARTIFACT[cat]] || '#6B7280';
                  return (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                      className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border cursor-pointer transition-colors capitalize ${
                        filterCategory === cat
                          ? 'border-accent/30 bg-accent/20 text-accent'
                          : 'bg-transparent text-text-muted border-border hover:border-border-bright'
                      }`}
                      style={filterCategory === cat ? {} : { borderColor: `${catColor}20` }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1" />

              {/* Sort select */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="text-[8px] font-mono bg-surface border border-border rounded px-1.5 py-0.5 text-text-muted cursor-pointer focus:outline-none focus:border-border-bright"
              >
                <option value="importance">Importance</option>
                <option value="name">Name</option>
                <option value="confidence">Confidence</option>
                <option value="polyCount">Poly Count</option>
              </select>

              {/* View toggle */}
              <div className="flex rounded border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`text-[8px] px-1.5 py-0.5 cursor-pointer transition-colors ${
                    viewMode === 'grid' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {'\u25A6'}
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`text-[8px] px-1.5 py-0.5 cursor-pointer transition-colors ${
                    viewMode === 'list' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {'\u2630'}
                </button>
              </div>
            </div>

            {/* Asset cards */}
            <AnimatePresence mode="wait">
              {viewMode === 'grid' ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 gap-2"
                >
                  {sorted.map((obj, i) => (
                    <AssetCard key={obj.id} obj={obj} index={i} viewMode="grid" />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1"
                >
                  {sorted.map((obj, i) => (
                    <AssetCard key={obj.id} obj={obj} index={i} viewMode="list" />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {sorted.length === 0 && (
              <div className="text-[9px] text-text-muted text-center py-4">
                No assets match the current filter.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
