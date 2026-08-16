"""Multimodal LLM review: sampled video frames -> coach review report.

Fallback engine for YouTube review when no YOLO weights are configured:
frames are sampled evenly across the video, downscaled, and sent as
image inputs to the chat model (must be vision-capable; gpt-4o-mini is).
Unlike the text report path there is no heuristic fallback -- the report
is the only output of this engine, so failures bubble up as job errors.
"""

from __future__ import annotations

import base64
import logging
from pathlib import Path

from app.core.config import Settings
from app.services.llm.chains import get_chat_model

log = logging.getLogger(__name__)

MAX_FRAME_WIDTH = 768
JPEG_QUALITY = 70

SYSTEM = """你是一位职业网球教练，正在为学员复盘他自己的比赛录像。
你会看到从整场比赛中均匀抽取的若干帧画面。请只基于画面中真实可见的内容写复盘报告，禁止编造看不到的细节（例如看不见的比分或球速）。
如果画面信息不足以判断某方面，就明确说"画面不足以判断"，不要猜测。
用 Markdown 输出，结构为：
## 比赛速览
## 技术亮点
## 战术问题
## 改进建议
## 接下来 2 周的训练重点
语气像教练在场边跟学员复盘：具体、可执行，不要营销腔。"""


def _sample_frames(video_path: Path, count: int) -> list[str]:
    """Evenly sample `count` frames as JPEG data URLs (downscaled)."""
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open downloaded video: {video_path.name}")
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total <= 0:
            raise RuntimeError("downloaded video has no readable frames")
        count = max(1, min(count, total))
        wanted = {round(i * (total - 1) / (count - 1)) for i in range(count)} if count > 1 else {0}

        urls: list[str] = []
        idx = 0
        while len(urls) < len(wanted):
            ok, frame = cap.read()
            if not ok:
                break
            if idx in wanted:
                h, w = frame.shape[:2]
                if w > MAX_FRAME_WIDTH:
                    scale = MAX_FRAME_WIDTH / w
                    frame = cv2.resize(frame, (MAX_FRAME_WIDTH, int(h * scale)))
                ok2, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                if ok2:
                    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
                    urls.append(f"data:image/jpeg;base64,{b64}")
            idx += 1
        return urls
    finally:
        cap.release()


def generate_review(video_path: Path, settings: Settings, title: str) -> str:
    """Run the vision review; returns the markdown report."""
    model = get_chat_model(settings)
    if model is None:
        raise RuntimeError("vision review needs TENNIS_OPENAI_API_KEY")

    urls = _sample_frames(video_path, settings.review_frame_count)
    if not urls:
        raise RuntimeError("could not extract any frames from the downloaded video")
    log.info("vision review: %s frames sampled from %s", len(urls), video_path.name)

    from langchain_core.messages import HumanMessage, SystemMessage

    content: list[dict] = [
        {"type": "text", "text": f"比赛视频标题：{title}。以下是从整场比赛均匀抽取的 {len(urls)} 帧："}
    ]
    content += [{"type": "image_url", "image_url": {"url": u}} for u in urls]
    resp = model.invoke([SystemMessage(content=SYSTEM), HumanMessage(content=content)])
    return str(resp.content)
