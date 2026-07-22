#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from amoc_watch.netcdf_io import read_argo_profile
from amoc_watch.profiles import aggregate_month, reduce_profile


def main() -> None:
    parser = argparse.ArgumentParser(description="Reduce Argo NetCDF profiles to AMOC Watch monthly indices")
    parser.add_argument("inputs", nargs="+", help="Argo multi-profile NetCDF files")
    parser.add_argument("--output", required=True, help="Destination JSON snapshot")
    args = parser.parse_args()
    metrics = []
    rejected = []
    for source in args.inputs:
        for profile in read_argo_profile(source):
            try:
                metrics.append(reduce_profile(profile))
            except ValueError as error:
                rejected.append({"profile_id": profile.profile_id, "reason": str(error)})
    grouped = {}
    for metric in metrics:
        grouped.setdefault(metric.month, []).append(metric)
    payload = {"schema_version": "1.0", "accepted_profiles": len(metrics), "rejected_profiles": rejected, "months": [aggregate_month(grouped[month]) for month in sorted(grouped)]}
    Path(args.output).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
