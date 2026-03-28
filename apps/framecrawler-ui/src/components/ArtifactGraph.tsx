import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFrameCrawlerStore } from '../store/framecrawler-store';
import { ARTIFACT_CATEGORY_COLORS } from '../store/mock-data';
import type { Artifact } from '../store/types';

const GRAPH_H = 380;

function ArtifactNode({ artifact, selected, onDragStart }: {
  artifact: Artifact;
  selected: boolean;
  onDragStart: (e: React.DragEvent, artifact: Artifact) => void;
}) {
  const catColor = ARTIFACT_CATEGORY_COLORS[artifact.category] || '#6B7280';

  return (
    <motion.div
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, artifact)}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: selected ? 0.4 : 1 }}
      whileHover={{ scale: 1.2, zIndex: 10 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className="absolute cursor-grab active:cursor-grabbing select-none"
      style={{
        left: `${artifact.gx * 100}%`,
        top: `${artifact.gy * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
      title={`${artifact.name} (${artifact.category})`}
    >
      <div
        className={`flex items-center gap-1 px-1.5 py-1 rounded-md border backdrop-blur-sm transition-colors ${
          selected
            ? 'border-success/40 bg-success/10'
            : 'border-border bg-surface/80 hover:border-border-bright'
        }`}
        style={{ borderColor: selected ? undefined : `${catColor}30` }}
      >
        <span
          className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] shrink-0"
          style={{ backgroundColor: `${catColor}25`, color: catColor }}
        >
          {artifact.icon}
        </span>
        <span className="text-[8px] font-medium text-text-primary whitespace-nowrap">
          {artifact.name}
        </span>
        {artifact.provenance && (
          <span
            className={`text-[6px] font-mono px-0.5 rounded ${
              artifact.provenance.license === 'unknown'
                ? 'bg-warning/15 text-warning'
                : 'bg-text-muted/10 text-text-muted'
            }`}
          >
            {artifact.provenance.sourceType}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function ArtifactGraph() {
  const artifacts = useFrameCrawlerStore((s) => s.artifacts);
  const selectedIds = useFrameCrawlerStore((s) => s.selectedArtifactIds);
  const addArtifact = useFrameCrawlerStore((s) => s.addArtifact);
  const removeArtifact = useFrameCrawlerStore((s) => s.removeArtifact);
  const graphRef = useRef<HTMLDivElement>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handleDragStart = useCallback((e: React.DragEvent, artifact: Artifact) => {
    e.dataTransfer.setData('artifact-id', artifact.id);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleDropOnZone = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('artifact-id');
    if (id) addArtifact(id);
  }, [addArtifact]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const filtered = filterCategory
    ? artifacts.filter((a) => a.category === filterCategory)
    : artifacts;

  const selectedArtifacts = artifacts.filter((a) => selectedIds.includes(a.id));

  // Build edge list for SVG lines
  const edges: [Artifact, Artifact][] = [];
  const idSet = new Set(filtered.map((a) => a.id));
  for (const a of filtered) {
    for (const rid of a.relatedIds) {
      if (idSet.has(rid) && a.id < rid) {
        const b = filtered.find((x) => x.id === rid);
        if (b) edges.push([a, b]);
      }
    }
  }

  const categories = [...new Set(artifacts.map((a) => a.category))];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-1 h-3 rounded-full bg-magenta" />
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Artifact Bank</span>
        <span className="text-[9px] font-mono text-text-muted ml-auto">{artifacts.length} items</span>
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
            {/* Category filters */}
            <div className="flex flex-wrap gap-1 px-1">
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
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                  className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border cursor-pointer transition-colors capitalize ${
                    filterCategory === cat
                      ? 'border-accent/30 bg-accent/20 text-accent'
                      : 'bg-transparent text-text-muted border-border hover:border-border-bright'
                  }`}
                  style={filterCategory === cat ? {} : { borderColor: `${ARTIFACT_CATEGORY_COLORS[cat]}20` }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Graph view */}
            <div
              ref={graphRef}
              className="relative rounded-lg border border-border bg-bg/80 overflow-hidden"
              style={{ height: GRAPH_H }}
            >
              {/* SVG connection lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                {edges.map(([a, b], i) => (
                  <line
                    key={i}
                    x1={`${a.gx * 100}%`}
                    y1={`${a.gy * 100}%`}
                    x2={`${b.gx * 100}%`}
                    y2={`${b.gy * 100}%`}
                    stroke="#2a2a40"
                    strokeWidth="1"
                    opacity="0.5"
                  />
                ))}
              </svg>

              {/* Artifact nodes */}
              {filtered.map((artifact) => (
                <ArtifactNode
                  key={artifact.id}
                  artifact={artifact}
                  selected={selectedIds.includes(artifact.id)}
                  onDragStart={handleDragStart}
                />
              ))}

              {/* Hint */}
              <div className="absolute bottom-1.5 left-1.5 text-[7px] text-text-muted/40 pointer-events-none">
                Drag artifacts to the drop zone below
              </div>
            </div>

            {/* Drop zone / selected artifacts */}
            <div
              onDrop={handleDropOnZone}
              onDragOver={handleDragOver}
              className={`rounded-lg border-2 border-dashed p-2.5 min-h-[48px] transition-colors ${
                selectedArtifacts.length > 0
                  ? 'border-accent/30 bg-accent/5'
                  : 'border-border bg-surface/30'
              }`}
            >
              {selectedArtifacts.length === 0 ? (
                <div className="text-[9px] text-text-muted text-center py-1">
                  Drop artifacts here to add to scene
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-[8px] text-text-muted uppercase tracking-wider mb-1">
                    Scene artifacts ({selectedArtifacts.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <AnimatePresence>
                      {selectedArtifacts.map((artifact) => {
                        const catColor = ARTIFACT_CATEGORY_COLORS[artifact.category] || '#6B7280';
                        return (
                          <motion.div
                            key={artifact.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-md border bg-surface/80"
                            style={{ borderColor: `${catColor}30` }}
                          >
                            <span
                              className="w-3 h-3 rounded flex items-center justify-center text-[7px]"
                              style={{ backgroundColor: `${catColor}20`, color: catColor }}
                            >
                              {artifact.icon}
                            </span>
                            <span className="text-[8px] text-text-primary">{artifact.name}</span>
                            <button
                              onClick={() => removeArtifact(artifact.id)}
                              className="text-[8px] text-text-muted hover:text-danger ml-0.5 cursor-pointer leading-none"
                            >
                              &times;
                            </button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
