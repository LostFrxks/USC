#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _staged_files() -> list[str]:
    out = subprocess.check_output(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        cwd=ROOT,
        text=True,
    )
    return [line.strip().replace("\\", "/") for line in out.splitlines() if line.strip()]


def _is_generated(path: str) -> bool:
    if path.startswith(".serena/"):
        return True
    if path.startswith(".venv/") or "/.venv/" in path:
        return True
    if path.startswith("backend/.venv/"):
        return True
    if "/__pycache__/" in path or path.startswith("__pycache__/"):
        return True
    if path.endswith(".pyc") or path.endswith(".tsbuildinfo"):
        return True
    return False


def main() -> int:
    bad = [p for p in _staged_files() if _is_generated(p)]
    if not bad:
        print("OK: no generated artifacts staged")
        return 0

    print("Blocked generated artifacts in staged changes:")
    for item in bad[:200]:
        print(f"- {item}")
    if len(bad) > 200:
        print(f"... and {len(bad) - 200} more")
    print("")
    print("Unstage/remove them from index before commit.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
