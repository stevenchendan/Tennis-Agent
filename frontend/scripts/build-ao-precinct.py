"""Original, interpretive Kia Arena bowl. Metres, aligned to 1573 context.
Run: D:/blender/blender.exe -b --python scripts/build-ao-precinct.py
The court centre uses OSM way/1239949236; stand dimensions are estimates.
"""
import bpy, json, math
from pathlib import Path
root = Path(__file__).resolve().parents[1]
out = root / 'public/models/precinct'
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
data = json.loads((root/'public/data/1573-context.json').read_text())
points = next(f['points'] for f in data['features'] if f['id']=='way/1239949236')[:4]
cx = sum(p[0] for p in points)/4
cz = sum(p[1] for p in points)/4
def material(name, color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=.82
    return m
blue=material('Mineral blue seating',(.20,.44,.60))
stone=material('Pale concrete',(.68,.71,.69))
steel=material('Roof fins',(.37,.43,.45))
def box(name,x,y,z,w,h,d,mat):
    # Three x,y,z -> Blender x,-z,y; glTF restores Y-up.
    bpy.ops.mesh.primitive_cube_add(size=1,location=(cx+x,-cz-z,y))
    o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
def rounded(w,d,r):
    pts=[]
    for x,z,start in [(w-r,d-r,0),(-w+r,d-r,90),(-w+r,-d+r,180),(w-r,-d+r,270)]:
        for j in range(6):
            a=math.radians(start+j*18)
            pts.append((x+r*math.cos(a),z+r*math.sin(a)))
    return pts
def band(name,inner,outer,y,height,mat):
    a,b=rounded(*inner),rounded(*outer);n=len(a)
    vertices=[(cx+x,-cz-z,h) for h,pts in [(y,a),(y,b),(y+height,a),(y+height,b)] for x,z in pts]
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.extend([(2*n+i,2*n+j,3*n+j,3*n+i),(i,j,2*n+j,2*n+i),(n+j,n+i,3*n+i,3*n+j)])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
for i in range(22):
    offset=i*.85
    band('Rounded seating tier',(11.6+offset,21.6+offset,2.5+offset*.35),(12.45+offset,22.45+offset,2.8+offset*.35),.76+i*.48,.48,stone)
floor_mesh=bpy.data.meshes.new('Concourse floor')
floor_pts=rounded(31,41,10)
floor_mesh.from_pydata([(cx+x,-cz-z,.06) for x,z in floor_pts],[],[tuple(reversed(range(len(floor_pts))))])
floor_mesh.update()
floor_object=bpy.data.objects.new('Concourse floor',floor_mesh)
bpy.context.collection.objects.link(floor_object);floor_object.data.materials.append(stone)
band('Continuous outer wall',(31,41,10),(31.6,41.6,10.6),0,12.8,stone)
band('Broad perimeter canopy',(25,35,8),(34,44,13),13.7,.35,stone)
for side in [-1,1]:
    for z in range(-29,30,2):
        box('Facade fin',side*31.8,8.4,z,.32,9,.18,stone)
    # Pale intermediate steps break the seating into legible banks.
    for row in range(44):
        u=11.6+row*.425
        for z in [-12,12]:box('Aisle tread',side*u,.76+row*.24,z,.43,.24,1.2,stone)

# Batch thousands of seat shells and fine canopy ribs without per-seat operators.
verts=[];faces=[]
def cube_vertices(x,y,z,w,h,d,angle=0):
    first=len(verts)
    for yy in [-h/2,h/2]:
        for zz in [-d/2,d/2]:
            for xx in [-w/2,w/2]:
                px=x+xx*math.cos(angle)-zz*math.sin(angle)
                pz=z+xx*math.sin(angle)+zz*math.cos(angle)
                verts.append((cx+px,-cz-pz,y+yy))
    for face in [(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]:faces.append(tuple(first+i for i in face))
def flush(name,mat):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
    verts.clear();faces.clear()
for row in range(22):
    o=row*.85;pts=rounded(12+o,22+o,2.7+o*.35)
    for index,a in enumerate(pts):
        c=pts[(index+1)%len(pts)];dx,dz=c[0]-a[0],c[1]-a[1];length=math.hypot(dx,dz)
        for j in range(int(length/.54)):
            t=(j+.5)*.54/length;x=a[0]+dx*t;z=a[1]+dz*t
            if abs(abs(z)-12)<.7 or abs(x)<.65:continue
            angle=math.atan2(dz,dx)
            cube_vertices(x,1.4+row*.48,z,.44,.14,.43,angle)
            cube_vertices(x,1.61+row*.48,z,.44,.38,.09,angle)
flush('Individual blue seat shells',blue)
# Keep the editable seat design in Blender, but render repeated seats with a
# Three.js InstancedMesh. Excluding them from glTF avoids a 14 MB duplicate mesh.
seat_design=bpy.data.objects.get('Individual blue seat shells')
seat_design.hide_set(True)
seat_design.hide_render=True
pts=rounded(32,42,11)
for index,a in enumerate(pts):
    c=pts[(index+1)%len(pts)];dx,dz=c[0]-a[0],c[1]-a[1];length=math.hypot(dx,dz)
    for j in range(int(length/.65)):
        t=j*.65/length;x=a[0]+dx*t;z=a[1]+dz*t
        cube_vertices(x,9,z,.13,9.4,.30,math.atan2(dz,dx))
flush('Complete ribbed facade',stone)
# Shallow radial roof seams stop at the inner edge of the canopy.
inner,outer=rounded(25,35,8),rounded(34,44,13)
for i in range(len(inner)):
    for step in range(6):
        t=step/6;j=(i+1)%len(inner)
        a=(inner[i][0]*(1-t)+inner[j][0]*t,inner[i][1]*(1-t)+inner[j][1]*t)
        c=(outer[i][0]*(1-t)+outer[j][0]*t,outer[i][1]*(1-t)+outer[j][1]*t)
        dx,dz=c[0]-a[0],c[1]-a[1]
        cube_vertices((a[0]+c[0])/2,14.09,(a[1]+c[1])/2,math.hypot(dx,dz),.07,.035,math.atan2(dz,dx))
flush('Canopy standing seams',steel)
bpy.ops.object.select_all(action='SELECT')
seat_design.select_set(False)
bpy.context.view_layer.objects.active=bpy.context.selected_objects[0]
bpy.ops.object.join()
bpy.context.object.name='Kia_Arena_interpretive_bowl'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'ao-precinct.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'ao-precinct.glb'),export_format='GLB',use_selection=True)
print('Exported original precinct bowl at',cx,cz)
