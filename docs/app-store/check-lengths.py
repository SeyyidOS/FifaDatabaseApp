#!/usr/bin/env python3
"""Counts the listing's fields in listing.md against App Store Connect's limits.

    python3 docs/app-store/check-lengths.py

A field is the indented block under a bold label that names its limit, e.g. "**Subtitle** (30 max)".
"""

import re
import sys
from pathlib import Path

text = (Path(__file__).parent / "listing.md").read_text(encoding="utf-8")
failed = False
for label, limit, block in re.findall(r"\*\*(.+?)\*\* \((\d+) max[^)]*\)\n\n((?:    .*\n|\n)+)", text):
    value = "\n".join(line[4:] for line in block.rstrip("\n").split("\n"))
    count = len(value)
    ok = count <= int(limit)
    failed |= not ok
    print(f"{'ok ' if ok else 'TOO LONG'} {count:>5}/{limit:<5} {label}")
    if label.lower().startswith(("keywords", "anahtar")) and re.search(r"\s,|,\s", value):
        print("         spaces around the commas count against the limit: leave them out")
        failed = True
sys.exit(1 if failed else 0)
