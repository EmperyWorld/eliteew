#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Vendor EWRP slide HTML fonts into api/static/ewrp for offline Playwright PDF render.
# Invariants:
# - No Google Fonts CDN at runtime; fonts.css uses relative fonts/ URLs.
# Related:
# - api/services/ewrp_font_assets.py
# - api/services/ewrp_templates.py
# ---

from __future__ import annotations

import re
import urllib.request
from pathlib import Path

STATIC = Path(__file__).resolve().parent
FONTS = STATIC / "fonts"
GOOGLE_CSS = (
    "https://fonts.googleapis.com/css2?"
    "family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500"
    "&family=Inter:wght@400;500;600;700"
    "&family=IBM+Plex+Mono:wght@500;600;700"
    "&family=IBM+Plex+Sans:wght@400;500;600;700"
    "&family=Playfair+Display:wght@500;600;700"
    "&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400"
    "&display=swap"
)


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "EliteEW-ewrp-font-vendor/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def parse_font_faces(css: str) -> list[dict[str, str | int]]:
    blocks = re.findall(r"@font-face\s*\{([^}]+)\}", css, re.DOTALL)
    faces: list[dict[str, str | int]] = []
    for block in blocks:
        family_m = re.search(r"font-family:\s*['\"]?([^;'\"]+)", block)
        weight_m = re.search(r"font-weight:\s*(\d+)", block)
        style_m = re.search(r"font-style:\s*([a-z]+)", block, re.IGNORECASE)
        url_m = re.search(r"url\((https://[^)]+)\)", block)
        if not (family_m and weight_m and url_m):
            continue
        faces.append(
            {
                "family": family_m.group(1).strip().strip("'\""),
                "weight": int(weight_m.group(1)),
                "style": (style_m.group(1).lower() if style_m else "normal"),
                "url": url_m.group(1),
            }
        )
    return faces


def vendor_fonts() -> None:
    FONTS.mkdir(parents=True, exist_ok=True)
    css_text = fetch(GOOGLE_CSS).decode("utf-8")
    faces = parse_font_faces(css_text)
    if not faces:
        msg = "Google Fonts CSS returned no @font-face blocks; check network / User-Agent"
        raise RuntimeError(msg)

    css_lines = [
        "/* EliteEW EWRP — local fonts (offline PDF render). "
        "Regenerate: python3 shared/api/static/ewrp/vendor_ewrp_fonts.py */"
    ]
    seen: set[str] = set()
    for face in faces:
        family_slug = str(face["family"]).lower().replace(" ", "-")
        weight = int(face["weight"])
        style = str(face["style"] or "normal")
        style_slug = "" if style == "normal" else f"-{style}"
        filename = f"{family_slug}-{weight}{style_slug}.ttf"
        if filename in seen:
            continue
        seen.add(filename)
        dest = FONTS / filename
        dest.write_bytes(fetch(str(face["url"])))
        css_lines.append(
            f"@font-face {{\n"
            f'  font-family: "{face["family"]}";\n'
            f"  font-style: {style};\n"
            f"  font-weight: {weight};\n"
            f"  font-display: swap;\n"
            f'  src: url("fonts/{filename}") format("truetype");\n'
            f"}}"
        )

    (STATIC / "fonts.css").write_text("\n\n".join(css_lines) + "\n", encoding="utf-8")
    print(f"Fonts: {len(seen)} files → {FONTS}")
    print(f"CSS → {STATIC / 'fonts.css'}")


if __name__ == "__main__":
    vendor_fonts()
    print("Done. EWRP HTML can render offline via file:// with staged fonts/.")
