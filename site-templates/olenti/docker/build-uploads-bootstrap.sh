#!/bin/sh
# Собирает дерево /uploads/* под URL из server/template-baseline.json (статический бутстрап в образе).
set -e
ROOT="${1:?template root (dir with src/)}"
DEST="${2:?destination dir}"

mkdir -p "$DEST/content" "$DEST/services" "$DEST/products"

cp -f "$ROOT/src/assets/olga.webp" "$DEST/content/home-about-preview-portrait.webp"
cp -f "$ROOT/src/image/about_atelier.webp" "$DEST/content/about-hero-atelier.webp"
cp -f "$ROOT/src/image/about_ingredients.webp" "$DEST/content/about-philosophy-ingredients.webp"
cp -f "$ROOT/src/image/5_800x1100.webp" "$DEST/content/diploma-1.webp"
cp -f "$ROOT/src/image/diploma_2.webp" "$DEST/content/diploma-2.webp"

cp -f "$ROOT/src/image/1_1200x800_mystical_tarot.webp" "$DEST/services/consultation-1.webp"
cp -f "$ROOT/src/image/1_1200x800_elegant_birth.webp" "$DEST/services/consultation-2.webp"
cp -f "$ROOT/src/image/1_1200x800_perfume_collection.webp" "$DEST/services/consultation-3.webp"
cp -f "$ROOT/src/image/1_1200x800_perfumer_crafting.webp" "$DEST/services/consultation-4.webp"

cp -f "$ROOT/src/image/2_1200x800_elegant_women.webp" "$DEST/services/masterclass-1.webp"
cp -f "$ROOT/src/image/2_1200x800_sacred_ritual.webp" "$DEST/services/masterclass-2.webp"
cp -f "$ROOT/src/image/2_1200x800_romantic_couple.webp" "$DEST/services/masterclass-3.webp"
cp -f "$ROOT/src/image/2_1200x800_corporate_team.webp" "$DEST/services/masterclass-4.webp"
cp -f "$ROOT/src/image/2_1200x800_elegant_business.webp" "$DEST/services/masterclass-5.webp"
cp -f "$ROOT/src/image/2_1200x800_close_up_of_essential.webp" "$DEST/services/masterclass-6.webp"
cp -f "$ROOT/src/image/2_1200x800_perfume_tasting.webp" "$DEST/services/masterclass-7.webp"

i=1
while [ "$i" -le 11 ]; do
  src="$ROOT/src/assets/products/product-${i}-800.webp"
  if [ -f "$src" ]; then
    cp -f "$src" "$DEST/products/product-${i}.webp"
  fi
  i=$((i + 1))
done
