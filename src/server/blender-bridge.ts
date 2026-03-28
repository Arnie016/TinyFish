import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type {
  BlenderAction,
  BlenderRunState,
  SceneGrounding,
  SceneSpec,
} from "../shared/contracts.js";

type BlenderBridgeResponse = {
  ok: boolean;
  appliedActionIds?: string[];
  failedActionIds?: string[];
  message?: string;
};

type BlenderSocketResponse = {
  status?: "success" | "error";
  result?: unknown;
  message?: string;
  error?: unknown;
};

type BlenderSocketTarget = {
  host: string;
  port: number;
  label: string;
};

const DEFAULT_SOCKET_HOST = "127.0.0.1";
const DEFAULT_SOCKET_PORT = 9876;

function blenderHttpEndpoint(): string | null {
  const value = process.env.BLENDER_MCP_ENDPOINT?.trim();
  if (!value) {
    return null;
  }
  return /^https?:\/\//i.test(value) ? value : null;
}

function parseSocketTarget(value: string): BlenderSocketTarget | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  if (/^tcp:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return {
        host: parsed.hostname || DEFAULT_SOCKET_HOST,
        port: parsed.port ? Number.parseInt(parsed.port, 10) : DEFAULT_SOCKET_PORT,
        label: trimmed,
      };
    } catch {
      return null;
    }
  }

  const plain = trimmed.match(/^([^:]+):(\d+)$/);
  if (plain) {
    return {
      host: plain[1],
      port: Number.parseInt(plain[2], 10),
      label: `tcp://${plain[1]}:${plain[2]}`,
    };
  }

  return null;
}

function blenderSocketTarget(): BlenderSocketTarget {
  const envTarget = process.env.BLENDER_MCP_SOCKET?.trim() || process.env.BLENDER_MCP_ENDPOINT?.trim();
  const parsed = envTarget ? parseSocketTarget(envTarget) : null;
  if (parsed) {
    return parsed;
  }

  const port = Number.parseInt(process.env.BLENDER_MCP_PORT ?? `${DEFAULT_SOCKET_PORT}`, 10);
  return {
    host: DEFAULT_SOCKET_HOST,
    port: Number.isFinite(port) ? port : DEFAULT_SOCKET_PORT,
    label: `tcp://${DEFAULT_SOCKET_HOST}:${Number.isFinite(port) ? port : DEFAULT_SOCKET_PORT}`,
  };
}

function transportLabel(): string {
  const http = blenderHttpEndpoint();
  if (http) {
    return http;
  }
  return blenderSocketTarget().label;
}

export function blenderBridgeConfigured(): boolean {
  return Boolean(blenderHttpEndpoint() || blenderSocketTarget());
}

function sendSocketCommand(type: string, params: Record<string, unknown> = {}): Promise<BlenderSocketResponse> {
  const target = blenderSocketTarget();

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: target.host, port: target.port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timed out talking to Blender socket at ${target.label}.`));
    }, 15_000);

    let buffer = "";
    let settled = false;

    const finish = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      handler();
    };

    socket.setEncoding("utf8");

    socket.on("connect", () => {
      socket.write(
        JSON.stringify({
          type,
          params,
        }),
      );
    });

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      try {
        const parsed = JSON.parse(buffer) as BlenderSocketResponse;
        finish(() => {
          socket.destroy();
          resolve(parsed);
        });
      } catch {
        // keep accumulating until the add-on finishes responding
      }
    });

    socket.on("error", (error) => {
      finish(() => reject(error));
    });

    socket.on("close", () => {
      if (!settled) {
        finish(() => {
          if (!buffer.trim()) {
            reject(new Error(`Blender socket at ${target.label} closed without a response.`));
            return;
          }
          try {
            resolve(JSON.parse(buffer) as BlenderSocketResponse);
          } catch (error) {
            reject(new Error(`Blender socket returned invalid JSON: ${String(error)}`));
          }
        });
      }
    });
  });
}

function parseExecuteCodeOutput<T>(response: BlenderSocketResponse): T {
  if (response.status === "error") {
    throw new Error(response.message ?? "Blender execute_code request failed.");
  }

  const result = response.result as
    | {
        executed?: boolean;
        result?: string;
      }
    | string
    | undefined;
  const stdout =
    typeof result === "string"
      ? result.trim()
      : typeof result?.result === "string"
        ? result.result.trim()
        : "";

  if (!stdout) {
    throw new Error("Blender execute_code returned no stdout payload.");
  }

  return JSON.parse(stdout) as T;
}

function buildGroundingSummary(payload: {
  scene_name: string;
  current_frame: number;
  frame_start: number;
  frame_end: number;
  active_object: string | null;
  selected_objects: string[];
  object_names: string[];
  collection_names: string[];
  camera_names: string[];
  light_names: string[];
  viewport_image?: string | null;
}): SceneGrounding {
  const objectCount = payload.object_names.length;
  const summaryLines = [
    `Scene "${payload.scene_name}" at frame ${payload.current_frame}/${payload.frame_end}.`,
    payload.active_object ? `Active object: ${payload.active_object}.` : "No active object.",
    `Objects: ${objectCount}, cameras: ${payload.camera_names.length}, lights: ${payload.light_names.length}.`,
  ];

  if (payload.selected_objects.length) {
    summaryLines.push(`Selected: ${payload.selected_objects.join(", ")}.`);
  }

  return {
    scene_name: payload.scene_name,
    current_frame: payload.current_frame,
    frame_start: payload.frame_start,
    frame_end: payload.frame_end,
    active_object: payload.active_object,
    selected_objects: payload.selected_objects,
    object_count: objectCount,
    collection_names: payload.collection_names,
    camera_names: payload.camera_names,
    light_names: payload.light_names,
    object_names: payload.object_names,
    summary_lines: summaryLines,
    viewport_image: payload.viewport_image ?? null,
  } as SceneGrounding;
}

function normalizeSceneInfo(result: unknown): Omit<SceneGrounding, "summary_lines"> | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const data = result as Record<string, unknown>;
  const sceneName =
    typeof data.scene_name === "string"
      ? data.scene_name
      : typeof data.name === "string"
        ? data.name
        : typeof data.scene === "string"
          ? data.scene
          : null;

  const currentFrame =
    typeof data.current_frame === "number"
      ? data.current_frame
      : typeof data.frame_current === "number"
        ? data.frame_current
        : typeof data.currentFrame === "number"
          ? data.currentFrame
          : 1;

  const frameStart =
    typeof data.frame_start === "number"
      ? data.frame_start
      : typeof data.start_frame === "number"
        ? data.start_frame
        : 1;

  const frameEnd =
    typeof data.frame_end === "number"
      ? data.frame_end
      : typeof data.end_frame === "number"
        ? data.end_frame
        : typeof data.total_frames === "number"
          ? data.total_frames
          : currentFrame;

  const objects =
    Array.isArray(data.object_names)
      ? data.object_names
      : Array.isArray(data.objects)
        ? (data.objects as unknown[]).map((entry) =>
            typeof entry === "string" ? entry : typeof (entry as Record<string, unknown>).name === "string" ? ((entry as Record<string, unknown>).name as string) : "Object",
          )
        : [];

  const cameras =
    Array.isArray(data.camera_names)
      ? data.camera_names
      : Array.isArray(data.cameras)
        ? (data.cameras as unknown[]).map((entry) => String(entry))
        : Array.isArray(data.objects)
          ? (data.objects as unknown[])
              .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null))
              .filter((entry): entry is Record<string, unknown> => Boolean(entry))
              .filter((entry) => entry.type === "CAMERA" && typeof entry.name === "string")
              .map((entry) => String(entry.name))
        : [];

  const lights =
    Array.isArray(data.light_names)
      ? data.light_names
      : Array.isArray(data.lights)
        ? (data.lights as unknown[]).map((entry) => String(entry))
        : Array.isArray(data.objects)
          ? (data.objects as unknown[])
              .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null))
              .filter((entry): entry is Record<string, unknown> => Boolean(entry))
              .filter((entry) => entry.type === "LIGHT" && typeof entry.name === "string")
              .map((entry) => String(entry.name))
        : [];

  const collections =
    Array.isArray(data.collection_names)
      ? data.collection_names
      : Array.isArray(data.collections)
        ? (data.collections as unknown[]).map((entry) => String(entry))
        : [];

  if (!sceneName) {
    return null;
  }

  return {
    scene_name: sceneName,
    current_frame: Number(currentFrame),
    frame_start: Number(frameStart),
    frame_end: Number(frameEnd),
    active_object:
      typeof data.active_object === "string"
        ? data.active_object
        : typeof data.activeObject === "string"
          ? data.activeObject
          : null,
    selected_objects: Array.isArray(data.selected_objects)
      ? (data.selected_objects as unknown[]).map((entry) => String(entry))
      : Array.isArray(data.selectedObjects)
        ? (data.selectedObjects as unknown[]).map((entry) => String(entry))
        : [],
    object_count: typeof data.object_count === "number" ? data.object_count : objects.length,
    collection_names: collections,
    camera_names: cameras,
    light_names: lights,
    object_names: objects,
    viewport_image: null,
  };
}

export async function executeBlenderCode(code: string): Promise<unknown> {
  const response = await sendSocketCommand("execute_code", { code });
  if (response.status === "error") {
    throw new Error(response.message ?? "Blender execute_code request failed.");
  }
  return response.result;
}

export async function getSceneInfo(): Promise<unknown> {
  const response = await sendSocketCommand("get_scene_info", {});
  if (response.status === "error") {
    throw new Error(response.message ?? "Blender get_scene_info request failed.");
  }
  return response.result;
}

export async function getViewportScreenshot(maxSize = 1200): Promise<string | null> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tinyfish-blender-"));
  const filepath = path.join(tempDir, "viewport.png");

  try {
    const response = await sendSocketCommand("get_viewport_screenshot", {
      max_size: maxSize,
      filepath,
      format: "png",
    });
    if (response.status === "error") {
      throw new Error(response.message ?? "Blender get_viewport_screenshot request failed.");
    }

    const result = response.result as Record<string, unknown> | undefined;
    const resolvedPath =
      typeof result?.filepath === "string" && result.filepath.trim() ? result.filepath : filepath;
    const image = await fs.readFile(resolvedPath);
    return `data:image/png;base64,${image.toString("base64")}`;
  } catch (error) {
    if (String(error).includes("No 3D viewport found")) {
      return null;
    }
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function readBlenderSceneGrounding(): Promise<SceneGrounding | null> {
  const http = blenderHttpEndpoint();
  if (http) {
    return null;
  }

  const result = await getSceneInfo();
  const normalized = normalizeSceneInfo(result);
  if (!normalized) {
    return null;
  }

  try {
    normalized.viewport_image = await getViewportScreenshot();
  } catch {
    normalized.viewport_image = null;
  }

  return buildGroundingSummary(normalized);
}

function toPythonBase64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function buildBlenderExecutionScript(sceneSpec: SceneSpec, actions: BlenderAction[]): string {
  const specBase64 = toPythonBase64(sceneSpec);
  const actionsBase64 = toPythonBase64(actions);

  return `
import base64
import bpy
import json
import math
import re

scene_spec = json.loads(base64.b64decode("${specBase64}").decode("utf-8"))
actions = json.loads(base64.b64decode("${actionsBase64}").decode("utf-8"))
requested_kinds = {action["kind"] for action in actions}
applied_action_ids = []
failed_action_ids = []

def slugify(value):
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_")
    return value or "tinyfish"

root_name = f"TF_{slugify(scene_spec['scene_id'])}"
scene = bpy.context.scene

def ensure_collection(name, parent=None):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)

    if parent is None:
        if collection not in bpy.context.scene.collection.children[:]:
            bpy.context.scene.collection.children.link(collection)
    else:
        if collection not in parent.children[:]:
            parent.children.link(collection)
    return collection

def ensure_in_collection(obj, collection):
    if collection not in obj.users_collection:
        collection.objects.link(obj)
    for existing in list(obj.users_collection):
        if existing != collection and existing.name.startswith(root_name):
            existing.objects.unlink(obj)

def ensure_text(name, body, location, collection, scale=0.33):
    obj = bpy.data.objects.get(name)
    if obj is None or obj.type != "FONT":
        curve = bpy.data.curves.new(f"{name}_Data", type="FONT")
        obj = bpy.data.objects.new(name, curve)
    else:
        curve = obj.data

    curve.body = body
    curve.align_x = "LEFT"
    obj.location = location
    obj.scale = (scale, scale, scale)
    ensure_in_collection(obj, collection)
    return obj

def ensure_cube(name, location, scale, collection):
    obj = bpy.data.objects.get(name)
    if obj is None:
        bpy.ops.mesh.primitive_cube_add(location=location)
        obj = bpy.context.active_object
        obj.name = name
    obj.location = location
    obj.scale = scale
    ensure_in_collection(obj, collection)
    return obj

def ensure_plane(name, location, scale, collection):
    obj = bpy.data.objects.get(name)
    if obj is None:
        bpy.ops.mesh.primitive_plane_add(location=location)
        obj = bpy.context.active_object
        obj.name = name
    obj.location = location
    obj.scale = scale
    ensure_in_collection(obj, collection)
    return obj

def ensure_camera(name, location, rotation, collection):
    obj = bpy.data.objects.get(name)
    if obj is None or obj.type != "CAMERA":
        camera_data = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
        if obj is None:
            obj = bpy.data.objects.new(name, camera_data)
        else:
            obj.data = camera_data
    obj.location = location
    obj.rotation_euler = rotation
    ensure_in_collection(obj, collection)
    return obj

def ensure_light(name, light_type, location, energy, collection):
    obj = bpy.data.objects.get(name)
    if obj is None or obj.type != "LIGHT":
        light_data = bpy.data.lights.get(name) or bpy.data.lights.new(name=name, type=light_type)
        light_data.type = light_type
        if obj is None:
            obj = bpy.data.objects.new(name, light_data)
        else:
            obj.data = light_data
    obj.location = location
    obj.data.energy = energy
    ensure_in_collection(obj, collection)
    return obj

def ensure_empty(name, location, collection, empty_type="PLAIN_AXES"):
    obj = bpy.data.objects.get(name)
    if obj is None:
        obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = empty_type
    obj.location = location
    ensure_in_collection(obj, collection)
    return obj

def scale_from_hint(hint, category):
    lowered = (hint or "").lower()
    if "human" in lowered or category == "character":
        return (0.45, 0.45, 1.0)
    if "wall" in lowered:
        return (1.0, 0.08, 0.75)
    if "handheld" in lowered:
        return (0.16, 0.1, 0.04)
    if "floor" in lowered:
        return (0.75, 0.45, 0.06)
    if "large" in lowered or category == "vehicle":
        return (1.2, 0.9, 0.8)
    if category == "setpiece":
        return (0.9, 0.7, 0.7)
    return (0.45, 0.45, 0.45)

root_collection = ensure_collection(root_name)
collections = {
    "ENV": ensure_collection(f"{root_name}_ENV", root_collection),
    "PROPS": ensure_collection(f"{root_name}_PROPS", root_collection),
    "CHARACTERS": ensure_collection(f"{root_name}_CHARACTERS", root_collection),
    "VEHICLES": ensure_collection(f"{root_name}_VEHICLES", root_collection),
    "FX": ensure_collection(f"{root_name}_FX", root_collection),
    "LIGHTS": ensure_collection(f"{root_name}_LIGHTS", root_collection),
    "CAMERAS": ensure_collection(f"{root_name}_CAMERAS", root_collection),
    "NOTES": ensure_collection(f"{root_name}_NOTES", root_collection),
}

def collection_for_object(category):
    return {
        "character": collections["CHARACTERS"],
        "vehicle": collections["VEHICLES"],
        "fx": collections["FX"],
        "note": collections["NOTES"],
        "setpiece": collections["ENV"],
    }.get(category, collections["PROPS"])

if "collection" in requested_kinds:
    applied_action_ids.extend([action["id"] for action in actions if action["kind"] == "collection"])

if "mesh" in requested_kinds:
    ensure_plane(f"{root_name}_Ground", (0.0, 0.0, 0.0), (9.0, 9.0, 1.0), collections["ENV"])
    ensure_cube(f"{root_name}_Backdrop", (0.0, 8.0, 4.0), (9.0, 0.2, 4.0), collections["ENV"])

    for index, item in enumerate(scene_spec["objects"]):
        if item["category"] == "note":
            continue
        column = index % 4
        row = index // 4
        location = ((column - 1.5) * 2.6, 1.8 + row * 3.1, 0.0)
        scale = scale_from_hint(item.get("approx_size"), item["category"])
        location = (location[0], location[1], scale[2])
        obj = ensure_cube(
            f"{root_name}_{slugify(item['name'])}",
            location,
            scale,
            collection_for_object(item["category"]),
        )
        obj["tinyfish_role"] = item["category"]
        obj["tinyfish_description"] = item["description"]
        obj["tinyfish_material"] = item["material"]
        obj["tinyfish_color"] = item["color"]
        obj["tinyfish_placement_hint"] = item["placement_hint"]
    applied_action_ids.extend([action["id"] for action in actions if action["kind"] == "mesh"])

if "camera" in requested_kinds:
    hero = ensure_camera(
        f"{root_name}_HeroCam",
        (0.0, -9.5, 4.6),
        (math.radians(72), 0.0, 0.0),
        collections["CAMERAS"],
    )
    hero.data.lens = 35
    support_a = ensure_camera(
        f"{root_name}_SupportCam_A",
        (-6.0, -5.8, 3.2),
        (math.radians(70), 0.0, math.radians(-18)),
        collections["CAMERAS"],
    )
    support_a.data.lens = 50
    support_b = ensure_camera(
        f"{root_name}_SupportCam_B",
        (5.8, -4.0, 2.6),
        (math.radians(74), 0.0, math.radians(22)),
        collections["CAMERAS"],
    )
    support_b.data.lens = 65
    applied_action_ids.extend([action["id"] for action in actions if action["kind"] == "camera"])

if "light" in requested_kinds:
    key = ensure_light(f"{root_name}_Key", "AREA", (4.5, -3.0, 5.6), 1500, collections["LIGHTS"])
    key.data.shape = "RECTANGLE"
    key.data.size = 4.0
    key.data.size_y = 2.2
    fill = ensure_light(f"{root_name}_Fill", "AREA", (-4.2, -2.5, 3.9), 550, collections["LIGHTS"])
    fill.data.shape = "RECTANGLE"
    fill.data.size = 3.0
    fill.data.size_y = 1.4
    rim = ensure_light(f"{root_name}_Rim", "SPOT", (0.0, 7.4, 6.0), 900, collections["LIGHTS"])
    rim.rotation_euler = (math.radians(120), 0.0, math.radians(180))
    for index, practical in enumerate(scene_spec["lighting"]["practicals"]):
        practical_obj = ensure_empty(
            f"{root_name}_Practical_{index + 1}",
            (-5.0 + index * 1.8, -1.2, 1.2 + index * 0.25),
            collections["LIGHTS"],
            "SPHERE",
        )
        practical_obj["tinyfish_practical"] = practical
    applied_action_ids.extend([action["id"] for action in actions if action["kind"] == "light"])

if "annotation" in requested_kinds:
    notes = [
        f"Project: {scene_spec['project_title']}",
        f"Goal: {scene_spec['scene_goal']}",
        f"Camera: {scene_spec['camera']['shot_type']} | {scene_spec['camera']['lens_feel']}",
        f"Lighting: {scene_spec['lighting']['overall_feel']}",
    ]
    ensure_text(
        f"{root_name}_SceneSummary",
        "\\n".join(notes),
        (-8.2, -6.0, 1.6),
        collections["NOTES"],
        0.32,
    )

    for index, item in enumerate(scene_spec["objects"]):
        if item["category"] != "note":
            continue
        note_lines = [
            item["name"],
            item["description"],
            f"Placement: {item['placement_hint']}",
        ]
        ensure_text(
            f"{root_name}_Note_{index + 1}",
            "\\n".join(note_lines),
            (5.5, -5.0 + index * 1.3, 1.3),
            collections["NOTES"],
            0.25,
        )
    applied_action_ids.extend([action["id"] for action in actions if action["kind"] == "annotation"])

scene["tinyfish_project_title"] = scene_spec["project_title"]
scene["tinyfish_scene_goal"] = scene_spec["scene_goal"]
scene["tinyfish_transport"] = "codex_socket_bridge"

print(json.dumps({
    "appliedActionIds": applied_action_ids,
    "failedActionIds": failed_action_ids,
    "message": f"Applied {len(applied_action_ids)} Blender actions into {root_name} without disturbing existing scene content."
}))
  `.trim();
}

async function applyViaSocket(sceneSpec: SceneSpec, actions: BlenderAction[]) {
  const response = await sendSocketCommand("execute_code", {
    code: buildBlenderExecutionScript(sceneSpec, actions),
  });

  const payload = parseExecuteCodeOutput<{
    appliedActionIds: string[];
    failedActionIds: string[];
    message: string;
  }>(response);

  const statuses = new Map(actions.map((action) => [action.id, "done" as BlenderAction["status"]]));
  for (const actionId of payload.failedActionIds ?? []) {
    statuses.set(actionId, "failed");
  }

  return {
    bridgeMode: "live" as BlenderRunState["bridge_mode"],
    summary: payload.message ?? `Applied Blender actions through ${transportLabel()}.`,
    statuses,
  };
}

async function applyViaHttp(sceneSpec: SceneSpec, actions: BlenderAction[]) {
  const endpoint = blenderHttpEndpoint();
  if (!endpoint) {
    throw new Error("HTTP Blender bridge endpoint is not configured.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.BLENDER_MCP_TOKEN ? { Authorization: `Bearer ${process.env.BLENDER_MCP_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      sceneId: sceneSpec.scene_id,
      projectTitle: sceneSpec.project_title,
      sceneSpec,
      actions,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Blender bridge failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as BlenderBridgeResponse;
  const statuses = new Map(actions.map((action) => [action.id, "done" as BlenderAction["status"]]));

  for (const failed of payload.failedActionIds ?? []) {
    statuses.set(failed, "failed");
  }

  return {
    bridgeMode: "live" as BlenderRunState["bridge_mode"],
    summary: payload.message ?? `Applied Blender actions through ${endpoint}.`,
    statuses,
  };
}

export async function applyBlenderPlan(
  sceneSpec: SceneSpec,
  actions: BlenderAction[],
): Promise<{
  bridgeMode: BlenderRunState["bridge_mode"];
  summary: string;
  statuses: Map<string, BlenderAction["status"]>;
}> {
  try {
    if (blenderHttpEndpoint()) {
      return await applyViaHttp(sceneSpec, actions);
    }
    return await applyViaSocket(sceneSpec, actions);
  } catch (error) {
    return {
      bridgeMode: "fallback",
      summary: `Live Blender bridge failed on ${transportLabel()}. Codex kept the command plan intact for replay. ${String(error)}`,
      statuses: new Map(actions.map((action) => [action.id, "failed" as BlenderAction["status"]])),
    };
  }
}
