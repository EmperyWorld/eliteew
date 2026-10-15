#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Rebuild src-tauri/icons + public/brand-mark from EliteEW gold logo SoT.
# Invariants:
# - Tray/window (icon.png, 32×32, ico/icns): transparent logo — no solid black tray.
# - App-grid hicolor (48/64/96/128/256/512): soft ink plate so Fedora GNOME/KDE
#   show a visible launcher icon (fully transparent marks looked "unchanged"/blank).
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# - documentation/product/desktop/DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md
# ---
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export ROOT
cd "$ROOT"
MONOREPO="$(cd "$ROOT/../.." && pwd)"
# Real gold mark (transparent bg). Broken public/brand-mark.png was near-empty green noise.
SOT="${ELITEEW_ICON_SOT:-$MONOREPO/EliteEW/image/logo.png}"
ICONS="$ROOT/src-tauri/icons"
SRC="$ROOT/src-tauri/app-icon-src/logo.png"
test -f "$SOT"

python3 - <<'PY'
from pathlib import Path
from PIL import Image, ImageDraw
import os

root = Path(os.environ["ROOT"])
sot_path = Path(os.environ.get("ELITEEW_ICON_SOT", ""))
if not sot_path.is_file():
    sot_path = root.parent.parent / "EliteEW/image/logo.png"
    if not sot_path.is_file():
        sot_path = root.parent / "image/logo.png"
brand = Image.open(sot_path).convert("RGBA")


def fit_logo(size: int, fill: float = 0.78) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bw = max(1, int(size * fill))
    logo = brand.copy()
    logo.thumbnail((bw, bw), Image.Resampling.LANCZOS)
    ox = (size - logo.size[0]) // 2
    oy = (size - logo.size[1]) // 2
    canvas.alpha_composite(logo, (ox, oy))
    return canvas


def soft_plate(size: int) -> Image.Image:
    """Ink plate with rounded corners for DE app grids (not pure black square)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = max(1, size // 32)
    radius = max(4, size // 6)
    # Soft brand ink (matches launcher tokens), not #000.
    draw.rounded_rectangle(
        [pad, pad, size - pad - 1, size - pad - 1],
        radius=radius,
        fill=(12, 20, 32, 255),
        outline=(47, 64, 88, 255),
        width=max(1, size // 128),
    )
    return img


# Transparent SoT for tauri icon + tray (higher fill so 32px tray still reads)
master = fit_logo(1024, fill=0.92)
src = root / "src-tauri/app-icon-src/logo.png"
src.parent.mkdir(parents=True, exist_ok=True)
master.save(src, "PNG")
print(f"OK: transparent SoT {src}")

# Launcher webview mark
mark = fit_logo(512, fill=0.88)
mark.save(root / "public/brand-mark.png", "PNG")
print("OK: public/brand-mark.png")

# Export for later plate pass
master.save(root / "src-tauri/app-icon-src/logo-transparent.png", "PNG")
plated = soft_plate(1024)
logo_on_plate = fit_logo(1024, fill=0.72)
plated.alpha_composite(logo_on_plate)
plated.save(root / "src-tauri/app-icon-src/logo-apps-plate.png", "PNG")
print("OK: logo-apps-plate.png")
PY

export ELITEEW_ICON_SOT="$SOT"
pnpm exec tauri icon "$SRC"

for d in android ios; do
	if [[ -d "$ICONS/$d" ]]; then
		bash "$MONOREPO/scripts/eliteew/trash-move.sh" "$ICONS/$d"
	fi
done

python3 - <<'PY'
from pathlib import Path
from PIL import Image, ImageDraw
import os

root = Path(os.environ["ROOT"])
icons = root / "src-tauri/icons"
tray = Image.open(root / "src-tauri/app-icon-src/logo-transparent.png").convert("RGBA")
plate_src = Image.open(root / "src-tauri/app-icon-src/logo-apps-plate.png").convert("RGBA")

# Tray / window — keep transparent
for s in (32,):
    p = icons / f"{s}x{s}.png"
    tray.resize((s, s), Image.Resampling.LANCZOS).save(p, "PNG")
    print(f"OK: tray {p}")

# icon.png used by default_window_icon / tray — transparent
tray.resize((512, 512), Image.Resampling.LANCZOS).save(icons / "icon.png", "PNG")
print("OK: icons/icon.png (transparent tray)")

# App-grid sizes — soft plate (Fedora GNOME/KDE launcher)
for s in (48, 64, 96, 128, 256, 512):
    p = icons / f"{s}x{s}.png"
    plate_src.resize((s, s), Image.Resampling.LANCZOS).save(p, "PNG")
    print(f"OK: apps-plate {p}")

# 128@2x often used by bundler
p2 = icons / "128x128@2x.png"
plate_src.resize((256, 256), Image.Resampling.LANCZOS).save(p2, "PNG")
print(f"OK: {p2}")
PY

# Ensure tauri.conf lists 96
if ! grep -q 'icons/96x96.png' "$ROOT/src-tauri/tauri.conf.json"; then
	python3 - <<PY
from pathlib import Path
p = Path("$ROOT/src-tauri/tauri.conf.json")
t = p.read_text()
needle = '"icons/64x64.png",'
if needle in t and '"icons/96x96.png"' not in t:
    t = t.replace(needle, needle + "\n      \"icons/96x96.png\",", 1)
    p.write_text(t)
    print("OK: tauri.conf.json +96x96")
else:
    print("OK: tauri.conf.json 96 already present or pattern miss")
PY
fi

echo "OK: icons regenerated (transparent tray + plated app-grid)"
