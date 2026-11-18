"""Extract racket orientation tracks from the attributed optical marker trials.

Run with NumPy, SciPy and c3d installed. Supply the directory containing the
four original tp1 ZIPs and bath-serve-data.zip listed in mocap/ATTRIBUTION.md.
Only the derived racket rotations and static grip calibration ship with the rig.
"""
import io
import json
import sys
import zipfile
from pathlib import Path

import c3d
import numpy as np
from scipy.io import loadmat
from scipy.spatial.transform import Rotation


def unit(v):
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def track(shaft, width, palm, hz, hit, forward, reflect, support=None):
    # Both laboratories use Z-up. Reflect a left-handed trial across the court
    # before reconstructing the frame to keep its rotation right-handed.
    def court(v):
        return np.column_stack((-forward * reflect * v[:, 1], v[:, 2], -forward * v[:, 0]))

    y = unit(court(shaft))
    normal = unit(np.cross(court(width), y))
    if normal[hit, 2] > 0:
        normal *= -1
    x = unit(np.cross(y, normal))
    frames = Rotation.from_matrix(np.stack((x, y, normal), axis=2))
    # A single grip per stroke. The measured wrist-to-knuckle direction fixes
    # palm inclination and roll while the thumb side points up the handle.
    def grip_for(knuckles, thumb_sign):
        local = frames.inv().apply(unit(court(knuckles)))
        direction = unit(np.median(local[max(0,hit-12):hit+13], axis=0))
        thumb = thumb_sign * unit(np.array([0., 1., 0.]) - direction * direction[1])
        grip = Rotation.from_matrix(np.column_stack((thumb, direction, np.cross(thumb, direction))))
        return grip.as_quat().round(7).tolist()
    quats = frames.as_quat()
    for i in range(1, len(quats)):
        if np.dot(quats[i], quats[i-1]) < 0:
            quats[i] *= -1
    result = dict(hz=hz, contact=hit, handInRacket=grip_for(palm, 1), rotations=quats.round(7).tolist())
    if support is not None:
        result["supportInRacket"] = grip_for(support, -1)
    return result


def ground(directory, code, trial, contact, mirror):
    with zipfile.ZipFile(directory / f"tp1_{code}.zip") as archive:
        data = archive.read(f"tp1_{code}/{trial}/tp1_{code}_{trial}.c3d")
    reader = c3d.Reader(io.BytesIO(data))
    names = [n.split(":")[-1].strip() for n in reader.point_labels]
    samples = np.stack([p.copy() for _, p, _ in reader.read_frames()])
    def point(name):
        rows = samples[:, names.index(name)]
        if np.any(rows[:, 3] < 0):
            raise ValueError(f"Missing {name} in {code}")
        return rows[:, :3]
    side = "L" if mirror else "R"
    wrist = (point(side+"WRA") + point(side+"WRB")) / 2
    base = point("RH6" if "RH6" in names else "Srodek")
    support = point("RFIN") - (point("RWRA") + point("RWRB")) / 2 if code == "bhb" else None
    return track(point("RH1") - base, point("RH4") - point("RH2"),
                 point(side+"FIN") - wrist, int(reader.point_rate), contact, -1, -1 if mirror else 1, support)


def service(directory):
    with zipfile.ZipFile(directory / "bath-serve-data.zip") as archive:
        trial = archive.read("Spatio-Temporal Serve Data/4D_4.mat")
    p = loadmat(io.BytesIO(trial))["Serves3D"].transpose(2, 0, 1)
    rim = (p[:, 1] + p[:, 2]) / 2
    palm = p[:, 40:44].mean(axis=1) - p[:, 37:40].mean(axis=1)
    return track(rim - p[:, 0], p[:, 2] - p[:, 1], palm, 180, 275, 1, 1)


if __name__ == "__main__":
    directory = Path(sys.argv[1])
    records = {
        "forehand": ground(directory, "fhb", "s8", 46, True),
        "backhand": ground(directory, "bhb", "s8", 35, True),
        "volley": ground(directory, "fhvb", "s1", 15, False),
        "backhand-volley": ground(directory, "bhvb", "s1", 14, False),
        "serve": service(directory),
    }
    out = Path(__file__).resolve().parents[1] / "public/models/tennis/mocap/racket-markers.json"
    out.write_text(json.dumps(records, separators=(",", ":")) + "\n", encoding="utf-8")