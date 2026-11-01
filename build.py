# SPDX-License-Identifier: GPL-3.0-or-later
"""Build the portable single-file QuickerStrut&Tie HTML from app/.

    python build.py            # writes QuickerStrut-Tie-v<version>-<date>.html
    python build.py --check    # fails if the committed portable file is stale
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"


def meta():
    text = (APP / "js" / "version.js").read_text(encoding="utf-8")
    version = re.search(r"version:\s*'([^']+)'", text).group(1)
    date = re.search(r"date:\s*'([^']+)'", text).group(1)
    return version, date


def build():
    html = (APP / "index.html").read_text(encoding="utf-8")

    def css(match):
        path = APP / match.group(1)
        return "<style>\n" + path.read_text(encoding="utf-8") + "\n</style>"

    def js(match):
        path = APP / match.group(1)
        code = path.read_text(encoding="utf-8").replace("</script", "<\\/script")
        return f"<script>/* {match.group(1)} */\n{code}\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="\./([^"]+)">', css, html)
    # Deferred scripts run after parsing: inline them at the end of <body>
    # in the same order so the DOM exists when they execute.
    scripts = re.findall(r'<script src="\./([^"]+)" defer></script>\n?', html)
    html = re.sub(r'\s*<script src="\./[^"]+" defer></script>', "", html)
    inline = "\n".join(js(re.match(r"(.*)", s)) for s in scripts)
    html = html.replace("</body>", inline + "\n</body>")
    if re.search(r'(src|href)="\./', html):
        raise SystemExit("unresolved local reference in the portable HTML")
    return html


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    version, date = meta()
    out = ROOT / f"QuickerStrut-Tie-v{version}-{date}.html"
    html = build()
    if args.check:
        if not out.exists() or out.read_text(encoding="utf-8") != html:
            print(f"{out.name} is missing or stale: run python build.py", file=sys.stderr)
            return 1
        print(f"{out.name} is up to date ({len(html) // 1024} KiB)")
        return 0
    for old in ROOT.glob("QuickerStrut-Tie-v*.html"):
        if old != out:
            old.unlink()
    out.write_text(html, encoding="utf-8", newline="\n")
    print(f"wrote {out.name} ({len(html) // 1024} KiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
