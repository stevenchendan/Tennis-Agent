"""从开放归档下载巡回赛原始 CSV（可断点续传、按需增量）。

归档布局（Sackmann 格式，源自官方记分数据）：
  {tour}_matches_{year}.csv           主巡回赛正赛（大满贯/ATP/WTA/戴维斯杯/联合会杯/奥运）
  atp_matches_qual_chall_{year}.csv   ATP 资格赛 + 挑战赛
  wta_matches_qual_itf_{year}.csv     WTA 资格赛 + ITF（含低级别巡回赛）
  {tour}_players.csv                  球员资料（惯用手/生日/身高/国籍）
  {tour}_rankings_current.csv         近期周级排名
  {tour}_rankings_20s.csv             2020 年代历史排名（算生涯峰值用）
"""

from __future__ import annotations

import datetime as dt
import logging
import urllib.request
from pathlib import Path

log = logging.getLogger(__name__)

# 归档基址；上游若失效可整体替换为任意保持相同布局的镜像。
ARCHIVE_BASE = "https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main"

# 低级别赛事（挑战赛/ITF/资格赛）从哪一年开始摄取——更早的对现役球探价值低。
SECONDARY_FROM_YEAR = 2015

TOURS = ("atp", "wta")
_TIMEOUT = 60


def _urls_for_year(tour: str, year: int) -> list[tuple[str, str]]:
    """返回 [(相对路径, 本地文件名)]。"""
    out = [f"{tour}/{tour}_matches_{year}.csv"]
    if year >= SECONDARY_FROM_YEAR:
        secondary = "qual_chall" if tour == "atp" else "qual_itf"
        out.append(f"{tour}/{tour}_matches_{secondary}_{year}.csv")
    return [(rel, rel.replace("/", "__")) for rel in out]


def _static_files(tour: str) -> list[tuple[str, str]]:
    files = [
        (f"{tour}/{tour}_players.csv", f"{tour}__{tour}_players.csv"),
        (f"{tour}/{tour}_rankings_current.csv", f"{tour}__{tour}_rankings_current.csv"),
    ]
    # 2000 年以来的周级排名（算生涯峰值）；年代更早的排名对现役球探无意义。
    for decade in ("00s", "10s", "20s"):
        files.append((f"{tour}/{tour}_rankings_{decade}.csv", f"{tour}__{tour}_rankings_{decade}.csv"))
    return files


def required_files(current_year: int | None = None) -> list[str]:
    """全量同步需要的所有本地文件名（相对路径已折叠为 `__`）。"""
    year = current_year or dt.date.today().year
    names: list[str] = []
    for tour in TOURS:
        for y in range(1968, year + 1):
            names.extend(local for _, local in _urls_for_year(tour, y))
        names.extend(local for _, local in _static_files(tour))
    names.append("atp/matches_data_dictionary.txt".replace("/", "__"))
    return names


def _download(url: str, dest: Path) -> tuple[bool, int]:
    """下载单个文件；已存在且非空则跳过。返回 (下载了没有, 字节数)。"""
    if dest.exists() and dest.stat().st_size > 0:
        return False, dest.stat().st_size
    req = urllib.request.Request(url, headers={"User-Agent": "Tennis-Agent/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp, dest.open("wb") as f:
            f.write(resp.read())
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    return True, dest.stat().st_size


def sync(raw_dir: Path, force: bool = False) -> dict:
    """下载全部原始 CSV 到 raw_dir。返回统计信息。

    force=True 时先清空再下载（上游是全量快照，无增量补丁）。
    """
    raw_dir.mkdir(parents=True, exist_ok=True)
    year = dt.date.today().year
    if force:
        for p in raw_dir.glob("*.csv"):
            p.unlink()

    jobs: list[tuple[str, str]] = []  # (远端相对路径, 本地名)
    for tour in TOURS:
        for y in range(1968, year + 1):
            jobs.extend(_urls_for_year(tour, y))
        jobs.extend(_static_files(tour))
    jobs.append(("atp/matches_data_dictionary.txt", "atp__matches_data_dictionary.txt"))

    downloaded, skipped, failed, total_bytes = 0, 0, 0, 0
    for rel, local in jobs:
        url = f"{ARCHIVE_BASE}/{rel}"
        dest = raw_dir / local
        try:
            got, size = _download(url, dest)
        except Exception as e:  # noqa: BLE001
            log.warning("download failed: %s (%s)", rel, e)
            failed += 1
            continue
        total_bytes += size
        if got:
            downloaded += 1
            log.info("fetched %s (%.1f KB)", rel, size / 1024)
        else:
            skipped += 1
    return {
        "downloaded": downloaded,
        "skipped": skipped,
        "failed": failed,
        "total_mb": round(total_bytes / 1e6, 1),
        "files": len(jobs),
    }
