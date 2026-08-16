"""Quick E2E check against a running backend (used for setup verification)."""

import json
import sys
import time
import urllib.request

BASE = "http://localhost:8000"


def req(path, data=None):
    r = urllib.request.Request(
        BASE + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type": "application/json"},
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read())


health = req("/api/health")
print("health:", health)

created = req("/api/analyses", {"mode": "demo"})
aid = created["analysis_id"]
print("created:", aid)

for _ in range(40):
    job = req(f"/api/analyses/{aid}")
    if job["status"] in ("done", "failed"):
        break
    time.sleep(1)

print("status:", job["status"], "error:", job.get("error"))
for st in job["stages"]:
    print(f"  stage {st['name']:<8} {st['status']:<8} {st['detail'][:60]}")

if job["status"] == "done":
    r = job["result"]
    print("rallies:", len(r["rallies"]), "patterns:", len(r["patterns"]))
    print("report by:", r["report_generated_by"], "| first line:", (r["report"] or "").splitlines()[0])
    print("top patterns:")
    for p in r["patterns"][:5]:
        print("   -", p["code"], f"(support={p['support']}, conf={p['confidence']})")
    chat = req(f"/api/analyses/{aid}/chat", {"message": "发球哪个方向最有效？"})
    print("chat:", chat["answer"][:100])
    sys.exit(0)
sys.exit(1)
