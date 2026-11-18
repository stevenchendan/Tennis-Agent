// Frames are in court space (metres, Y-up, forward along -Z). The short
// optical trials end at different phases. Continue their end pose on the
// captured forearm rather than freezing the racket in world space.
import * as T from "three";

export function calibrateRacket(reference, sourceContact, forearmAt) {
  const { rotations, hz, contact } = reference;
  const first = -contact / hz;
  const last = (rotations.length - 1 - contact) / hz;
  const startCarrier = forearmAt(sourceContact + first).invert().multiply(new T.Quaternion(...rotations[0]));
  const endCarrier = forearmAt(sourceContact + last).invert().multiply(new T.Quaternion(...rotations.at(-1)));
  const handInRacket = new T.Quaternion(...reference.handInRacket).normalize();
  function rotation(relative, forearm) {
    const frame = T.MathUtils.clamp(contact + relative * hz, 0, rotations.length - 1);
    const i = Math.floor(frame);
    const measured = new T.Quaternion(...rotations[i]).slerp(new T.Quaternion(...rotations[Math.min(i + 1, rotations.length - 1)]), frame - i);
    const before = relative < (first + last) / 2;
    const distance = before ? relative - first : last - relative;
    const blend = T.MathUtils.smoothstep(distance, 0, .055);
    if (blend === 1) return measured;
    return forearm.clone().multiply(before ? startCarrier : endCarrier).slerp(measured, blend);
  }
  return { handInRacket, rotation };
}
// Place the upper hand on the handle for a two-handed backhand. Preserve both
// bone lengths and use the captured elbow as the pole of the two-link solve.
export function placeSupportHand(upper, lower, hand, target, rotation) {
  const at = bone => bone.getWorldPosition(new T.Vector3());
  let shoulder = at(upper), elbow = at(lower);
  const first = shoulder.distanceTo(elbow), second = elbow.distanceTo(at(hand));
  function aim(bone, from, to) {
    const delta = new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
    const parent = bone.parent.getWorldQuaternion(new T.Quaternion());
    bone.quaternion.copy(parent.invert().multiply(delta).multiply(bone.getWorldQuaternion(new T.Quaternion()))).normalize();
    bone.updateWorldMatrix(false,true);
  }
  // Protract the clavicle when the follow-through crosses the player's chest.
  // Rotate it by the smallest angle that lets the two arm bones reach.
  if (target.distanceTo(shoulder) > first + second - .003) {
    const collar = upper.parent, base = at(collar);
    const shoulderAxis = shoulder.clone().sub(base);
    const targetAxis = target.clone().sub(base);
    const length = shoulderAxis.length(), distance = targetAxis.length();
    shoulderAxis.normalize();
    targetAxis.normalize();
    const projection = T.MathUtils.clamp((distance**2 + length**2 - (first+second-.003)**2)/(2*distance*length), -1, 1);
    const side = shoulderAxis.clone().addScaledVector(targetAxis,-shoulderAxis.dot(targetAxis)).normalize();
    const goal = targetAxis.multiplyScalar(projection).addScaledVector(side,Math.sqrt(1-projection**2));
    aim(collar, shoulderAxis, goal);
    shoulder = at(upper); elbow = at(lower);
  }
  const line = target.clone().sub(shoulder);
  const reach = T.MathUtils.clamp(line.length(), Math.abs(first-second)+.0001, first+second-.0001);
  line.normalize();
  const pole = elbow.clone().sub(shoulder);
  pole.addScaledVector(line, -pole.dot(line)).normalize();
  const along = (first**2-second**2+reach**2)/(2*reach);
  const bend = line.clone().multiplyScalar(along).addScaledVector(pole, Math.sqrt(Math.max(0,first**2-along**2)));
  const goalWrist = shoulder.clone().addScaledVector(line, reach);
  aim(upper, elbow.clone().sub(shoulder), bend);
  const newElbow = at(lower);
  aim(lower, at(hand).sub(newElbow), goalWrist.sub(newElbow));
  hand.quaternion.copy(lower.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation)).normalize();
  hand.updateWorldMatrix(false,true);
}
