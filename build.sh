#!/usr/bin/env bash
# Regenerate docs/ (the minified, production build GitHub Pages serves)
# from the source files in this directory. Source files are never modified.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi

"$PY" build.py
