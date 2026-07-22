#!/usr/bin/env python3
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import urllib.request
from pathlib import Path

GDAC = "https://data-argo.ifremer.fr"
INDEX = f"{GDAC}/ar_index_global_prof.txt"


def choose_profiles(text: str, since: str, until: str, limit: int) -> list[dict]:
    since_compact = since.replace("-", "")
    until_compact = until.replace("-", "")
    selected = []
    seen_floats = set()
    for raw in reversed(text.splitlines()):
        if not raw or raw.startswith("#"):
            continue
        fields = raw.split(",")
        if len(fields) < 4:
            continue
        file, date, latitude, longitude, *_rest = fields
        try:
            lat, lon = float(latitude), float(longitude)
        except ValueError:
            continue
        float_id = file.split("/")[1] if "/" in file else file
        if not (since_compact <= date[:8] <= until_compact) or not (45 <= lat <= 65 and -60 <= lon <= -10) or float_id in seen_floats:
            continue
        selected.append({"file": file, "date": date, "latitude": lat, "longitude": lon, "url": f"{GDAC}/dac/{file}"})
        seen_floats.add(float_id)
        if len(selected) >= limit:
            break
    return list(reversed(selected))


def main() -> None:
    parser = argparse.ArgumentParser(description="Download a bounded, reproducible Argo sample")
    parser.add_argument("--since", default="2026-05-01")
    parser.add_argument("--until", default="2026-06-30")
    parser.add_argument("--limit", type=int, default=12)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    destination = Path(args.output)
    raw_dir = destination / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(INDEX, timeout=120) as response:
        index_text = response.read().decode("utf-8", errors="replace")
    manifest = choose_profiles(index_text, args.since, args.until, args.limit)

    def download(record: dict) -> dict:
        target = raw_dir / Path(record["file"]).name
        if not target.exists() or target.stat().st_size == 0:
            with urllib.request.urlopen(record["url"], timeout=30) as response:
                target.write_bytes(response.read())
        return {**record, "local": str(target), "bytes": target.stat().st_size}

    with ThreadPoolExecutor(max_workers=6) as pool:
        completed = list(pool.map(download, manifest))
    (destination / "manifest.json").write_text(json.dumps({
        "index": INDEX, "bounds": [45, -60, 65, -10], "since": args.since,
        "until": args.until, "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "profiles": completed,
    }, indent=2) + "\n")
    print(json.dumps({"profiles": len(completed), "manifest": str(destination / "manifest.json")}))


if __name__ == "__main__":
    main()
