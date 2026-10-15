#!/usr/bin/env bash
# Publish production Android APK into canonical local/binaries store.
#
# User-facing page (Keycloak login + API download):
#   https://app.eliteew.ru/mobile-app/
#
# Run from repo root:
#   bash docker/scripts/serve-mobile-apk-tunnel.sh publish
#   bash docker/scripts/serve-mobile-apk-tunnel.sh status
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

APK_DIR="$REPO_ROOT/local/binaries"
CANONICAL_APK="$APK_DIR/empery-mobile.apk"
LEGACY_APK="$APK_DIR/app-prod-release.apk"
MANIFEST_JSON="$APK_DIR/empery-mobile.manifest.json"
PUBLIC_PAGE_URL="https://app.eliteew.ru/mobile-app/"
API_DOWNLOAD_URL="https://app.eliteew.ru/api/v1/mobile-app/download"
EDGE_IP="${MOBILE_APK_EDGE_IP:-93.77.165.185}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

PROD_RELEASE_DIR="$REPO_ROOT/pack-cloud/mobile/app/build/outputs/apk/prod/release"
SIGNED_BUILT_APK="$PROD_RELEASE_DIR/app-prod-release.apk"
UNSIGNED_BUILT_APK="$PROD_RELEASE_DIR/app-prod-release-unsigned.apk"
GRADLE_OUTPUT_META="$PROD_RELEASE_DIR/output-metadata.json"
AAPT2="${MOBILE_APK_AAPT2:-${ANDROID_HOME:-$HOME/Android/Sdk}/build-tools/37.0.0/aapt2}"

resolve_src_apk() {
  if [[ -n "${MOBILE_APK_SRC:-}" ]]; then
    SRC_APK="$MOBILE_APK_SRC"
    return 0
  fi
  if [[ -f "$SIGNED_BUILT_APK" ]]; then
    SRC_APK="$SIGNED_BUILT_APK"
    return 0
  fi
  if [[ -f "$UNSIGNED_BUILT_APK" ]]; then
    echo "ERROR: найден только unsigned APK ($UNSIGNED_BUILT_APK)." >&2
    echo "Соберите подписанный prod release:" >&2
    echo "  cd pack-cloud/mobile && ./gradlew :app:assembleProdRelease -Pmobile.android.ci=true" >&2
    exit 1
  fi
  if [[ -f "$CANONICAL_APK" ]]; then
    echo "Предупреждение: свежий Gradle APK не найден — publish возьмёт существующий $CANONICAL_APK" >&2
    echo "  (versionCode в manifest может не совпасть с бинарником; сначала --build)" >&2
    SRC_APK="$CANONICAL_APK"
    return 0
  fi
  if [[ -f "$LEGACY_APK" ]]; then
    SRC_APK="$LEGACY_APK"
    return 0
  fi
  SRC_APK="$SIGNED_BUILT_APK"
}

verify_apk_matches_sidecar() {
  local apk_path="$1"
  local meta_path="${apk_path}.meta.json"
  if [[ ! -f "$apk_path" ]] || [[ ! -f "$meta_path" ]] || [[ ! -f "$AAPT2" ]]; then
    return 0
  fi
  local expected_code expected_name
  expected_code="$(python3 - "$meta_path" <<'PY'
import json, sys
meta = json.loads(open(sys.argv[1], encoding="utf-8").read())
print(int(meta.get("version_code") or 0))
PY
)"
  expected_name="$(python3 - "$meta_path" <<'PY'
import json, sys
meta = json.loads(open(sys.argv[1], encoding="utf-8").read())
print(str(meta.get("version_name") or "").strip())
PY
)"
  local badging actual_code actual_name
  badging="$("$AAPT2" dump badging "$apk_path" 2>/dev/null || true)"
  actual_code="$(sed -n "s/.*versionCode='\\([0-9]*\\)'.*/\\1/p" <<<"$badging" | head -1)"
  actual_name="$(sed -n "s/.*versionName='\\([^']*\\)'.*/\\1/p" <<<"$badging" | head -1)"
  if [[ -z "$actual_code" ]] || [[ "$actual_code" != "$expected_code" ]]; then
    echo "ERROR: APK versionCode=$actual_code, meta version_code=$expected_code — publish отменён." >&2
    echo "  Пересоберите: cd pack-cloud/mobile && ./gradlew :app:assembleProdRelease -Pmobile.android.ci=true" >&2
    exit 1
  fi
  if [[ -n "$expected_name" ]] && [[ "$actual_name" != "$expected_name" ]]; then
    echo "ERROR: APK versionName=$actual_name, meta version_name=$expected_name — publish отменён." >&2
    exit 1
  fi
  echo "APK meta parity OK: versionCode=$actual_code versionName=$actual_name"
}

resolve_src_apk

ensure_file_target() {
  local target="$1"
  if [[ -d "$target" ]]; then
    echo "Ошибка: $target является директорией, а не файлом." >&2
    echo "Исправьте вручную (удалите директорию и повторите publish)." >&2
    exit 1
  fi
}

print_apk_meta() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "missing: $path"
    return
  fi
  ls -lh "$path"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path"
  fi
}

validate_release_manifest() {
  local manifest_path="${1:-$MANIFEST_JSON}"
  local apk_path="${2:-$CANONICAL_APK}"
  if [[ ! -s "$manifest_path" ]]; then
    echo "Ошибка: manifest отсутствует или пустой: $manifest_path" >&2
    return 1
  fi
  if [[ ! -s "$apk_path" ]]; then
    echo "Ошибка: APK отсутствует или пустой: $apk_path" >&2
    return 1
  fi
  python3 - "$manifest_path" "$apk_path" <<'PY'
import hashlib
import json
import re
import sys
from pathlib import Path

manifest_path = Path(sys.argv[1])
apk_path = Path(sys.argv[2])
data = json.loads(manifest_path.read_text(encoding="utf-8"))
errors = []
if data.get("apk_available") is not True:
    errors.append("apk_available must be true")
version_code = int(data.get("version_code") or 0)
if version_code <= 0:
    errors.append("version_code must be positive")
version_name = str(data.get("version_name") or "").strip()
if not version_name:
    errors.append("version_name must be non-empty")
apk_size = int(data.get("apk_size_bytes") or 0)
real_size = apk_path.stat().st_size
if apk_size <= 0:
    errors.append("apk_size_bytes must be positive")
elif apk_size != real_size:
    errors.append(f"apk_size_bytes mismatch: manifest={apk_size}, file={real_size}")
apk_name = str(data.get("apk_name") or "").strip()
if not apk_name:
    errors.append("apk_name must be non-empty")
sha256 = str(data.get("sha256") or "").strip().lower()
real_sha = hashlib.sha256(apk_path.read_bytes()).hexdigest()
if not re.fullmatch(r"[0-9a-f]{64}", sha256):
    errors.append("sha256 must be a 64-character hex digest")
elif sha256 != real_sha:
    errors.append("sha256 mismatch with APK file")
if errors:
    for error in errors:
        print(f"ERROR: {manifest_path}: {error}", file=sys.stderr)
    raise SystemExit(1)
print(
    "Manifest validated: "
    f"{version_name} ({version_code}), "
    f"{apk_size / (1024 * 1024):.1f} MiB, "
    f"sha256={sha256[:12]}..."
)
PY
}

api_container_running() {
  "${CONTAINER_RUNTIME}" ps --format '{{.Names}}' 2>/dev/null | awk '$0=="stack0-eliteew-api-prod"{found=1} END{exit found?0:1}'
}

cmd_publish() {
  local validate_notes="$REPO_ROOT/pack-cloud/mobile/scripts/validate-release-notes-user.sh"
  if [[ -x "$validate_notes" ]]; then
    bash "$validate_notes"
  else
    echo "Предупреждение: validate-release-notes-user.sh не найден — пропуск проверки user copy." >&2
  fi
  if [[ ! -f "$SRC_APK" ]]; then
    echo "Не найден prod APK. Соберите:" >&2
    echo "  cd pack-cloud/mobile && ./gradlew :app:assembleProdRelease -Pmobile.android.ci=true" >&2
    exit 1
  fi
  mkdir -p "$APK_DIR"
  ensure_file_target "$CANONICAL_APK"
  ensure_file_target "$LEGACY_APK"

  local tmp_apk="$APK_DIR/.empery-mobile.apk.tmp.$$"
  cp -f "$SRC_APK" "$tmp_apk"
  chmod 644 "$tmp_apk" || true
  mv -f "$tmp_apk" "$CANONICAL_APK"
  cp -f "$CANONICAL_APK" "$LEGACY_APK"
  chmod 644 "$LEGACY_APK" || true

  write_apk_meta_sidecar() {
    local apk_path="$1"
    local meta_path="${apk_path}.meta.json"
    local gradle_meta=""
    local src_dir
    src_dir="$(dirname "$SRC_APK")"
    if [[ -f "$src_dir/output-metadata.json" ]]; then
      gradle_meta="$src_dir/output-metadata.json"
    elif [[ -f "$REPO_ROOT/pack-cloud/mobile/app/build/outputs/apk/prod/release/output-metadata.json" ]]; then
      gradle_meta="$REPO_ROOT/pack-cloud/mobile/app/build/outputs/apk/prod/release/output-metadata.json"
    fi
    if [[ -n "$gradle_meta" ]] && command -v python3 >/dev/null 2>&1; then
      REPO_ROOT="$REPO_ROOT" python3 - "$gradle_meta" "$meta_path" <<'PY'
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
import hashlib

gradle_meta = Path(sys.argv[1])
meta_path = Path(sys.argv[2])
apk_path = meta_path.with_name(meta_path.name.replace(".meta.json", ""))
payload = json.loads(gradle_meta.read_text(encoding="utf-8"))
elements = payload.get("elements") or []
element = elements[0] if elements else {}
version_code = int(element.get("versionCode") or 0)
version_name = str(element.get("versionName") or "").strip()
if version_code <= 0 or not version_name:
    raise SystemExit("output-metadata.json missing versionCode/versionName")
meta_doc = {
    "version_code": version_code,
    "version_name": version_name,
    "published_at": datetime.now(UTC).isoformat(),
}
if apk_path.is_file():
    meta_doc["sha256"] = hashlib.sha256(apk_path.read_bytes()).hexdigest()
release_notes = os.environ.get("MOBILE_APK_RELEASE_NOTES", "").strip()
if not release_notes:
    repo_root = Path(os.environ.get("REPO_ROOT", ".")).resolve()
    notes_file = repo_root / "pack-cloud" / "mobile" / "docs" / "RELEASE-NOTES-user.ru.txt"
    if notes_file.is_file():
        release_notes = notes_file.read_text(encoding="utf-8").strip()
if not release_notes:
    release_notes = (
        f"Обновление EliteEW Mobile {version_name}: улучшения интерфейса и стабильность работы."
    )
meta_doc["release_notes"] = release_notes[:4000]
repo_root = Path(os.environ.get("REPO_ROOT", ".")).resolve()
history_path = repo_root / "pack-cloud" / "mobile" / "docs" / "RELEASE-NOTES-history.ru.json"
history: list[dict[str, object]] = []
if history_path.is_file():
    try:
        loaded = json.loads(history_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        loaded = []
    if isinstance(loaded, list):
        history = [item for item in loaded if isinstance(item, dict)]
history = [
    item
    for item in history
    if int(item.get("version_code") or 0) != version_code
]
history.append(
    {
        "version_code": version_code,
        "version_name": version_name,
        "release_notes": release_notes[:4000],
    }
)
history.sort(key=lambda item: int(item.get("version_code") or 0))
history_path.parent.mkdir(parents=True, exist_ok=True)
history_path.write_text(
    json.dumps(history, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
meta_doc["release_notes_history"] = history
min_supported = os.environ.get("MOBILE_APK_MIN_SUPPORTED_VERSION_CODE", "").strip()
if min_supported:
    meta_doc["min_supported_version_code"] = int(min_supported)
meta_path.write_text(
    json.dumps(meta_doc, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(f"Wrote {meta_path} (versionCode={version_code}, versionName={version_name})")
PY
    else
      echo "Предупреждение: output-metadata.json не найден — sidecar версии не записан." >&2
    fi
  }

  write_apk_meta_sidecar "$CANONICAL_APK"
  verify_apk_matches_sidecar "$CANONICAL_APK"
  if [[ -f "${CANONICAL_APK}.meta.json" ]]; then
    cp -f "${CANONICAL_APK}.meta.json" "${LEGACY_APK}.meta.json"
  fi

  write_release_manifest() {
    local apk_path="$1"
    local manifest_path="$MANIFEST_JSON"
    if [[ ! -f "$apk_path" ]] || [[ ! -f "${apk_path}.meta.json" ]]; then
      echo "Предупреждение: manifest не записан — нет APK или sidecar meta." >&2
      return
    fi
    python3 - "$apk_path" "$manifest_path" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

apk_path = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])
meta = json.loads(apk_path.with_name(f"{apk_path.name}.meta.json").read_text(encoding="utf-8"))
size = apk_path.stat().st_size
sha256 = hashlib.sha256(apk_path.read_bytes()).hexdigest()
payload = {
    "apk_available": size > 0,
    "apk_size_bytes": size,
    "version_code": int(meta.get("version_code") or 0),
    "version_name": str(meta.get("version_name") or "").strip(),
    "apk_name": apk_path.name,
    "published_at": meta.get("published_at"),
    "release_notes": meta.get("release_notes"),
    "release_notes_history": meta.get("release_notes_history") or [],
    "min_supported_version_code": meta.get("min_supported_version_code"),
    "sha256": sha256,
}
manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {manifest_path} (versionCode={payload['version_code']})")
PY
  }

  write_release_manifest "$CANONICAL_APK"
  validate_release_manifest "$MANIFEST_JSON" "$CANONICAL_APK"

  print_apk_meta "$CANONICAL_APK"
  print_apk_meta "$LEGACY_APK"

  if command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1 && api_container_running; then
    if "${CONTAINER_RUNTIME}" exec stack0-eliteew-api-prod sh -lc 'test -s /app/mobile-release/empery-mobile.apk'; then
      echo "API mount check: /app/mobile-release/empery-mobile.apk is present."
      "${CONTAINER_RUNTIME}" exec stack0-eliteew-api-prod ls -lh /app/mobile-release/empery-mobile.apk
    else
      echo "Предупреждение: API container не видит /app/mobile-release/empery-mobile.apk" >&2
    fi
  fi

  if [[ -x "$SCRIPT_DIR/mobile-release-stack.sh" ]]; then
    if bash "$SCRIPT_DIR/mobile-release-stack.sh" smoke 2>/dev/null; then
      echo "Release server manifest smoke: OK (http://127.0.0.1:29180/v1/manifest.json)"
    else
      echo "Подсказка: поднимите OTA-сервер: bash docker/scripts/mobile-release-stack.sh up" >&2
    fi
  fi

  echo ""
  echo "Пользовательская ссылка (Keycloak):"
  echo "  $PUBLIC_PAGE_URL"
  echo "API endpoint (401 without token is expected):"
  echo "  $API_DOWNLOAD_URL"

  if [[ -x "$SCRIPT_DIR/pack-mobile-apk-archive.sh" ]]; then
    echo ""
    echo "Packing Telegram archive (7z max)…"
    bash "$SCRIPT_DIR/pack-mobile-apk-archive.sh"
  fi
}

cmd_status() {
  print_apk_meta "$CANONICAL_APK"
  print_apk_meta "$LEGACY_APK"
  validate_release_manifest "$MANIFEST_JSON" "$CANONICAL_APK"
  echo ""
  if command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1 && api_container_running; then
    "${CONTAINER_RUNTIME}" exec stack0-eliteew-api-prod sh -lc 'ls -lh /app/mobile-release/empery-mobile.apk /app/mobile-release/app-prod-release.apk 2>/dev/null || true'
  fi
  echo ""
  curl -sfI --resolve "app.eliteew.ru:443:${EDGE_IP}" "$PUBLIC_PAGE_URL" 2>/dev/null | sed -n '1,12p' \
    || curl -sfI "$PUBLIC_PAGE_URL" 2>/dev/null | sed -n '1,12p' \
    || echo "Публичный smoke не прошёл — проверьте stack-yandex-tunnel и stack0-eliteew-frontend-prod"
}

usage() {
  echo "Usage: $0 {publish|pack-archive|status}"
}

case "${1:-}" in
  publish) cmd_publish ;;
  pack-archive) bash "$SCRIPT_DIR/pack-mobile-apk-archive.sh" "${@:2}" ;;
  status) cmd_status ;;
  *) usage; exit 1 ;;
esac
