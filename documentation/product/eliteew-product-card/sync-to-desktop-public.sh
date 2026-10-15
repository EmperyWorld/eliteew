#!/usr/bin/env bash
# Sync offline presentation assets into the desktop SPA public bundle.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SRC="${ROOT}/documentation/product/eliteew-product-card"
DEST="${ROOT}/shared/web/frontend/public/o-proekte"

mkdir -p "${DEST}"
cp "${SRC}/ELITEEW-PRODUCT-PRESENTATION.html" "${DEST}/index.html"
cp "${SRC}/presentation.js" "${DEST}/"
cp "${SRC}/research-content.bundle.js" "${DEST}/"
rm -rf "${DEST}/vendor"
cp -a "${SRC}/vendor" "${DEST}/"

echo "Synced presentation to ${DEST}"
