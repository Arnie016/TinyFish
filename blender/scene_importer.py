#!/usr/bin/env python3
"""
Minimal fallback importer for scene_spec.json.

Usage outside Blender:
  python blender/scene_importer.py scene_spec.json

Usage inside Blender:
  blender --python blender/scene_importer.py -- scene_spec.json
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

try:
    import bpy  # type: ignore
except Exception:  # pragma: no cover - fallback path when Blender is absent
    bpy = None


COLLECTIONS = ["ENV", "PROPS", "CHARACTERS", "LIGHTS", "CAMERAS", "NOTES"]


def load_scene_spec(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def ensure_collection(name: str):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def link_to_collection(obj, collection_name: str):
    collection = ensure_collection(collection_name)
    if obj.name not in collection.objects:
        collection.objects.link(obj)
    for existing in list(obj.users_collection):
        if existing != collection:
            existing.objects.unlink(obj)


def make_material(name: str, color: tuple[float, float, float, float]):
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name=name)
        material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs[0].default_value = color
    return material


def clear_default_cube():
    for name in ["Cube"]:
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)


def build_graybox(spec: dict):
    clear_default_cube()

    for name in COLLECTIONS:
        ensure_collection(name)

    bpy.ops.mesh.primitive_plane_add(size=9, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "Floor"
    floor.data.materials.append(make_material("MAT_FLOOR", (0.09, 0.1, 0.12, 1.0)))
    link_to_collection(floor, "ENV")

    bpy.ops.mesh.primitive_plane_add(size=9, location=(0, -4.5, 3))
    wall = bpy.context.active_object
    wall.name = "BackWall"
    wall.rotation_euler[0] = math.radians(90)
    wall.data.materials.append(make_material("MAT_WALL", (0.12, 0.13, 0.16, 1.0)))
    link_to_collection(wall, "ENV")

    x_cursor = -2.8
    for index, item in enumerate(spec.get("objects", [])):
        category = item.get("category", "prop")
        name = item.get("name", f"Object_{index + 1}")
        collection_name = "PROPS"
        if category == "character":
            collection_name = "CHARACTERS"
        elif category == "note":
            collection_name = "NOTES"

        if category == "note":
            bpy.ops.object.empty_add(type="PLAIN_AXES", location=(x_cursor, 2.4, 1.2))
            obj = bpy.context.active_object
            obj.name = name
        else:
            bpy.ops.mesh.primitive_cube_add(location=(x_cursor, 0.1 * index, 0.6))
            obj = bpy.context.active_object
            obj.name = name
            obj.scale = (0.55, 0.4, 0.6)
            obj.data.materials.append(make_material("MAT_PLACEHOLDER", (0.22, 0.26, 0.32, 1.0)))

        link_to_collection(obj, collection_name)
        x_cursor += 1.1

    bpy.ops.object.camera_add(location=(4.8, -5.6, 2.6), rotation=(math.radians(74), 0, math.radians(42)))
    hero_camera = bpy.context.active_object
    hero_camera.name = "HeroCamera"
    bpy.context.scene.camera = hero_camera
    link_to_collection(hero_camera, "CAMERAS")

    bpy.ops.object.light_add(type="AREA", location=(1.2, -1.8, 3.1))
    key = bpy.context.active_object
    key.name = "KeyLight"
    key.data.energy = 1600
    link_to_collection(key, "LIGHTS")

    bpy.ops.object.light_add(type="POINT", location=(-2.3, 1.4, 1.1))
    practical = bpy.context.active_object
    practical.name = "PracticalCountdown"
    practical.data.energy = 340
    link_to_collection(practical, "LIGHTS")

    bpy.ops.object.light_add(type="AREA", location=(3.8, 1.8, 2.7))
    rim = bpy.context.active_object
    rim.name = "RimLight"
    rim.data.energy = 900
    link_to_collection(rim, "LIGHTS")


def main():
    args = sys.argv
    if "--" in args:
        args = args[args.index("--") + 1 :]
    else:
        args = args[1:]

    if not args:
        raise SystemExit("Expected path to scene_spec.json")

    path = Path(args[0]).expanduser().resolve()
    spec = load_scene_spec(path)

    if bpy is None:
        print(json.dumps(
            {
                "mode": "dry-run",
                "project_title": spec.get("project_title"),
                "objects": len(spec.get("objects", [])),
                "collections": COLLECTIONS,
            },
            indent=2,
        ))
        return

    build_graybox(spec)
    print(f'Imported "{spec.get("project_title", "Scene")}" into Blender graybox collections.')


if __name__ == "__main__":
    main()
