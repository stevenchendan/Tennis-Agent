import * as T from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import names from "./rig-bones.json";
import { recordedReady, recordedSample } from "../drills/recorded-motion";
import type { DrillStrokeKind } from "./index";

export type AthletePose = {
  x: number; z: number; yaw: number; vx: number; vz: number; distance: number;
  stroke: DrillStrokeKind; relativeTime: number; split: number;
};

function makeRacket(equipment: T.Group) {
  const source = equipment.getObjectByName("Racket");
  if (!source) throw new Error("Racket geometry missing");
  source.updateWorldMatrix(true, true);
  const inverse = source.matrixWorld.clone().invert();
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  source.traverse(part => {
    if (!(part instanceof T.Mesh)) return;
    const geometry = part.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, part.matrixWorld));
    for (const key of Object.keys(geometry.attributes)) {
      if (key !== "position" && key !== "normal") geometry.deleteAttribute(key);
    }
    const group = batches.get(part.material) ?? [];
    group.push(geometry);
    batches.set(part.material, group);
  });
  const racket = new T.Group();
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!geometry) throw new Error("Incompatible racket geometry");
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = true;
    racket.add(mesh);
  }
  return racket;
}

// Work in bind-pose metres so the collar, cuffs and shoe uppers follow the skin.
function dress(mesh: T.SkinnedMesh, color: string) {
  const geometry = mesh.geometry.clone();
  const bind = geometry.getAttribute("position");
  const points = new Float32Array(bind.count * 3);
  const point = new T.Vector3();
  for (let i = 0; i < bind.count; i++) point.fromBufferAttribute(bind, i).applyMatrix4(mesh.matrixWorld).toArray(points, i * 3);
  geometry.setAttribute("kitPosition", new T.BufferAttribute(points, 3));
  mesh.geometry = geometry;
  const material = new T.MeshStandardMaterial({ roughness: .77 });
  material.onBeforeCompile = shader => {
    shader.uniforms.team = { value: new T.Color(color) };
    shader.vertexShader = "attribute vec3 kitPosition; varying vec3 kit;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n kit = kitPosition;");
    shader.fragmentShader = "uniform vec3 team; varying vec3 kit;\n" + shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      float h = kit.y;
      float lat = abs(kit.x);
      vec3 skin = vec3(.50,.263,.155);
      vec3 navy = vec3(.025,.045,.058);
      vec3 ivory = vec3(.83,.85,.80);
      vec3 fabric = mix(team,team*.50,smoothstep(.13,.22,lat)*.55);
      float collar = 1.48 - .07 * exp(-90.*lat*lat);
      vec3 pigment = skin;
      if(h > .84 && h < collar && lat < .33) {
        pigment = fabric;
        if(h > collar-.018 || lat > .313) pigment = mix(fabric,ivory,.70);
      }
      if(h > .624 && h < .902 && lat < .29) pigment = mix(navy,navy*1.55,smoothstep(.13,.21,lat));
      if(h > .887 && h < .905 && lat < .27) pigment = navy*.72;
      if(h < .22) pigment = ivory * (.91 + .055*cos(h*480.));
      if(h < .112) pigment = mix(ivory,team,.17 + .55*smoothstep(.048,.065,h)*(1.-smoothstep(.077,.09,h)));
      if(h < .029) pigment = navy;
      if(lat > .63 && lat < .684 && h > 1.) pigment = ivory;
      if(h > 1.69 + .027*cos(kit.x*18.) - kit.z*.20) pigment = vec3(.054,.033,.024);
      diffuseColor.rgb *= pigment;
    `);
  };
  mesh.material = material;
}

const readyHip = recordedReady.j[0];
const neutralYaw = Math.atan2(recordedReady.j[7][2]-recordedReady.j[4][2], recordedReady.j[7][0]-recordedReady.j[4][0]);

export function createAthlete(source: T.Group, equipment: T.Group, color: string) {
  const body = clone(source), racket = makeRacket(equipment);
  const group = new T.Group(), stance = new T.Group();
  stance.add(body, racket);
  group.add(stance);
  body.updateWorldMatrix(true, true);
  body.traverse(part => {
    if (part instanceof T.SkinnedMesh) {
      dress(part, color);
      part.frustumCulled = false;
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  const bones = names.map(name => body.getObjectByName(name) as T.Bone);
  if (bones.some(bone => !bone?.isBone)) throw new Error("Athlete skeleton does not match the motion library");
  const legs = ["Left","Right"].map(side => ["UpLeg","Leg","Foot"].map(name => bones[names.indexOf(side+name)]));
  const wrist = bones[names.indexOf("RightHand")];
  const a = new T.Quaternion(), b = new T.Quaternion(), parentQ = new T.Quaternion();
  const p = new T.Vector3(), q = new T.Vector3(), hip = new T.Vector3(), knee = new T.Vector3(), ankle = new T.Vector3();
  const target = new T.Vector3(), bend = new T.Vector3(), direction = new T.Vector3(), footQ = new T.Quaternion();

  function aim(bone: T.Bone, from: T.Vector3, to: T.Vector3) {
    a.setFromUnitVectors(from.normalize(), to.normalize());
    bone.getWorldQuaternion(b);
    bone.parent!.getWorldQuaternion(parentQ).invert();
    bone.quaternion.copy(parentQ.multiply(a).multiply(b));
    bone.updateWorldMatrix(false, false);
  }

  // A stance foot travels backwards in body space at court speed. The other
  // foot swings forwards with a lifted toe. Solve two rigid limb segments.
  function step(leg: T.Bone[], side: number, pose: AthletePose, blend: number) {
    const [thigh, shin, foot] = leg;
    thigh.getWorldPosition(hip); shin.getWorldPosition(knee); foot.getWorldPosition(ankle);
    foot.getWorldQuaternion(footQ);
    const speed = Math.hypot(pose.vx, pose.vz);
    const stride = 1.12;
    const phase = ((pose.distance / stride + side * .5) % 1 + 1) % 1;
    const swing = Math.max(0,(phase-.5)*2);
    const offset = phase < .5 ? .25-phase : -.25+.5*swing*swing*(3-2*swing);
    target.copy(ankle);
    // Resolve the target in court space, then account for a transformed parent.
    group.parent!.worldToLocal(target);
    target.x += pose.vx / speed * stride * offset * blend;
    target.z += pose.vz / speed * stride * offset * blend;
    target.y += (Math.sin(Math.PI*swing)*.145 - .025) * blend;
    group.parent!.localToWorld(target);
    const upper = hip.distanceTo(knee), lower = knee.distanceTo(ankle);
    direction.copy(target).sub(hip);
    const reach = T.MathUtils.clamp(direction.length(), Math.abs(upper-lower)+.001, upper+lower-.001);
    direction.normalize();
    bend.copy(knee).sub(hip);
    bend.addScaledVector(direction,-bend.dot(direction)).normalize();
    const along = (upper*upper-lower*lower+reach*reach)/(2*reach);
    bend.multiplyScalar(Math.sqrt(Math.max(0,upper*upper-along*along))).addScaledVector(direction,along);
    aim(thigh,p.copy(knee).sub(hip),q.copy(bend));
    shin.getWorldPosition(knee); foot.getWorldPosition(ankle);
    aim(shin,p.copy(ankle).sub(knee),q.copy(target).sub(knee));
    foot.quaternion.copy(shin.getWorldQuaternion(parentQ).invert().multiply(footQ));
  }

  function pose(input: AthletePose) {
    const {weight, alpha, a: first, b: last} = recordedSample(input.stroke, input.relativeTime);
    const idle = 1-weight;
    group.position.set(input.x, 0, input.z);
    group.rotation.y = input.yaw;
    stance.rotation.y = neutralYaw * idle;
    stance.position.set(-readyHip[0], 0, -readyHip[2]).applyQuaternion(stance.quaternion).multiplyScalar(idle);
    stance.position.y = (.061 * input.split - .033 * Math.sin(Math.PI*input.split)) * idle;
    for (let i = 0; i < bones.length; i++) {
      a.fromArray(first.b[i]).slerp(b.fromArray(last.b[i]),alpha);
      bones[i].quaternion.fromArray(recordedReady.b[i]).slerp(a,weight);
    }
    p.fromArray(first.h).lerp(q.fromArray(last.h),alpha);
    bones[0].position.fromArray(recordedReady.h).lerp(p,weight);
    const speed = Math.hypot(input.vx, input.vz);
    const walking = Math.min(1, speed/.85)*idle;
    if (walking > .001 && group.parent) legs.forEach((leg, side) => step(leg, side, input, walking));
    wrist.getWorldPosition(p);
    stance.worldToLocal(p);
    a.fromArray(first.q).slerp(b.fromArray(last.q),alpha);
    racket.quaternion.fromArray(recordedReady.q).slerp(a,weight);
    racket.position.copy(p).add(q.set(.065,.39,.02).applyQuaternion(racket.quaternion));
  }
  return {group, racket, pose, dispose() {
    racket.traverse(o => { if (o instanceof T.Mesh) o.geometry.dispose(); });
    body.traverse(o => { if (o instanceof T.SkinnedMesh) { o.geometry.dispose(); o.material.dispose(); o.skeleton.dispose(); } });
  }};
}
