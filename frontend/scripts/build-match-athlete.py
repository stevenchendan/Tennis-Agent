"""Fit CC0 MakeHuman components to the published tennis motion bind pose.

Run with a directory of the source files listed in CHARACTER-LICENSE.md.
The original target node matrices and inverse bind matrices stay byte-compatible
with the independently baked wrist, racket and motion samples.
"""
import argparse
import io
import json
import re
import struct
from pathlib import Path

import numpy as np
from PIL import Image


def obj(path, body=False):
    vertices, uv, faces = [], [], []
    group = ""
    for line in path.read_text(encoding="utf8").splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == "v":
            vertices.append([float(n) for n in fields[1:4]])
        elif fields[0] == "vt":
            uv.append([float(n) for n in fields[1:3]])
        elif fields[0] == "g":
            group = fields[1]
        elif fields[0] == "f" and (not body or group == "body"):
            polygon = [tuple(int(n)-1 for n in item.split("/")[:2]) for item in fields[1:]]
            faces.extend([[polygon[0], polygon[i], polygon[i+1]] for i in range(1,len(polygon)-1)])
    return np.array(vertices), np.array(uv), np.array(faces)


def align(source, target):
    a = source / np.linalg.norm(source)
    b = target / np.linalg.norm(target)
    x,y,z = np.cross(a,b)
    cross = np.array([[0,-z,y],[z,0,-x],[-y,x,0]])
    return np.eye(3) + cross + cross @ cross / (1+np.dot(a,b))


def proxy(path, vertices, weights):
    refs, coefficients, offsets, hidden = [], [], [], set()
    section = ""
    for line in path.read_text(encoding="utf8").splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] in ("verts","delete_verts"):
            section = fields[0]
        elif fields[0].isdigit() and section == "verts":
            if len(fields)==1:
                refs.append([int(fields[0])]*3)
                coefficients.append([1,0,0])
                offsets.append([0,0,0])
            else:
                refs.append(list(map(int,fields[:3])))
                coefficients.append(list(map(float,fields[3:6])))
                offsets.append(list(map(float,fields[6:9])))
        elif section=="delete_verts" and fields[0].isdigit():
            for lo,hi in re.findall(r"(\d+)(?:\s*-\s*(\d+))?",line):
                hidden.update(range(int(lo),int(hi or lo)+1))
    refs, coefficients = np.array(refs),np.array(coefficients)
    positions = (vertices[refs]*coefficients[:,:,None]).sum(axis=1)+np.array(offsets)
    influences = np.maximum(0,(weights[refs]*coefficients[:,:,None]).sum(axis=1))
    return positions, influences, hidden


def shirt_faces(vertices, faces):
    # The T-shirt overlaps the waistband. Use the actual connected garments.
    parent = list(range(len(vertices)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for a,b,c in faces[:,:,0]:
        parent[root(b)] = root(a)
        parent[root(c)] = root(a)
    shoulder = np.argmax(vertices[:,1])
    return np.array([root(v)==root(shoulder) for v in faces[:,0,0]])


class AthleteSkin:
    def __init__(self, directory, source, rig, skeleton, target):
        self.source, self.target = source, target
        self.parts = list(target)
        self.rig = rig
        self.transforms = {}
        self.weights = np.zeros((len(source),len(target)))
        def joint(bone, end="head"):
            return source[rig["joints"][rig["bones"][bone][end]]].mean(axis=0)
        def segment(name, first, last, end, width=.111):
            a,b = joint(first),joint(last)
            c,d = target[name],target[end]
            direction = (b-a)/np.linalg.norm(b-a)
            scale = width*np.eye(3)+(np.linalg.norm(d-c)/np.linalg.norm(b-a)-width)*np.outer(direction,direction)
            self.transforms[name] = (align(b-a,d-c) @ scale,a,c)
        segment("Hips","root","spine04","Spine")
        segment("Spine","spine04","spine03","Spine1")
        segment("Spine1","spine03","spine01","Spine2")
        segment("Spine2","spine01","neck01","Neck")
        # All face and hair vertices use one transform to retain eyelid alignment.
        face_scale=(1.79-target["Neck"][1])/(source[:,1].max()-joint("neck01")[1])
        for name in ("Neck","Head"):
            self.transforms[name]=(np.eye(3)*face_scale,joint("neck01"),target["Neck"])
        for side,suffix in (("Left",".L"),("Right",".R")):
            chain=[("Shoulder","clavicle","upperarm01","Arm"),("Arm","upperarm01","lowerarm01","ForeArm"),
                   ("ForeArm","lowerarm01","wrist","Hand"),("Hand","wrist","finger3-1","HandIndex1"),
                   ("UpLeg","upperleg01","lowerleg01","Leg"),("Leg","lowerleg01","foot","Foot")]
            for name,first,last,end in chain:
                segment(side+name,first+suffix,last+suffix,side+end)
            # Keep finger separation and a common shoe last through the bind fit.
            for digit in ("Thumb","Index"):
                for i in range(1,4):
                    self.transforms[side+"Hand"+digit+str(i)]=self.transforms[side+"Hand"]
            shoe=(np.eye(3)*.106,joint("foot"+suffix),target[side+"Foot"])
            for name in ("Foot","ToeBase"):
                self.transforms[side+name]=shoe
        main={"root":"Hips","spine05":"Hips","spine04":"Spine","spine03":"Spine1","spine02":"Spine2","spine01":"Spine2"}
        limbs={"clavicle":"Shoulder","shoulder01":"Shoulder","upperarm":"Arm","lowerarm":"ForeArm",
               "wrist":"Hand","metacarpal":"Hand","upperleg":"UpLeg","lowerleg":"Leg","foot":"Foot","toe":"ToeBase"}
        for name, entries in skeleton["weights"].items():
            base=name.split(".")[0]
            side="Left" if name.endswith(".L") else "Right"
            target_name=main.get(base,"Head")
            if base.startswith("neck"): target_name="Neck"
            elif base.startswith("pelvis"): target_name="Hips"
            elif base.startswith("breast"): target_name="Spine2"
            elif base.startswith("finger"):
                digit,level=base[6:].split("-")
                target_name=side+"Hand"+("Thumb" if digit=="1" else "Index")+level
            else:
                for prefix,part in limbs.items():
                    if base.startswith(prefix): target_name=side+part;break
            indices,values=np.array(entries).T
            self.weights[indices.astype(int),self.parts.index(target_name)]+=values
        self.weights /= np.maximum(1e-12,self.weights.sum(axis=1,keepdims=True))

    def fit(self, position, weights):
        joints=np.argsort(-weights,axis=1)[:,:4]
        skin=np.take_along_axis(weights,joints,axis=1)
        empty=skin.sum(axis=1)<1e-8
        joints[empty,0]=self.parts.index("Head")
        skin[empty,0]=1
        skin/=skin.sum(axis=1,keepdims=True)
        out=np.zeros_like(position)
        for j,name in enumerate(self.parts):
            row,col=np.nonzero(joints==j)
            if not len(row) or name not in self.transforms: continue
            m,a,c=self.transforms[name]
            out[row]+=(((position[row]-a) @ m.T)+c)*skin[row,col,None]
        return out,joints,skin


class Glb:
    def __init__(self, template):
        raw=template.read_bytes()
        length=struct.unpack_from("<I",raw,12)[0]
        self.g=json.loads(raw[20:20+length])
        data=raw[28+length:]
        inv=self.g["accessors"][self.g["skins"][0]["inverseBindMatrices"]]
        view=self.g["bufferViews"][inv["bufferView"]]
        offset=view.get("byteOffset",0)+inv.get("byteOffset",0)
        binds=data[offset:offset+inv["count"]*64]
        self.data=bytearray()
        for k in ("bufferViews","accessors","materials","textures","images"):self.g[k]=[]
        self.g["meshes"]=[{"name":"Match athlete","primitives":[]}]
        self.g["skins"][0]["inverseBindMatrices"]=self.access(np.frombuffer(binds,"<f4").reshape(-1,16),"MAT4")
        self.world={}
        def visit(i,parent):
            n=self.g["nodes"][i]
            m=np.array(n.get("matrix",np.eye(4).T.ravel())).reshape(4,4).T
            self.world[i]=parent@m
            for child in n.get("children",[]):visit(child,self.world[i])
        for i in self.g["scenes"][0]["nodes"]:visit(i,np.eye(4))
        mesh=next(i for i,n in enumerate(self.g["nodes"]) if "mesh" in n)
        self.inverse=np.linalg.inv(self.world[mesh])

    def view(self,data):
        while len(self.data)%4:self.data.append(0)
        i=len(self.g["bufferViews"])
        self.g["bufferViews"].append({"buffer":0,"byteOffset":len(self.data),"byteLength":len(data)})
        self.data.extend(data)
        return i

    def access(self,values,kind,extent=False):
        component={"f":5126,"B":5121,"H":5123,"I":5125}[values.dtype.char]
        item={"bufferView":self.view(values.tobytes()),"count":len(values),"type":kind,"componentType":component}
        if extent:item.update(min=values.min(axis=0).tolist(),max=values.max(axis=0).tolist())
        self.g["accessors"].append(item)
        return len(self.g["accessors"])-1

    def material(self,name,texture=None,color=(1,1,1,1),alpha=False):
        pbr={"baseColorFactor":color,"roughnessFactor":.78,"metallicFactor":0}
        if texture:
            im=Image.open(texture).convert("RGBA" if alpha else "RGB")
            im.thumbnail((1024,1024),Image.Resampling.LANCZOS if hasattr(Image,"Resampling") else Image.LANCZOS)
            io_bytes=io.BytesIO()
            im.save(io_bytes,format="PNG" if alpha else "JPEG",quality=88,optimize=True)
            self.g["images"].append({"bufferView":self.view(io_bytes.getvalue()),"mimeType":"image/png" if alpha else "image/jpeg"})
            self.g["textures"].append({"source":len(self.g["images"])-1})
            pbr["baseColorTexture"]={"index":len(self.g["textures"])-1}
        mat={"name":name,"pbrMetallicRoughness":pbr,"doubleSided":True}
        if alpha:mat.update(alphaMode="MASK",alphaCutoff=.35)
        self.g["materials"].append(mat)
        return len(self.g["materials"])-1

    def primitive(self,positions,joints,weights,uv,faces,mat):
        ids=faces[:,:,0]
        normals=np.zeros_like(positions)
        per_face=np.cross(positions[ids[:,1]]-positions[ids[:,0]],positions[ids[:,2]]-positions[ids[:,0]])
        for column in ids.T:np.add.at(normals,column,per_face)
        normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)
        pairs,index=np.unique(faces.reshape(-1,2),axis=0,return_inverse=True)
        v,tex=pairs.T
        local=positions[v]@self.inverse[:3,:3].T+self.inverse[:3,3]
        norm=normals[v]@self.inverse[:3,:3].T
        norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-12)
        coords=uv[tex].copy();coords[:,1]=1-coords[:,1]
        attrs={"POSITION":self.access(local.astype("<f4"),"VEC3",True),"NORMAL":self.access(norm.astype("<f4"),"VEC3"),
               "TEXCOORD_0":self.access(coords.astype("<f4"),"VEC2"),"JOINTS_0":self.access(joints[v].astype("B"),"VEC4"),
               "WEIGHTS_0":self.access(weights[v].astype("<f4"),"VEC4")}
        self.g["meshes"][0]["primitives"].append({"attributes":attrs,"indices":self.access(index.ravel().astype("<u2"),"SCALAR"),"material":mat})

    def save(self,path):
        while len(self.data)%4:self.data.append(0)
        self.g["buffers"]=[{"byteLength":len(self.data)}]
        header=json.dumps(self.g,separators=(",",":")).encode()
        header+=b" "*(-len(header)%4)
        path.write_bytes(b"glTF"+struct.pack("<III4s",2,28+len(header)+len(self.data),len(header),b"JSON")+header+struct.pack("<I4s",len(self.data),b"BIN\0")+self.data)


def build(directory):
    models=Path(__file__).resolve().parents[1]/"public/models/tennis"
    glb=Glb(models/"tennis-athlete.glb")
    target={glb.g["nodes"][i]["name"]:glb.world[i][:3,3] for i in glb.g["skins"][0]["joints"]}
    base,uv,faces=obj(directory/"base.obj",body=True)
    morph=np.loadtxt(directory/"caucasian-male-young.target")
    base[morph[:,0].astype(int)]+=morph[:,1:]*.82
    rig=json.loads((directory/"default.mhskel").read_text(encoding="utf8"))
    weights=json.loads((directory/"default_weights.mhw").read_text(encoding="utf8"))
    athlete=AthleteSkin(directory,base,rig,weights,target)
    body,bj,bw=athlete.fit(base,athlete.weights)
    visible=np.ones(len(body),dtype=bool)
    for name,material,diffuse in [
        ("male_casualsuit06","Jersey","male_casualsuit06_diffuse.png"),
        ("shoes05","Court shoes","shoes05_diffuse.png"),
        ("short04","Hair","short04_diffuse.png"),
        ("high-poly","Eyes","brown_eye.png")]:
        model,tex,tri=obj(directory/(name+".obj"))
        posed,weights,hidden=proxy(directory/(name+".mhclo"),base,athlete.weights)
        assert len(posed)==len(model),name
        if material in ("Eyes","Hair"):
            weights[:]=0;weights[:,athlete.parts.index("Head")]=1
        pos,j,w=athlete.fit(posed,weights)
        deleted=np.array(sorted(hidden),dtype=int)
        if material=="Jersey":
            shirt=shirt_faces(model,tri)
            shorts=(~shirt)&(pos[tri[:,:,0],1].max(axis=1)>.62)
            hem=pos.copy()
            hem[:,1]=np.maximum(hem[:,1],.62)
            glb.primitive(hem,j,w,tex,tri[shorts],glb.material("Shorts",color=(.024,.039,.055,1)))
            tri=tri[shirt]
            deleted=deleted[body[deleted,1]>.625]
        visible[deleted]=False
        glb.primitive(pos,j,w,tex,tri,glb.material(material,directory/diffuse,alpha=material=="Hair"))
    keep=visible[faces[:,:,0]].any(axis=1)
    glb.primitive(body,bj,bw,uv,faces[keep],glb.material("Skin",directory/"young_lightskinned_male_diffuse.png"))
    glb.save(models/"match-athlete.glb")


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assets",type=Path)
    build(parser.parse_args().assets)
