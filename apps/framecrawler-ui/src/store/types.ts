export interface SceneEnvironment {
  location_type: string;
  time_of_day: string;
  weather: string;
  mood: string;
  scale: string;
}

export type ObjectCategory = 'prop' | 'setpiece' | 'character' | 'vehicle' | 'fx' | 'ui';
export type GeometryType = 'box' | 'cylinder' | 'sphere' | 'plane' | 'cone';

export interface SceneObject {
  id: string;
  name: string;
  category: ObjectCategory;
  description: string;
  material: string;
  color: string;
  approx_size: string;
  placement_hint: string;
  importance: number;
  source_url: string;
  confidence: number;
  position: [number, number, number];
  scale: [number, number, number];
  geometry: GeometryType;
}

export interface SceneLight {
  id: string;
  type: 'key' | 'fill' | 'rim' | 'practical';
  label: string;
  color: string;
  intensity: number;
  position: [number, number, number];
  target?: [number, number, number];
}

export interface SceneCamera {
  shot_type: string;
  lens_feel: string;
  framing_notes: string;
  path: [number, number, number][];
}

export interface SceneMetadata {
  project_title: string;
  topic: string;
  scene_goal: string;
  style_keywords: string[];
  environment: SceneEnvironment;
  objects: SceneObject[];
  camera: SceneCamera;
  lighting: {
    key_light: string;
    fill_light: string;
    rim_light: string;
    practicals: string[];
    overall_feel: string;
    lights: SceneLight[];
  };
  color_palette: string[];
  mood_keywords: string[];
  composition_rules: string[];
  citations: { url: string; snippet: string }[];
}

export interface ResearchSource {
  id: string;
  url: string;
  title: string;
  snippets: string[];
  tags: string[];
  confidence: number;
  thumbnail_gradient: [string, string];
}

export type TinyFishEventType = 'STARTED' | 'STREAMING_URL' | 'PROGRESS' | 'HEARTBEAT' | 'COMPLETE';

export interface TinyFishEvent {
  type: TinyFishEventType;
  timestamp: number;
  message: string;
  url?: string;
}

export type ActivityEventType =
  | 'research_started'
  | 'tinyfish_progress'
  | 'research_complete'
  | 'source_extracted'
  | 'plan_started'
  | 'plan_complete'
  | 'object_placed'
  | 'light_added'
  | 'camera_set'
  | 'scene_ready'
  | 'info';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  detail?: string;
  timestamp: number;
}

export type ArtifactCategory = 'architecture' | 'furniture' | 'props' | 'vehicles' | 'environment' | 'lighting';

export interface Artifact {
  id: string;
  name: string;
  category: ArtifactCategory;
  icon: string;
  color: string;
  tags: string[];
  relatedIds: string[];
  // position in graph view (normalized 0-1)
  gx: number;
  gy: number;
}

export type DemoPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const PHASE_LABELS: Record<DemoPhase, string> = {
  0: 'Idle',
  1: 'Prompt',
  2: 'Research',
  3: 'Extract',
  4: 'Plan',
  5: 'Build',
  6: 'Light',
  7: 'Camera',
  8: 'Review',
};
