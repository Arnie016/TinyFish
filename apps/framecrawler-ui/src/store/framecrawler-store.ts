import { create } from 'zustand';
import type {
  ActivityEvent,
  TinyFishEvent,
  SceneMetadata,
  ResearchSource,
  DemoPhase,
  Artifact,
} from './types';
import {
  MOCK_SCENE_METADATA,
  MOCK_RESEARCH_SOURCES,
  MOCK_TINYFISH_EVENTS,
  SCANNING_STEPS,
  DEMO_TOPIC,
  ARTIFACT_BANK,
} from './mock-data';

let eventId = 0;
const nextId = () => `evt-${++eventId}`;

async function pushSceneToBlender(spec: SceneMetadata): Promise<boolean> {
  try {
    const res = await fetch('/api/push-scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

interface FrameCrawlerState {
  // Scene data
  sceneMetadata: SceneMetadata | null;
  researchSources: ResearchSource[];
  tinyFishEvents: TinyFishEvent[];
  tinyFishActive: boolean;
  activity: ActivityEvent[];

  // Viewport visibility
  visibleObjectIds: string[];
  visibleLightIds: string[];
  cameraAnimating: boolean;
  hoveredObjectId: string | null;

  // Artifact bank
  artifacts: Artifact[];
  selectedArtifactIds: string[];

  // Blender connection
  blenderConnected: boolean;
  blenderLastPush: string | null;

  // Demo control
  demoPhase: DemoPhase;
  promptText: string;
  isTyping: boolean;
  scanProgress: number;
  scanStatus: string;

  // Actions
  pushEvent: (evt: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  setHoveredObject: (id: string | null) => void;
  pushToBlender: () => Promise<void>;
  addArtifact: (id: string) => void;
  removeArtifact: (id: string) => void;

  // Demo sequence
  demoPrompt: () => void;
  demoResearch: () => void;
  demoExtract: () => void;
  demoPlan: () => void;
  demoBuild: () => void;
  demoLight: () => void;
  demoCamera: () => void;
  demoReview: () => void;
  demoReset: () => void;
  demoRunAll: () => void;
}

export const useFrameCrawlerStore = create<FrameCrawlerState>((set, get) => ({
  sceneMetadata: null,
  researchSources: [],
  tinyFishEvents: [],
  tinyFishActive: false,
  activity: [],
  visibleObjectIds: [],
  visibleLightIds: [],
  cameraAnimating: false,
  hoveredObjectId: null,
  artifacts: ARTIFACT_BANK,
  selectedArtifactIds: [],
  blenderConnected: false,
  blenderLastPush: null,
  demoPhase: 0,
  promptText: '',
  isTyping: false,
  scanProgress: 0,
  scanStatus: '',

  pushEvent: (evt) =>
    set((s) => ({
      activity: [{ ...evt, id: nextId(), timestamp: Date.now() }, ...s.activity].slice(0, 50),
    })),

  setHoveredObject: (id) => set({ hoveredObjectId: id }),

  addArtifact: (id) => {
    const { selectedArtifactIds, artifacts } = get();
    if (selectedArtifactIds.includes(id)) return;
    const artifact = artifacts.find((a) => a.id === id);
    if (!artifact) return;
    set({ selectedArtifactIds: [...selectedArtifactIds, id] });
    get().pushEvent({
      type: 'object_placed',
      title: `Added: ${artifact.name}`,
      detail: `${artifact.category} artifact added to scene`,
    });
  },

  removeArtifact: (id) => {
    const { selectedArtifactIds, artifacts } = get();
    const artifact = artifacts.find((a) => a.id === id);
    set({ selectedArtifactIds: selectedArtifactIds.filter((x) => x !== id) });
    if (artifact) {
      get().pushEvent({
        type: 'info',
        title: `Removed: ${artifact.name}`,
        detail: 'Artifact removed from scene',
      });
    }
  },

  pushToBlender: async () => {
    const spec = get().sceneMetadata;
    if (!spec) return;

    get().pushEvent({ type: 'info', title: 'Pushing to Blender', detail: 'Writing SceneSpec...' });

    const ok = await pushSceneToBlender(spec);
    if (ok) {
      set({ blenderConnected: true, blenderLastPush: new Date().toLocaleTimeString() });
      get().pushEvent({
        type: 'scene_ready',
        title: 'Pushed to Blender',
        detail: `${spec.objects.length} objects, ${spec.lighting.lights.length} lights — scene_spec.json written`,
      });
    } else {
      get().pushEvent({ type: 'info', title: 'Blender push failed', detail: 'Is the dev server running?' });
    }
  },

  // Phase 1: Prompt typing
  demoPrompt: () => {
    const topic = DEMO_TOPIC;
    set({ demoPhase: 1, promptText: '', isTyping: true });

    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i > topic.length) {
        clearInterval(interval);
        set({ isTyping: false });
        get().pushEvent({ type: 'info', title: 'Scene topic set', detail: `"${topic}"` });
        return;
      }
      set({ promptText: topic.slice(0, i) });
    }, 80);
  },

  // Phase 2: TinyFish research
  demoResearch: () => {
    const state = get();
    state.pushEvent({
      type: 'research_started',
      title: 'TinyFish research started',
      detail: 'Using /run-sse for live browser preview',
    });
    set({
      demoPhase: 2,
      scanProgress: 0,
      scanStatus: SCANNING_STEPS[0],
      tinyFishEvents: [],
      tinyFishActive: true,
    });

    // Stream TinyFish events
    MOCK_TINYFISH_EVENTS.forEach((tfEvt) => {
      setTimeout(() => {
        set((s) => {
          const newEvents = [...s.tinyFishEvents, tfEvt];
          const isComplete = tfEvt.type === 'COMPLETE';

          if (tfEvt.type === 'PROGRESS' || tfEvt.type === 'COMPLETE') {
            get().pushEvent({
              type: 'tinyfish_progress',
              title: isComplete ? 'Research complete' : 'TinyFish',
              detail: tfEvt.message,
            });
          }

          return {
            tinyFishEvents: newEvents,
            tinyFishActive: !isComplete,
          };
        });
      }, tfEvt.timestamp);
    });

    // Animate scanning progress
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= SCANNING_STEPS.length) {
        clearInterval(interval);
        set({
          scanProgress: 100,
          scanStatus: SCANNING_STEPS[SCANNING_STEPS.length - 1],
        });
        return;
      }
      const progress = Math.round((step / (SCANNING_STEPS.length - 1)) * 100);
      set({
        scanProgress: progress,
        scanStatus: SCANNING_STEPS[step],
      });
    }, 1500);
  },

  // Phase 3: Extract sources
  demoExtract: () => {
    set({ demoPhase: 3, researchSources: [] });

    MOCK_RESEARCH_SOURCES.forEach((source, i) => {
      setTimeout(() => {
        set((s) => ({ researchSources: [...s.researchSources, source] }));
        get().pushEvent({
          type: 'source_extracted',
          title: `Source: ${source.title.split('\u2014')[0].trim()}`,
          detail: `${source.snippets.length} snippets, ${(source.confidence * 100).toFixed(0)}% confidence`,
        });
      }, (i + 1) * 800);
    });
  },

  // Phase 4: Scene plan — also pushes SceneSpec to Blender
  demoPlan: () => {
    const state = get();
    state.pushEvent({
      type: 'plan_started',
      title: 'Building scene plan',
      detail: `${MOCK_SCENE_METADATA.objects.length} objects, ${MOCK_SCENE_METADATA.lighting.lights.length} lights`,
    });
    set({ demoPhase: 4, sceneMetadata: MOCK_SCENE_METADATA });

    setTimeout(() => {
      get().pushEvent({
        type: 'plan_complete',
        title: 'SceneSpec validated',
        detail: `${MOCK_SCENE_METADATA.environment.location_type} — ${MOCK_SCENE_METADATA.environment.time_of_day}`,
      });
    }, 1500);
  },

  // Phase 5: Build — push full spec to Blender, then animate local preview
  demoBuild: () => {
    const state = get();
    state.pushEvent({
      type: 'info',
      title: 'Pushing to Blender',
      detail: 'Writing SceneSpec to scene_spec.json',
    });
    set({ demoPhase: 5, visibleObjectIds: [], sceneMetadata: MOCK_SCENE_METADATA });

    // Push to Blender via file bridge
    pushSceneToBlender(MOCK_SCENE_METADATA).then((ok) => {
      if (ok) {
        set({ blenderConnected: true, blenderLastPush: new Date().toLocaleTimeString() });
        get().pushEvent({
          type: 'scene_ready',
          title: 'Blender: scene building',
          detail: 'Addon file watcher detected change — rebuilding...',
        });
      }
    });

    // Animate local R3F preview in parallel
    const objects = MOCK_SCENE_METADATA.objects;
    objects.forEach((obj, i) => {
      setTimeout(() => {
        set((s) => ({ visibleObjectIds: [...s.visibleObjectIds, obj.id] }));
        get().pushEvent({
          type: 'object_placed',
          title: obj.name,
          detail: `${obj.category} — ${obj.placement_hint}`,
        });
      }, (i + 1) * 350);
    });
  },

  // Phase 6: Add lights
  demoLight: () => {
    const state = get();
    state.pushEvent({
      type: 'info',
      title: 'Lighting scene',
      detail: 'Adding key, fill, rim, and practicals',
    });
    set({ demoPhase: 6, visibleLightIds: [] });

    const lights = MOCK_SCENE_METADATA.lighting.lights;
    lights.forEach((light, i) => {
      setTimeout(() => {
        set((s) => ({ visibleLightIds: [...s.visibleLightIds, light.id] }));
        get().pushEvent({
          type: 'light_added',
          title: `${light.type.toUpperCase()}: ${light.label}`,
          detail: `Color: ${light.color}, intensity: ${light.intensity}`,
        });
      }, (i + 1) * 500);
    });
  },

  // Phase 7: Camera animation
  demoCamera: () => {
    const state = get();
    state.pushEvent({
      type: 'camera_set',
      title: 'Camera path set',
      detail: MOCK_SCENE_METADATA.camera.shot_type,
    });
    set({ demoPhase: 7, cameraAnimating: true });

    setTimeout(() => {
      set({ cameraAnimating: false });
    }, 6000);
  },

  // Phase 8: Review
  demoReview: () => {
    const state = get();
    state.pushEvent({
      type: 'scene_ready',
      title: 'Scene ready for artist',
      detail: `${MOCK_SCENE_METADATA.objects.length} objects, ${MOCK_SCENE_METADATA.lighting.lights.length} lights, ${MOCK_SCENE_METADATA.citations.length} citations`,
    });
    set({ demoPhase: 8, cameraAnimating: false });
  },

  // Reset
  demoReset: () => {
    eventId = 0;
    set({
      sceneMetadata: null,
      researchSources: [],
      tinyFishEvents: [],
      tinyFishActive: false,
      activity: [],
      visibleObjectIds: [],
      visibleLightIds: [],
      cameraAnimating: false,
      hoveredObjectId: null,
      selectedArtifactIds: [],
      blenderConnected: false,
      blenderLastPush: null,
      demoPhase: 0,
      promptText: '',
      isTyping: false,
      scanProgress: 0,
      scanStatus: '',
    });
  },

  // Auto-run all
  demoRunAll: async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const s = get();

    s.demoPrompt();
    await wait(4000);

    s.demoResearch();
    await wait(19000);

    s.demoExtract();
    await wait(6000);

    s.demoPlan();
    await wait(3000);

    s.demoBuild();
    await wait(MOCK_SCENE_METADATA.objects.length * 350 + 2000);

    s.demoLight();
    await wait(MOCK_SCENE_METADATA.lighting.lights.length * 500 + 2000);

    s.demoCamera();
    await wait(7000);

    s.demoReview();
  },
}));
