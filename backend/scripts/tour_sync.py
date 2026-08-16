"""巡回赛资料库同步：下载归档 CSV → 重建 SQLite。

用法：
    python scripts/tour_sync.py            # 增量下载（已存在文件跳过）+ 建库
    python scripts/tour_sync.py --force    # 全量重新下载
    python scripts/tour_sync.py --build-only
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.tour import db as tour_db  # noqa: E402
from app.tour import ingest  # noqa: E402


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="删除已下载 CSV 重下")
    parser.add_argument("--build-only", action="store_true", help="跳过下载，只重建数据库")
    args = parser.parse_args()

    settings = get_settings()
    raw_dir = settings.data_dir / "tour" / "raw"
    db_path = settings.data_dir / "tour" / tour_db.DB_NAME

    if not args.build_only:
        stats = ingest.sync(raw_dir, force=args.force)
        print(f"download: {stats}")
        if stats["failed"] > stats["files"] // 10:
            print("too many failed downloads; aborting build", file=sys.stderr)
            return 1

    stats = tour_db.build(db_path, raw_dir)
    print(f"build: {stats}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
