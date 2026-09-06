"""Original procedural character, authored in Blender. No external assets."""
import bpy, math, os
from mathutils import Vector
OUT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../public/models/tennis'))
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,rough=.65):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
 return m
skin=mat('Warm skin',(.58,.31,.19)); shirt=mat('Jersey',(.09,.25,.27)); white=mat('Ivory fabric',(.85,.88,.82)); hair=mat('Hair',(.045,.029,.023)); sole=mat('Sole',(.68,.72,.67)); iris=mat('Eyes',(.07,.045,.022)); lip=mat('Lips',(.34,.12,.09)); pink=mat('Racket',(.57,.10,.21)); strings=mat('Strings',(.65,.69,.66))
def parent(name):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
def uv(name,pos,scale,material,p=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=pos);o=bpy.context.object;o.name=name;o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 for f in o.data.polygons:f.use_smooth=True
 if p:o.parent=p
 return o
def loft(name,rings,material,p=None):
 verts=[];faces=[];n=32
 for z,rx,ry,cx,cy in rings:
  verts.extend([(cx+rx*math.cos(i*2*math.pi/n),cy+ry*math.sin(i*2*math.pi/n),z) for i in range(n)])
 for j in range(len(rings)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
 faces.extend([tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+i for i in range(n))])
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 for f in me.polygons:f.use_smooth=True
 if p:o.parent=p
 return o
def line(name,a,b,r,material,p=None):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');o.data.materials.append(material)
 if p:o.parent=p
 return o
torso=parent('Torso')
loft('Tailored jersey',[(.97,.16,.10,0,0),(1.04,.175,.105,0,0),(1.18,.175,.105,0,0),(1.33,.215,.125,0,0),(1.43,.235,.115,0,0),(1.48,.19,.095,0,0),(1.52,.074,.068,0,0)],shirt,torso)
loft('Collar',[(1.49,.086,.075,0,0),(1.515,.08,.07,0,0)],white,torso)
uv('Neck',(0,0,1.535),(.063,.067,.085),skin,torso)
loft('Face',[(1.59,.047,.049,0,.018),(1.61,.07,.068,0,.016),(1.65,.088,.082,0,.009),(1.70,.095,.083,0,0),(1.76,.092,.079,0,-.007),(1.81,.075,.067,0,-.013),(1.835,.035,.037,0,-.015)],skin,torso)
uv('Hair crown',(0,-.02,1.798),(.091,.073,.050),hair,torso)
for s in [-1,1]:
 uv('Ear',(s*.096,-.006,1.705),(.018,.018,.032),skin,torso)
 uv('Eye white',(s*.034,.079,1.72),(.021,.006,.009),white,torso)
 uv('Iris',(s*.033,.085,1.72),(.007,.003,.007),iris,torso)
 line('Brow',(s*.016,.082,1.738),(s*.053,.077,1.74),.004,hair,torso)
uv('Nose bridge',(0,.08,1.702),(.014,.022,.026),skin,torso);uv('Nose tip',(0,.098,1.688),(.019,.016,.012),skin,torso)
uv('Upper lip',(0,.096,1.657),(.024,.005,.003),lip,torso);uv('Lower lip',(0,.096,1.65),(.022,.006,.004),lip,torso)
for z in [1.11,1.15]:line('Jersey seam',(-.15,.063,z),(.15,.063,z+.012),.0018,white,torso)
uv('Chest crest',(-.115,.116,1.37),(.018,.002,.022),white,torso)
hips=parent('Hips');loft('Short waistband',[(.90,.173,.107,0,0),(1.015,.17,.11,0,0)],white,hips)
for s in [-1,1]:loft('Short leg',[(.80,.10,.115,s*.095,0),(.9,.106,.117,s*.089,0),(.96,.091,.106,s*.082,0)],white,hips)
for i in range(8):
 p=parent('Limb'+str(i));leg=i<4;upper=i%2==0
 radii=([.070,.098,.090,.064,.055] if upper else [.055,.067,.062,.039,.036]) if leg else ([.065,.071,.061,.044,.038] if upper else [.038,.047,.041,.029,.025])
 loft('Anatomy',[(z,r,r*.88,0,0) for z,r in zip([-.5,-.25,0,.3,.5],radii)],skin,p)
 if upper:uv('Joint',(0,0,.5),(radii[-1],radii[-1],.12),skin,p)
 if not leg and upper:loft('Sleeve',[(-.5,.074,.067,0,0),(-.28,.077,.068,0,0),(-.10,.066,.059,0,0)],shirt,p)
 if leg and not upper:loft('Sock',[(.28,.043,.041,0,0),(.5,.041,.038,0,0)],white,p)
for side in ['R','L']:
 p=parent('Hand'+side);uv('Palm',(0,0,0),(.035,.023,.047),skin,p)
 for i in range(4):uv('Finger',(-.024+i*.016,.007,-.049),(.008,.014,.030-(abs(i-1.5)*.004)),skin,p)
 uv('Thumb',(-.035,.013,-.012),(.013,.016,.03),skin,p)
for i in range(2):
 p=parent('Shoe'+str(i));uv('Outsole',(0,.042,.035),(.058,.139,.027),sole,p);uv('Shoe upper',(0,.04,.070),(.054,.129,.047),white,p)
 uv('Heel',(0,-.047,.085),(.05,.045,.057),shirt,p)
 for j in range(4):line('Laces',(-.025,.01+j*.014,.11-j*.004),(.025,.017+j*.014,.11-j*.004),.0025,white,p)
racket=parent('Racket')
# In Blender's X/Z plane: export maps this to Three's X/Y plane.
for i in range(64):
 a=i*2*math.pi/64;b=(i+1)*2*math.pi/64
 line('Frame',(.155*math.cos(a),0,.21*math.sin(a)),(.155*math.cos(b),0,.21*math.sin(b)),.009,pink,racket)
for i in range(-6,7):
 x=i*.022;z=.21*math.sqrt(max(0,1-(x/.155)**2));line('String',(x,0,-z),(x,0,z),.0008,strings,racket)
for i in range(-8,9):
 z=i*.023;x=.155*math.sqrt(max(0,1-(z/.21)**2));line('String',(-x,0,z),(x,0,z),.0008,strings,racket)
for s in [-1,1]:line('Throat',(s*.07,0,-.185),(0,0,-.32),.008,pink,racket)
line('Grip',(0,0,-.31),(0,0,-.46),.018,hair,racket)
# Assemble neutral athletic stance; runtime articulates these same named parts.
def bone(name,a,b):
 o=bpy.data.objects[name];a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');o.scale.z=(b-a).length
for i,s in enumerate([-1,1]):
 bone('Limb'+str(i*2),(s*.10,0,.87),(s*.18,.06,.52));bone('Limb'+str(i*2+1),(s*.18,.06,.52),(s*.21,0,.14));bpy.data.objects['Shoe'+str(i)].location=(s*.21,0,0)
for j,s in enumerate([1,-1]):
 bone('Limb'+str(4+j*2),(s*.21,0,1.43),(s*.32,.05,1.18));bone('Limb'+str(5+j*2),(s*.32,.05,1.18),(s*.33,.24,1.04));bpy.data.objects['Hand'+('R' if j==0 else 'L')].location=(s*.33,.24,1.01)
racket.location=(.33,.24,1.42)
# Export character only, then add a studio for an inspectable Blender source/render.
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'club-player.glb'),export_format='GLB')
bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(mat('Studio',(.11,.14,.15)))
world=bpy.context.scene.world;world.color=(.3,.3,.3)
for pos,power,size in [((3,4,5),650,4),((-3,1,3),450,3),((0,-3,4),700,3)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.35,4.8,2.35));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.35
sc=bpy.context.scene;sc.camera=cam;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.render.resolution_x=900;sc.render.resolution_y=1100;sc.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'club-player.blend'))
sc.render.filepath=os.path.join(OUT,'club-player.png');bpy.ops.render.render(write_still=True)
