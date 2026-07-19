#!/usr/bin/env python3
"""
Build step: minify the code we actually author (index.html, css/, js/main.js)
into docs/, which is what GitHub Pages serves. vendor/ is third-party and
copied through verbatim — if a vendored file needs to be smaller, replace it
with an official minified build rather than minifying it here.

One-time setup:  pip install -r requirements-build.txt
Run it:          python build.py   (or ./build.sh)
"""
import re
import shutil
import sys
from pathlib import Path

try:
    import rcssmin
    import rjsmin
except ImportError:
    sys.exit(
        "Missing build dependencies. Run:\n"
        "  pip install -r requirements-build.txt"
    )

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "docs"

JS_FILES = ["js/main.js"]
CSS_FILES = ["css/style.css"]
COPY_FILES = ["CNAME", "og.jpg"]
COPY_DIRS = ["fonts", "vendor"]  # third-party / binary — copied as-is, never minified here


def minify_html(src: str) -> str:
    # strip single-line HTML comments (this file has no multi-line ones)
    src = re.sub(r"<!--.*?-->", "", src)
    # drop leading/trailing whitespace per line and blank lines; every tag
    # in this file is single-line, so trimming line edges never touches an
    # attribute value or joins two words together
    lines = [ln.strip() for ln in src.splitlines()]
    return "\n".join(ln for ln in lines if ln) + "\n"


def write(path: Path, content: str | bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = "wb" if isinstance(content, bytes) else "w"
    kwargs = {} if isinstance(content, bytes) else {"encoding": "utf-8"}
    with open(path, mode, **kwargs) as f:
        f.write(content)


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()

    totals = [0, 0]

    def report(label, before, after):
        totals[0] += before
        totals[1] += after
        pct = 100 * (1 - after / before) if before else 0
        print(f"  {label:<55} {before:>9,} -> {after:>9,}  ({pct:4.1f}% smaller)")

    print("Minifying JS...")
    for rel in JS_FILES:
        src_path = ROOT / rel
        src = src_path.read_text(encoding="utf-8")
        out = rjsmin.jsmin(src)
        write(OUT / rel, out)
        report(rel, len(src.encode("utf-8")), len(out.encode("utf-8")))

    print("Minifying CSS...")
    for rel in CSS_FILES:
        src_path = ROOT / rel
        src = src_path.read_text(encoding="utf-8")
        out = rcssmin.cssmin(src)
        write(OUT / rel, out)
        report(rel, len(src.encode("utf-8")), len(out.encode("utf-8")))

    print("Minifying HTML...")
    for rel in ["index.html"]:
        src_path = ROOT / rel
        src = src_path.read_text(encoding="utf-8")
        out = minify_html(src)
        write(OUT / rel, out)
        report(rel, len(src.encode("utf-8")), len(out.encode("utf-8")))

    print("Copying static assets...")
    for rel in COPY_FILES:
        shutil.copyfile(ROOT / rel, OUT / rel)
        print(f"  {rel}")
    for rel in COPY_DIRS:
        shutil.copytree(ROOT / rel, OUT / rel)
        print(f"  {rel}/")

    # skip Jekyll processing on GitHub Pages — serve docs/ as plain static files
    (OUT / ".nojekyll").touch()

    b, a = totals
    print(f"\nTotal minified JS+CSS+HTML: {b:,} -> {a:,} bytes ({100*(1-a/b):.1f}% smaller)")
    print(f"Build written to {OUT}")
    print("Review with `git status`, then commit + push docs/ to deploy.")


if __name__ == "__main__":
    main()
