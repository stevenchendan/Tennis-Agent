import * as T from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import names from "./rig-bones.json";
import grip from "./racket-grip.json";
import { recordedReady, recordedSample, readySocket } from "../drills/recorded-motion";
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

const readyHip = recordedReady.j[0];
const neutralYaw = Math.atan2(recordedReady.j[7][2]-recordedReady.j[4][2], recordedReady.j[7][0]-recordedReady.j[4][0]);

export function createAthlete(source: T.Group, equipment: T.Group, color: string) {
  const body = clone(source), racket = makeRacket(equipment);
  const group = new T.Group(), stance = new T.Group();
  stance.add(body);
  group.add(stance);
  body.updateWorldMatrix(true, true);
  const teamMaterials: T.Material[]=[];
  body.traverse(part => {
    if (part instanceof T.SkinnedMesh) {
      if (part.material.name==="Jersey") {
        const jersey=part.material.clone() as T.MeshStandardMaterial;
        jersey.color.set(color);
        part.material=jersey;
        teamMaterials.push(jersey);
      }
      part.frustumCulled = false;
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  const bones = names.map(name => body.getObjectByName(name) as T.Bone);
  if (bones.some(bone => !bone?.isBone)) throw new Error("Athlete skeleton does not match the motion library");
  const legs = ["Left","Right"].map(side => ["UpLeg","Leg","Foot"].map(name => bones[names.indexOf(side+name)]));
  const wrist = bones[names.indexOf("RightHand")];
  // The socket is rigid in the palm even when the ready pose blends into a
  // stroke. Remove the imported skeleton's uniform unit conversion once.
  const mount = new T.Group();
  const inverseScale = new T.Vector3(1, 1, 1).divide(wrist.getWorldScale(new T.Vector3()));
  mount.scale.copy(inverseScale);
  mount.position.fromArray(grip.palm).multiply(inverseScale);
  racket.position.y = grip.centerFromPalm;
  wrist.add(mount);
  mount.add(racket);
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
    const {weight, alpha, socket, a: first, b: last} = recordedSample(input.stroke, input.relativeTime);
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
    mount.quaternion.fromArray(readySocket).slerp(a.fromArray(socket), weight);
  }
  return {group, racket, pose, dispose() {
    racket.traverse(o => { if (o instanceof T.Mesh) o.geometry.dispose(); });
    body.traverse(o => { if(o instanceof T.SkinnedMesh) o.skeleton.dispose(); });
    teamMaterials.forEach(material=>material.dispose());
  }};
}
