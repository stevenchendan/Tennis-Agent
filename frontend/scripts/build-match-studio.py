"""Run with Blender in background mode to build the editable match athlete."""
import json
import struct
import tempfile
from pathlib import Path

import bpy
from mathutils import Matrix


frontend = Path(__file__).resolve().parents[1]
models = frontend / "public/models/tennis"
library = frontend / "src/lib"
art = frontend / "art"
art.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

# Keep the original string bed, grip and throat meshes, positioned in the
# equipment coordinate system used by the wrist calibration.
bpy.ops.import_scene.gltf(filepath=str(models / "club-player.glb"))
racket = bpy.data.objects["Racket"]
parts = [racket, *racket.children_recursive]
racket.parent = None
racket.matrix_world = Matrix.Identity(4)
for obj in list(bpy.context.scene.objects):
    if obj not in parts:
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=str(models / "match-racket.glb"), use_selection=True, export_animations=False)

# Import the canonical quaternion tracks through Blender's glTF conversion so
# edit-bone roll, the Y-up axis and the non-bone armature parent are respected.
raw = (models / "match-athlete.glb").read_bytes()
length = struct.unpack_from("<I", raw, 12)[0]
doc = json.loads(raw[20:20+length])
binary = bytearray(raw[28+length:])
names = json.loads((library / "tennis-motion/rig-bones.json").read_text())
clips = json.loads((library / "drills/recorded-motion.json").read_text())
nodes = {n.get("name"): i for i,n in enumerate(doc["nodes"])}
socket = len(doc["nodes"])
doc["nodes"].append({"name":"Racket contact"})
doc["scenes"][0]["nodes"].append(socket)
for name in names:
    node = doc["nodes"][nodes[name]]
    if "matrix" in node:
        values = node.pop("matrix")
        matrix = Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()
        pos, rot, scale = matrix.decompose()
        node.update(translation=list(pos), rotation=[rot.x,rot.y,rot.z,rot.w], scale=list(scale))

def accessor(rows, kind):
    while len(binary)%4:
        binary.append(0)
    start = len(binary)
    for row in rows:
        binary.extend(struct.pack("<"+"f"*len(row), *row))
    view = len(doc["bufferViews"])
    doc["bufferViews"].append({"buffer":0,"byteOffset":start,"byteLength":len(binary)-start})
    entry = {"bufferView":view,"componentType":5126,"type":kind,"count":len(rows)}
    if kind=="SCALAR":
        entry.update(min=rows[0],max=rows[-1])
    doc["accessors"].append(entry)
    return len(doc["accessors"])-1

poses, markers = [], []
for name, clip in clips.items():
    markers.append((name,len(poses),len(poses)+round(clip["contact"]/clip["dt"])))
    poses.extend(clip["poses"])
    poses.extend([clip["poses"][-1]]*12)
times = accessor([[i/50] for i in range(len(poses))],"SCALAR")
animation = {"name":"Stroke review","channels":[],"samplers":[]}
def channel(node, path, values):
    out = accessor(values, "VEC4" if path=="rotation" else "VEC3")
    animation["channels"].append({"sampler":len(animation["samplers"]),"target":{"node":node,"path":path}})
    animation["samplers"].append({"input":times,"output":out,"interpolation":"LINEAR"})
for i, name in enumerate(names):
    channel(nodes[name],"rotation",[p["b"][i] for p in poses])
channel(nodes["Hips"],"translation",[p["h"] for p in poses])
channel(socket,"translation",[p["r"] for p in poses])
channel(socket,"rotation",[p["q"] for p in poses])
doc["animations"]=[animation]
doc["buffers"][0]["byteLength"]=len(binary)
header=json.dumps(doc,separators=(",",":")).encode()
header+=b" "*(-len(header)%4)
with tempfile.TemporaryDirectory() as td:
    animated=Path(td)/"stroke-review.glb"
    animated.write_bytes(b"glTF"+struct.pack("<III4s",2,28+len(header)+len(binary),len(header),b"JSON")+header+struct.pack("<I4s",len(binary),b"BIN\0")+binary)
    bpy.context.scene.render.fps=50
    bpy.ops.import_scene.gltf(filepath=str(animated), import_pack_images=True)

anchor=bpy.data.objects["Racket contact"]
# Split the fitted skin into independently editable clothing and anatomy
# objects while keeping the armature modifier and original vertex weights.
athlete = next(o for o in bpy.context.scene.objects if o.type=="MESH" and o.find_armature())
bpy.ops.object.select_all(action="DESELECT")
athlete.select_set(True)
bpy.context.view_layer.objects.active=athlete
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="MATERIAL")
bpy.ops.object.mode_set(mode="OBJECT")
for obj in bpy.context.selected_objects:
    if obj.type=="MESH" and len(obj.data.materials)==1:
        obj.name=obj.data.materials[0].name
racket.parent=anchor
racket.matrix_parent_inverse=Matrix.Identity(4)
racket.matrix_basis=Matrix.Identity(4)
scene=bpy.context.scene
scene.frame_start=0
scene.frame_end=len(poses)-1
for name, first, hit in markers:
    scene.timeline_markers.new(name,frame=first)
    scene.timeline_markers.new(name+" · contact",frame=hit)
scene.frame_set(markers[-1][2])
for obj in scene.objects:
    if obj.type=="ARMATURE":
        obj.show_in_front=False
        obj.hide_render=True
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=="VIEW_3D":
            area.spaces.active.region_3d.view_distance=4.6
            area.spaces.active.region_3d.view_location=(0,0,1.15)
            area.spaces.active.overlay.show_overlays=False
            area.spaces.active.shading.color_type="TEXTURE"
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(art/"match-athlete.blend"),compress=True)
