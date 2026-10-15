#!/usr/bin/env bash
# Скачивает Open Sans woff2 (Fontsource) и сохраняет под именами, которые ожидает
# Keycloak/PatternFly. Подмена в nginx убирает предупреждения "kern: Too large subtable".
set -e
CDN="https://cdn.jsdelivr.net/fontsource/fonts/open-sans@latest"
DIR="$(dirname "$0")/../public/fonts"
mkdir -p "$DIR"
curl -fsSL "${CDN}/latin-300-normal.woff2" -o "$DIR/OpenSans-Light-webfont.woff2"
curl -fsSL "${CDN}/latin-400-normal.woff2" -o "$DIR/OpenSans-Regular-webfont.woff2"
curl -fsSL "${CDN}/latin-600-normal.woff2" -o "$DIR/OpenSans-Semibold-webfont.woff2"
curl -fsSL "${CDN}/latin-700-normal.woff2" -o "$DIR/OpenSans-Bold-webfont.woff2"
echo "Fonts saved to $DIR"
