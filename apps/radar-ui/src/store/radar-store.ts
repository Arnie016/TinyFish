import { create } from 'zustand';
import type {
  SkillRecord,
  RunResult,
  ActivityEvent,
  DetailView,
} from './types';
import {
  SEED_SKILLS,
  MOCK_WORKFLOW_SPEC,
  MOCK_COMPILER_DECISION,
  MOCK_COMPILED_SKILL,
  MOCK_RUN_RESULT,
  MOCK_PATCH_JOB,
  SCANNING_STEPS,
} from './mock-data';

let eventId = 0;
const nextId = () => `evt-${++eventId}`;

interface RadarState {
  // Data
  skills: SkillRecord[];
  activity: ActivityEvent[];
  detailView: DetailView;
  patchedToday: number;
  totalRuns: number;

  // Demo state
  demoPhase: number; // 0=idle, 1=scanning, 2=spec, 3=similarity, 4=compiling, 5=compiled, 6=running, 7=ran, 8=patching, 9=patched
  scanProgress: number;
  scanStatus: string;

  // Actions
  pushEvent: (evt: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  setDetailView: (view: DetailView) => void;
  selectSkill: (skillId: string) => void;

  // Demo sequence actions
  demoStartScan: () => void;
  demoShowSpec: () => void;
  demoFindSimilar: () => void;
  demoCompile: () => void;
  demoRunSkill: () => void;
  demoPatchDetect: () => void;
  demoPatchApply: () => void;
  demoReset: () => void;
  demoRunAll: () => void;
}

export const useRadarStore = create<RadarState>((set, get) => ({
  skills: [...SEED_SKILLS],
  activity: [],
  detailView: { kind: 'none' },
  patchedToday: 0,
  totalRuns: 87,
  demoPhase: 0,
  scanProgress: 0,
  scanStatus: '',

  pushEvent: (evt) =>
    set((s) => ({
      activity: [{ ...evt, id: nextId(), timestamp: Date.now() }, ...s.activity].slice(0, 50),
    })),

  setDetailView: (view) => set({ detailView: view }),

  selectSkill: (skillId) => set({ detailView: { kind: 'skill', skill_id: skillId } }),

  // --- Demo sequence ---

  demoStartScan: () => {
    const state = get();
    state.pushEvent({
      type: 'scan_started',
      title: 'TinyFish extraction started',
      detail: 'supabase.com/docs/guides/auth/quickstarts/nextjs',
    });
    set({
      demoPhase: 1,
      scanProgress: 0,
      scanStatus: SCANNING_STEPS[0],
      detailView: {
        kind: 'scanning',
        url: 'https://supabase.com/docs/guides/auth/quickstarts/nextjs',
        progress: 0,
        status: SCANNING_STEPS[0],
      },
    });

    // Animate scanning progress
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= SCANNING_STEPS.length) {
        clearInterval(interval);
        const s = get();
        s.pushEvent({
          type: 'scan_complete',
          title: 'Extraction complete',
          detail: `"${MOCK_WORKFLOW_SPEC.title}" — ${MOCK_WORKFLOW_SPEC.steps.length} steps, ${(MOCK_WORKFLOW_SPEC.confidence * 100).toFixed(0)}% confidence`,
        });
        set({
          demoPhase: 2,
          scanProgress: 100,
          scanStatus: SCANNING_STEPS[SCANNING_STEPS.length - 1],
          detailView: { kind: 'workflow_spec', spec: MOCK_WORKFLOW_SPEC },
        });
        return;
      }
      const progress = Math.round((step / (SCANNING_STEPS.length - 1)) * 100);
      set({
        scanProgress: progress,
        scanStatus: SCANNING_STEPS[step],
        detailView: {
          kind: 'scanning',
          url: 'https://supabase.com/docs/guides/auth/quickstarts/nextjs',
          progress,
          status: SCANNING_STEPS[step],
        },
      });
    }, 800);
  },

  demoShowSpec: () => {
    set({
      demoPhase: 2,
      detailView: { kind: 'workflow_spec', spec: MOCK_WORKFLOW_SPEC },
    });
  },

  demoFindSimilar: () => {
    const state = get();
    state.pushEvent({
      type: 'similarity_found',
      title: 'Similar skills found',
      detail: 'firebase-auth-setup (81%) · nextjs-setup-helper (74%)',
      skill_id: 'firebase-auth-setup',
    });
    set({
      demoPhase: 3,
      detailView: {
        kind: 'compiler',
        spec: MOCK_WORKFLOW_SPEC,
        decision: MOCK_COMPILER_DECISION,
        compiling: false,
      },
    });
  },

  demoCompile: () => {
    const state = get();
    state.pushEvent({
      type: 'compile_started',
      title: 'Compiling skill...',
      detail: 'Forking from firebase-auth-setup',
    });
    set({
      demoPhase: 4,
      detailView: {
        kind: 'compiler',
        spec: MOCK_WORKFLOW_SPEC,
        decision: MOCK_COMPILER_DECISION,
        compiling: true,
      },
    });

    setTimeout(() => {
      const s = get();
      const newSkill = { ...MOCK_COMPILED_SKILL, last_scanned_at: new Date().toISOString() };
      s.pushEvent({
        type: 'compile_complete',
        title: 'Skill compiled',
        detail: `${newSkill.name} v${newSkill.version}`,
        skill_id: newSkill.skill_id,
      });
      s.pushEvent({
        type: 'skill_created',
        title: 'New skill added to registry',
        detail: newSkill.name,
        skill_id: newSkill.skill_id,
      });
      set({
        demoPhase: 5,
        skills: [...get().skills, newSkill],
        detailView: { kind: 'skill', skill_id: newSkill.skill_id },
      });
    }, 2500);
  },

  demoRunSkill: () => {
    const state = get();
    state.pushEvent({
      type: 'run_started',
      title: 'Running supabase-auth-setup',
      detail: 'Project: my-saas',
      skill_id: 'supabase-auth-setup',
    });

    const runResult: RunResult = {
      ...MOCK_RUN_RESULT,
      steps: MOCK_RUN_RESULT.steps.map((s) => ({ ...s, status: 'pending' as const })),
    };

    set({
      demoPhase: 6,
      detailView: { kind: 'run_result', result: runResult },
    });

    // Animate steps completing one by one
    MOCK_RUN_RESULT.steps.forEach((_, i) => {
      setTimeout(() => {
        set((s) => {
          if (s.detailView.kind !== 'run_result') return s;
          const result = { ...s.detailView.result };
          result.steps = result.steps.map((step, j) => ({
            ...step,
            status: j < i ? 'done' as const : j === i ? 'running' as const : step.status,
          }));
          return { detailView: { kind: 'run_result', result } };
        });
      }, (i + 1) * 600);
    });

    // Mark all done
    setTimeout(() => {
      const s = get();
      s.pushEvent({
        type: 'run_complete',
        title: 'Skill run complete',
        detail: '4/4 steps succeeded',
        skill_id: 'supabase-auth-setup',
      });
      set((prev) => {
        const skills = prev.skills.map((sk) =>
          sk.skill_id === 'supabase-auth-setup'
            ? { ...sk, usage_count: sk.usage_count + 1, last_used_at: new Date().toISOString() }
            : sk,
        );
        const result = {
          ...MOCK_RUN_RESULT,
          steps: MOCK_RUN_RESULT.steps.map((s) => ({ ...s, status: 'done' as const })),
        };
        return {
          demoPhase: 7,
          skills,
          totalRuns: prev.totalRuns + 1,
          detailView: { kind: 'run_result', result },
        };
      });
    }, MOCK_RUN_RESULT.steps.length * 600 + 400);
  },

  demoPatchDetect: () => {
    const state = get();
    state.pushEvent({
      type: 'patch_detected',
      title: 'Source drift detected',
      detail: 'Env var renamed: PUBLISHABLE_KEY → ANON_KEY',
      skill_id: 'supabase-auth-setup',
    });
    set({
      demoPhase: 8,
      detailView: { kind: 'patch', patch: MOCK_PATCH_JOB },
    });
  },

  demoPatchApply: () => {
    const state = get();
    state.pushEvent({
      type: 'patch_applied',
      title: 'Patch applied',
      detail: 'supabase-auth-setup v0.1.0 → v0.1.1',
      skill_id: 'supabase-auth-setup',
    });
    set((prev) => ({
      demoPhase: 9,
      patchedToday: prev.patchedToday + 1,
      skills: prev.skills.map((sk) =>
        sk.skill_id === 'supabase-auth-setup'
          ? { ...sk, version: '0.1.1', last_patched_at: new Date().toISOString() }
          : sk,
      ),
      detailView: {
        kind: 'patch',
        patch: { ...MOCK_PATCH_JOB, approved: true },
      },
    }));
  },

  demoReset: () => {
    set({
      skills: [...SEED_SKILLS],
      activity: [],
      detailView: { kind: 'none' },
      patchedToday: 0,
      totalRuns: 87,
      demoPhase: 0,
      scanProgress: 0,
      scanStatus: '',
    });
  },

  demoRunAll: async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const s = get();

    s.demoStartScan();
    await wait(SCANNING_STEPS.length * 800 + 500);

    s.demoFindSimilar();
    await wait(2000);

    s.demoCompile();
    await wait(3500);

    s.demoRunSkill();
    await wait(MOCK_RUN_RESULT.steps.length * 600 + 1500);

    s.demoPatchDetect();
    await wait(3000);

    s.demoPatchApply();
  },
}));
