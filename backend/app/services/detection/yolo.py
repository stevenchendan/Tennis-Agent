"""YOLO detection wrappers (lazy imports so the API boots without torch).

Two detectors:
    - PlayerDetector: any COCO-pretrained ultralytics model (person class)
    - BallDetector:   custom tennis-ball weights (TENNIS_BALL_MODEL_PATH)

Also provides frame iteration with cv2 (streaming, not load-all-to-RAM)
and the court keypoint wrapper when TENNIS_COURT_MODEL_PATH is set.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from app.core.config import Settings
from app.domain.events import Bbox, FrameDetections

log = logging.getLogger(__name__)

PERSON_CLASS = 0  # COCO


class ModelNotConfigured(RuntimeError):
    pass


@dataclass
class VideoMeta:
    fps: float
    n_frames: int
    width: int
    height: int


def read_video_meta(path: Path) -> VideoMeta:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"cannot open video: {path}")
    try:
        return VideoMeta(
            fps=float(cap.get(cv2.CAP_PROP_FPS)) or 25.0,
            n_frames=int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
            width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        )
    finally:
        cap.release()


def iter_frames(path: Path, stride: int = 1) -> Iterator[tuple[int, "np.ndarray"]]:
    """Stream (frame_index, image) pairs; `stride` skips frames."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"cannot open video: {path}")
    idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                return
            if idx % stride == 0:
                yield idx, frame
            idx += 1
    finally:
        cap.release()


def plausible_ball_bbox(bbox: Bbox, s: Settings) -> bool:
    x1, y1, x2, y2 = bbox
    w, h = x2 - x1, y2 - y1
    if not (s.ball_min_size <= w <= s.ball_max_size and s.ball_min_size <= h <= s.ball_max_size):
        return False
    ar = w / h if h > 0 else 0
    return s.ball_aspect_min <= ar <= s.ball_aspect_max


class PlayerDetector:
    def __init__(self, model_path: str):
        from ultralytics import YOLO  # lazy: torch is heavy

        self.model = YOLO(model_path)

    def detect(self, frame: np.ndarray, conf: float) -> dict[int, Bbox]:
        results = self.model.predict(frame, conf=conf, verbose=False, classes=[PERSON_CLASS])[0]
        out: dict[int, Bbox] = {}
        for box in results.boxes:
            # prefer track ids when ultralytics tracking is enabled upstream
            tid = int(box.id[0]) if box.id is not None else len(out) + 1
            out[tid] = tuple(float(v) for v in box.xyxy.tolist()[0])  # type: ignore[index]
        return out


class BallDetector:
    def __init__(self, model_path: str):
        from ultralytics import YOLO

        self.model = YOLO(model_path)

    def detect(self, frame: np.ndarray, conf: float, settings: Settings) -> Bbox | None:
        results = self.model.predict(frame, conf=conf, verbose=False)[0]
        best, best_conf = None, 0.0
        for box in results.boxes:
            bbox = tuple(float(v) for v in box.xyxy.tolist()[0])  # type: ignore[index]
            if not plausible_ball_bbox(bbox, settings):  # type: ignore[arg-type]
                continue
            c = float(box.conf[0])
            if c > best_conf:
                best, best_conf = bbox, c
        return best


def detect_frames(
    video_path: Path,
    settings: Settings,
    on_progress=None,
) -> tuple[list[FrameDetections], VideoMeta]:
    """Run player+ball detection over the video, filling pixel detections."""
    if not settings.ball_model_path:
        raise ModelNotConfigured(
            "TENNIS_BALL_MODEL_PATH is not set. Add tennis-ball YOLO weights "
            "(see README) or use demo mode."
        )
    meta = read_video_meta(video_path)
    players = PlayerDetector(settings.player_model_path)
    ball = BallDetector(settings.ball_model_path)

    frames: list[FrameDetections] = []
    for idx, frame in iter_frames(video_path):
        pdet = players.detect(frame, settings.player_conf)
        bdet = ball.detect(frame, settings.ball_conf, settings)
        frames.append(
            FrameDetections(frame=idx, players=pdet, ball=bdet)
        )
        if on_progress and idx % 50 == 0:
            on_progress(idx, meta.n_frames)
    return frames, meta


class CourtKeypointDetector:
    """ResNet court keypoint model (14 keypoints), matching the common
    tennis court keypoint conventions used by public court-detection repos."""

    def __init__(self, weights_path: str):
        import torch
        from torchvision import models, transforms

        self.torch = torch
        self.model = models.resnet50(weights=None)
        self.model.fc = torch.nn.Linear(self.model.fc.in_features, 14 * 2)
        state = torch.load(weights_path, map_location="cpu", weights_only=True)
        self.model.load_state_dict(state)
        self.model.eval()
        self.transform = transforms.Compose(
            [
                transforms.ToPILImage(),
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )

    def predict(self, frame: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        tensor = self.transform(rgb).unsqueeze(0)
        with self.torch.no_grad():
            out = self.model(tensor)
        kps = out.squeeze().cpu().numpy()
        h, w = frame.shape[:2]
        kps[::2] *= w / 224.0
        kps[1::2] *= h / 224.0
        return kps
