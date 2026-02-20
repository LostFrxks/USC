#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INCLUDE_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".yml", ".yaml"}
SKIP_PARTS = {".git", ".venv", ".venv_local", "node_modules", "__pycache__", "dist", "build"}
MOJIBAKE_MARKERS = (
    "Рџ",
    "РЎ",
    "С‚",
    "Сѓ",
    "вЂ",
    "Ð",
    "Ñ",
)


def should_scan(path: Path) -> bool:
    if path.suffix.lower() not in INCLUDE_SUFFIXES:
        return False
    parts = set(path.parts)
    if any(skip in parts for skip in SKIP_PARTS):
        return False
    if path.match("scripts/check_encoding.py"):
        return False
    return True


def safe_preview(text: str) -> str:
    return text.encode("unicode_escape", errors="ignore").decode("ascii")[:220]


def main() -> int:
    bad: list[tuple[Path, int, str]] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or not should_scan(path):
            continue
        try:
            data = path.read_bytes()
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            bad.append((path, 0, "<non-utf8 file>"))
            continue

        for i, line in enumerate(text.splitlines(), start=1):
            if any(marker in line for marker in MOJIBAKE_MARKERS):
                bad.append((path, i, safe_preview(line.strip())))

    if not bad:
        print("OK: no mojibake/non-utf8 issues found")
        return 0

    print("Found possible encoding/mojibake issues:")
    for path, line_no, snippet in bad[:200]:
        print(f"- {path}:{line_no}: {snippet}")
    if len(bad) > 200:
        print(f"... and {len(bad)-200} more")
    return 1


if __name__ == "__main__":
    sys.exit(main())
