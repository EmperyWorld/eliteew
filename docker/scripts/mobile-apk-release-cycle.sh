#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Full operator cycle on command-center: pack-cloud/mobile prod build → OTA publish →
# frontend /mobile-app/ deploy → prod-core OTA rsync → remote TG bot sync → smoke
# (local + prod-core manifest parity). Pack-layout: cloud door only (Wave 3 guards).
#
# Usage:
#   bash docker/scripts/mobile-apk-release-cycle.sh              # interactive menu
#   bash docker/scripts/mobile-apk-release-cycle.sh --yes --all  # non-interactive full cycle
#   eec mobile-apk --yes --all                                   # via container console
#   eemobile --yes --all                                         # via eliteew-docker-aliases.sh
#
# Invariants:
# - Prod APK signing uses -Pmobile.android.ci=true (debug keystore for sideload/OTA).
# - TG deploy uses push-bot-remote.sh (DEPLOY_SYNC_CONFIRM=SYNC when --yes).
# - Prod-core API/SPA deploy is not handled here; use eeprodbaked/eedeploy.
#
# Related:
# - serve-mobile-apk-tunnel.sh, pack-mobile-apk-archive.sh, eliteew-deploy-menu.sh
# - documentation/product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${POWERED_BY_EMPERYWORLD_ROOT:-}" ]]; then
	REPO_ROOT="$(cd "${POWERED_BY_EMPERYWORLD_ROOT}" && pwd)"
else
	REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

MOBILE_DIR="$REPO_ROOT/pack-cloud/mobile"
FRONTEND_DIR="$REPO_ROOT/shared/web/frontend"
BAKED_DEPLOY="$SCRIPT_DIR/eliteew-stack0-baked-deploy.sh"
PUBLISH="$SCRIPT_DIR/serve-mobile-apk-tunnel.sh"
OTA_STACK="$SCRIPT_DIR/mobile-release-stack.sh"
TG_PUSH="$REPO_ROOT/tg_bot_ip_verif/scripts/push-bot-remote.sh"
EDGE_IP="${MOBILE_APK_EDGE_IP:-93.77.165.185}"
PUBLIC_PAGE_URL="https://app.eliteew.ru/mobile-app/"
MOBILE_MANIFEST="$REPO_ROOT/local/binaries/empery-mobile.manifest.json"
VALIDATE_VERSION_BUMP="$MOBILE_DIR/scripts/validate-version-bump.sh"
PROD_CORE_API_CONTAINER="${MOBILE_SMOKE_API_CONTAINER:-stack0-eliteew-api-prod-baked}"

# Pack-layout door guard (Wave 3): cloud mobile ≠ org Connection Agent
if [[ "${ELITEEW_PACK_RELEASE:-}" == "org" && "${ELITEEW_PACK_ALLOW_CROSS_DOOR:-0}" != "1" ]]; then
	echo "ERROR: ELITEEW_PACK_RELEASE=org forbids pack-cloud mobile APK cycle." >&2
	echo "  Use scripts/eliteew/desktop-client-ota-release.sh for Connection Agent," >&2
	echo "  or set ELITEEW_PACK_ALLOW_CROSS_DOOR=1 for an explicit ops exception." >&2
	exit 1
fi
echo "[pack-cloud] Mobile release — will not build pack-organization/connection-agent (Tauri)."

AUTO_YES=0
DO_BUILD=0
DO_PUBLISH=0
DO_FRONTEND=0
DO_STACK0=0
DO_STACK0_FULL=0
DO_TG=0
DO_SMOKE=0
SKIP_LINT=0
DO_PROD_CORE_OTA=0
DO_PROD_CORE_API=0
REQUIRE_PROD_CORE_OTA_PARITY=0
SKIP_PROD_CORE_OTA=0
PROD_CORE_HOST="${PROD_CORE_HOST:-prod-core}"
PROD_CORE_DEPLOY="${SCRIPT_DIR}/deploy-prod-core-mobile.sh"
KEEP_LOCAL_OTA_STACK=0
LOCAL_OTA_STACK_STARTED=0

usage() {
	cat <<EOF
Usage: $(basename "$0") [options]

Full mobile release cycle (Android OTA + web /mobile-app/ + TG archive).

Options:
  --yes              Skip confirmation prompts
  --all              Full cycle: build + publish + frontend + prod-core frontend baked + prod-core OTA + tg + smoke
  --build            Gradle lintProdRelease + assembleProdRelease
  --skip-lint        With --build: assemble only (no lintProdRelease)
  --publish          serve-mobile-apk-tunnel.sh publish (+ 7z pack)
  --frontend         pnpm build:react-compiler + verify-app-build-id
  --stack0           Prod-core baked frontend-only deploy (serves /mobile-app/)
  --stack0-full      Prod-core baked ALL deploy (backend + frontend) via eeprodbaked path
  --tg               push-bot-remote.sh (TG assets + bot restart)
  --smoke            status + OTA manifest + prod-core parity + edge HEAD checks
  --prod-core        After publish: rsync OTA to prod-core (.111) + recreate stack-mobile-release
  --skip-prod-core-ota
                    With --all: skip prod-core OTA rsync (local-only publish; phones stay on old OTA)
  --keep-local-ota-stack
                    Do not auto-stop local stack-mobile-release on command-center after --prod-core
  --prod-core-api    DEPRECATED: exits with an error; use eeprodbaked --yes --all
  --prod-core-full   DEPRECATED: exits with an error; use --prod-core + eeprodbaked separately
  -h, --help         This help

Examples:
  $(basename "$0") --yes --all
  $(basename "$0") --yes --publish --prod-core --smoke
  $(basename "$0") --yes --all --skip-prod-core-ota   # local-only OTA (dev)
  eec mobile-apk
  eemobile --yes --all
EOF
}

confirm() {
	local prompt=$1
	if [[ "$AUTO_YES" == 1 ]]; then
		return 0
	fi
	read -r -p "$prompt [y/N] " reply
	[[ "${reply,,}" == "y" || "${reply,,}" == "yes" ]]
}

pause_screen() {
	echo
	read -r -p "Нажмите Enter для продолжения..." _
}

step() {
	echo
	echo "=== $* ==="
}

validate_mobile_manifest() {
	local manifest="${1:-$MOBILE_MANIFEST}"
	if [[ ! -s "$manifest" ]]; then
		echo "ERROR: mobile release manifest missing: $manifest" >&2
		return 1
	fi
	python3 - "$manifest" <<'PY'
import json
import re
import sys
from pathlib import Path

manifest = Path(sys.argv[1])
data = json.loads(manifest.read_text(encoding="utf-8"))
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
if apk_size <= 0:
    errors.append("apk_size_bytes must be positive")
sha256 = str(data.get("sha256") or "").strip().lower()
if not re.fullmatch(r"[0-9a-f]{64}", sha256):
    errors.append("sha256 must be a 64-character hex digest")
apk_name = str(data.get("apk_name") or "").strip()
if not apk_name:
    errors.append("apk_name must be non-empty")
if errors:
    for error in errors:
        print(f"ERROR: {manifest}: {error}", file=sys.stderr)
    raise SystemExit(1)
print(
    "Manifest OK: "
    f"{version_name} ({version_code}), "
    f"{apk_size / (1024 * 1024):.1f} MiB, "
    f"sha256={sha256[:12]}..."
)
PY
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--yes) AUTO_YES=1; shift ;;
	--all)
		DO_BUILD=1
		DO_PUBLISH=1
		DO_FRONTEND=1
		DO_STACK0=1
		if [[ "$SKIP_PROD_CORE_OTA" != 1 ]]; then
			DO_PROD_CORE_OTA=1
			REQUIRE_PROD_CORE_OTA_PARITY=1
		fi
		DO_TG=1
		DO_SMOKE=1
		shift
		;;
	--skip-prod-core-ota)
		SKIP_PROD_CORE_OTA=1
		DO_PROD_CORE_OTA=0
		REQUIRE_PROD_CORE_OTA_PARITY=0
		shift
		;;
	--build) DO_BUILD=1; shift ;;
	--skip-lint) SKIP_LINT=1; shift ;;
	--publish) DO_PUBLISH=1; shift ;;
	--frontend) DO_FRONTEND=1; shift ;;
	--stack0) DO_STACK0=1; shift ;;
	--stack0-full) DO_STACK0=1; DO_STACK0_FULL=1; shift ;;
	--tg) DO_TG=1; shift ;;
	--smoke) DO_SMOKE=1; shift ;;
	--prod-core) DO_PROD_CORE_OTA=1; REQUIRE_PROD_CORE_OTA_PARITY=1; shift ;;
	--keep-local-ota-stack) KEEP_LOCAL_OTA_STACK=1; shift ;;
	--prod-core-api) DO_PROD_CORE_API=1; shift ;;
	--prod-core-full) DO_PROD_CORE_OTA=1; DO_PROD_CORE_API=1; shift ;;
	-h|--help) usage; exit 0 ;;
	*) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
	esac
done

run_validate_version_bump() {
	step "Validate versionCode bump (gradle vs published manifest)"
	if [[ ! -x "$VALIDATE_VERSION_BUMP" ]]; then
		echo "ERROR: version bump validator missing: $VALIDATE_VERSION_BUMP" >&2
		return 1
	fi
	MOBILE_MANIFEST_PATH="$MOBILE_MANIFEST" bash "$VALIDATE_VERSION_BUMP"
}

run_build() {
	step "MobileAndroid prod build"
	run_validate_version_bump || return 1
	if [[ ! -d "$MOBILE_DIR" ]]; then
		echo "ERROR: $MOBILE_DIR not found" >&2
		return 1
	fi
	local -a gradle_tasks=(":app:assembleProdRelease")
	if [[ "$SKIP_LINT" != 1 ]]; then
		gradle_tasks=(":app:lintProdRelease" ":app:assembleProdRelease")
	fi
	# CI/sideload builds must not fail when Crashlytics mapping upload is unreachable (offline LAN).
	local -a gradle_args=(
		"${gradle_tasks[@]}"
		-Pmobile.android.ci=true
		--no-daemon
		-x
		uploadCrashlyticsMappingFileProdRelease
	)
	local gradle_rc=0
	(
		cd "$MOBILE_DIR"
		./gradlew "${gradle_args[@]}"
	) || gradle_rc=$?
	if [[ "$gradle_rc" != 0 ]]; then
		echo "ERROR: Gradle failed (exit ${gradle_rc})" >&2
		return 1
	fi
	local apk="$MOBILE_DIR/app/build/outputs/apk/prod/release/app-prod-release.apk"
	if [[ ! -s "$apk" ]]; then
		echo "ERROR: prod APK missing after build: $apk" >&2
		return 1
	fi
	ls -lh "$apk"
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$apk"
	fi
}

run_publish() {
	step "Publish APK to edge (local/binaries + OTA manifest + 7z)"
	if [[ "$DO_BUILD" != 1 ]]; then
		run_validate_version_bump || return 1
	fi
	if [[ -x "$OTA_STACK" ]]; then
		bash "$OTA_STACK" up 2>/dev/null || bash "$OTA_STACK" up
		LOCAL_OTA_STACK_STARTED=1
	fi
	bash "$PUBLISH" publish
}

run_frontend() {
	step "Frontend build (/mobile-app/ standalone + Social Hub)"
	if ! command -v pnpm >/dev/null 2>&1; then
		echo "ERROR: pnpm not in PATH" >&2
		return 1
	fi
	(
		cd "$FRONTEND_DIR"
		pnpm run build:react-compiler
		node scripts/verify-app-build-id.mjs
	)
	local ver
	ver="$(tr -d '\n' <"$FRONTEND_DIR/dist-build/app-build-version.txt")"
	echo "Deploy id: $ver"
}

run_stack0() {
	step "Prod-core stack0 deploy (serve updated frontend /mobile-app page)"
	local export_state="${ELITEEW_PROD_LINE_EXPORT_ROOT:-/srv/eliteew/prod-line-export}/.prod-line-state.json"
	local active_line=""
	if [[ -f "$export_state" ]]; then
		active_line="$(python3 - "$export_state" <<'PY' 2>/dev/null || true
import json
import sys
from pathlib import Path

try:
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
except Exception:
    raise SystemExit(0)
print(str(data.get("active_line") or "").strip())
PY
)"
	fi
	if [[ "$active_line" == "dev-bind" ]]; then
		echo "INFO: prod-core active line is dev-bind — deploy frontend via eeprodline (not eeprodbaked)"
		local eeprodline="${SCRIPT_DIR}/eeprodline.sh"
		local -a pl_args=(up-dev-bind --yes)
		if [[ "$DO_FRONTEND" == 1 ]]; then
			bash "$eeprodline" sync || return 1
			pl_args+=(--skip-sync)
		else
			pl_args+=(--with-frontend-build)
		fi
		bash "$eeprodline" "${pl_args[@]}"
		return $?
	fi
	if [[ ! -x "$BAKED_DEPLOY" ]]; then
		echo "ERROR: baked deploy helper not found: $BAKED_DEPLOY" >&2
		return 1
	fi
	local -a args=(--yes)
	if [[ "$DO_STACK0_FULL" == 1 ]]; then
		args+=(--all)
	else
		args+=(--frontend-only)
	fi
	if [[ "$DO_FRONTEND" == 1 ]]; then
		args+=(--skip-frontend-build)
	fi
	bash "$BAKED_DEPLOY" "${args[@]}"
}

run_tg() {
	step "Telegram bot deploy-sync (archive + meta on remote)"
	if [[ ! -f "$TG_PUSH" ]]; then
		echo "ERROR: $TG_PUSH not found" >&2
		return 1
	fi
	if [[ "$AUTO_YES" == 1 ]]; then
		export DEPLOY_SYNC_CONFIRM=SYNC
	fi
	bash "$TG_PUSH"
}

verify_prod_core_ota_parity() {
	local require_match="${1:-0}"
	if [[ ! -s "$MOBILE_MANIFEST" ]]; then
		echo "WARN: skip prod-core OTA parity (local manifest missing)" >&2
		return 0
	fi
	local local_json prod_json
	local_json="$(python3 - "$MOBILE_MANIFEST" <<'PY'
import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(f"{data['version_name']}\t{data['version_code']}\t{data['sha256']}")
PY
)"
	local local_name local_code local_sha
	IFS=$'\t' read -r local_name local_code local_sha <<<"$local_json"
	if ! prod_json="$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$PROD_CORE_HOST" \
		'curl -sf http://127.0.0.1:29180/v1/manifest.json' 2>/dev/null)"; then
		if [[ "$require_match" == 1 ]]; then
			echo "ERROR: prod-core OTA manifest unreachable on ${PROD_CORE_HOST}:29180" >&2
			echo "Phones read OTA from prod-core, not command-center. Run with --prod-core or eemobile --yes --all." >&2
			return 1
		fi
		echo "WARN: prod-core OTA manifest unreachable (ssh/curl failed)" >&2
		return 0
	fi
	local prod_name prod_code prod_sha
	IFS=$'\t' read -r prod_name prod_code prod_sha <<<"$(printf '%s' "$prod_json" | python3 -c '
import json
import sys

data = json.load(sys.stdin)
print(data["version_name"], data["version_code"], data["sha256"], sep="\t")
')"
	if [[ "$local_code" == "$prod_code" && "$local_sha" == "$prod_sha" ]]; then
		echo "prod-core OTA parity OK: ${local_name} (${local_code}) on ${PROD_CORE_HOST}"
		return 0
	fi
	if [[ "$require_match" == 1 ]]; then
		echo "ERROR: prod-core OTA mismatch (phones will not see the new build):" >&2
	else
		echo "WARN: prod-core OTA behind local manifest:" >&2
	fi
	echo "  local manifest:  ${local_name} (${local_code}) sha256=${local_sha:0:12}..." >&2
	echo "  prod-core OTA:   ${prod_name} (${prod_code}) sha256=${prod_sha:0:12}..." >&2
	if [[ "$require_match" == 1 ]]; then
		echo "Fix: bash docker/scripts/deploy-prod-core-mobile.sh --yes --ota" >&2
		echo "     or re-run: eemobile --yes --all  (includes prod-core OTA by default)" >&2
		return 1
	fi
	if [[ "$DO_PUBLISH" == 1 && "$local_code" -gt "$prod_code" ]]; then
		echo "WARN: published locally but prod-core is behind — add --prod-core or use --all" >&2
	fi
	return 0
}

verify_prod_core_api_meta_parity() {
	local require_match="${1:-0}"
	if [[ ! -s "$MOBILE_MANIFEST" ]]; then
		echo "WARN: skip prod-core API meta parity (local manifest missing)" >&2
		return 0
	fi
	local local_json api_json
	local_json="$(python3 - "$MOBILE_MANIFEST" <<'PY'
import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(f"{data['version_name']}\t{data['version_code']}\t{data['sha256']}")
PY
)"
	local local_name local_code local_sha
	IFS=$'\t' read -r local_name local_code local_sha <<<"$local_json"
	if ! api_json="$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$PROD_CORE_HOST" \
		"podman exec ${PROD_CORE_API_CONTAINER} cat /app/mobile-release/empery-mobile.apk.meta.json" 2>/dev/null)"; then
		if [[ "$require_match" == 1 ]]; then
			echo "ERROR: prod-core API mobile meta unreachable (${PROD_CORE_HOST}, container ${PROD_CORE_API_CONTAINER})" >&2
			echo "In-app update reads this sidecar; redeploy stack0 after OTA rsync." >&2
			return 1
		fi
		echo "WARN: prod-core API mobile meta unreachable (ssh/podman exec failed)" >&2
		return 0
	fi
	local api_name api_code api_sha
	IFS=$'\t' read -r api_name api_code api_sha <<<"$(printf '%s' "$api_json" | python3 -c '
import json
import sys

data = json.load(sys.stdin)
print(data["version_name"], data["version_code"], data["sha256"], sep="\t")
')"
	if [[ "$local_code" == "$api_code" && "$local_sha" == "$api_sha" ]]; then
		echo "prod-core API meta parity OK: ${local_name} (${local_code}) in ${PROD_CORE_API_CONTAINER}"
		return 0
	fi
	if [[ "$require_match" == 1 ]]; then
		echo "ERROR: prod-core API mobile meta mismatch (in-app update may show stale version):" >&2
	else
		echo "WARN: prod-core API mobile meta behind local manifest:" >&2
	fi
	echo "  local manifest: ${local_name} (${local_code}) sha256=${local_sha:0:12}..." >&2
	echo "  API sidecar:    ${api_name} (${api_code}) sha256=${api_sha:0:12}..." >&2
	if [[ "$require_match" == 1 ]]; then
		echo "Fix: eeprodbaked --yes --backend-only (baked line) or eeprodline up-dev-bind --yes (dev-bind line)" >&2
		return 1
	fi
	return 0
}

verify_prod_core_ota_alive() {
	# Continuous OTA invariant (W0): phones always need :29180 on prod-core.
	# Fail closed even when local/prod version parity is not required.
	if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$PROD_CORE_HOST" \
		'curl -sf http://127.0.0.1:29180/health | grep -q ok' 2>/dev/null; then
		echo "ERROR: prod-core OTA health unreachable on ${PROD_CORE_HOST}:29180" >&2
		echo "Phones cannot update. Fix: ssh ${PROD_CORE_HOST} 'bash docker/scripts/prod-core-mobile-ota-start.sh'" >&2
		echo "  or: bash docker/scripts/deploy-prod-core-mobile.sh --yes --ota" >&2
		return 1
	fi
	echo "prod-core OTA alive: ${PROD_CORE_HOST}:29180/health=ok"
	return 0
}

run_smoke() {
	step "Smoke checks"
	local failed=0
	validate_mobile_manifest "$MOBILE_MANIFEST" || failed=1
	if [[ -x "$OTA_STACK" ]]; then
		bash "$OTA_STACK" smoke || failed=1
	else
		echo "ERROR: OTA stack helper not found: $OTA_STACK" >&2
		failed=1
	fi
	bash "$PUBLISH" status || failed=1
	# Always require OTA server up on prod-core (continuous OTA policy).
	verify_prod_core_ota_alive || failed=1
	verify_prod_core_ota_parity "$REQUIRE_PROD_CORE_OTA_PARITY" || failed=1
	verify_prod_core_api_meta_parity "$REQUIRE_PROD_CORE_OTA_PARITY" || failed=1
	curl -sfI --resolve "app.eliteew.ru:443:${EDGE_IP}" "$PUBLIC_PAGE_URL" 2>/dev/null | sed -n '1,8p' \
		|| curl -sfI "$PUBLIC_PAGE_URL" 2>/dev/null | sed -n '1,8p' \
		|| echo "WARN: edge /mobile-app/ smoke failed"
	return "$failed"
}

run_prod_core_deploy() {
	step "prod-core deploy (.111)"
	if [[ ! -x "$PROD_CORE_DEPLOY" ]]; then
		echo "ERROR: $PROD_CORE_DEPLOY not found" >&2
		return 1
	fi
	if [[ "$DO_PROD_CORE_API" == 1 ]]; then
		echo "ERROR: --prod-core-api/--prod-core-full are deprecated." >&2
		echo "Use 'eeprodbaked --yes --all' (or eedeploy points 9-11) for stack0 API/SPA." >&2
		return 2
	fi
	local -a args=(--yes)
	[[ "$DO_PROD_CORE_OTA" == 1 ]] && args+=(--ota)
	bash "$PROD_CORE_DEPLOY" "${args[@]}"
}

run_selected() {
	local failed=0
	if [[ "$DO_BUILD" == 1 ]]; then run_build || failed=1; fi
	if [[ "$failed" == 0 && "$DO_PUBLISH" == 1 ]]; then run_publish || failed=1; fi
	if [[ "$failed" == 0 && "$DO_FRONTEND" == 1 ]]; then run_frontend || failed=1; fi
	if [[ "$failed" == 0 && ( "$DO_PROD_CORE_OTA" == 1 || "$DO_PROD_CORE_API" == 1 ) ]]; then
		run_prod_core_deploy || failed=1
	fi
	if [[ "$failed" == 0 && "$DO_STACK0" == 1 ]]; then run_stack0 || failed=1; fi
	if [[ "$failed" == 0 && "$DO_TG" == 1 ]]; then run_tg || failed=1; fi
	if [[ "$DO_SMOKE" == 1 ]]; then run_smoke || failed=1; fi
	if [[ "$LOCAL_OTA_STACK_STARTED" == 1 && "$DO_PROD_CORE_OTA" == 1 && "$KEEP_LOCAL_OTA_STACK" != 1 ]]; then
		step "Cleanup local OTA stack on command-center"
		if [[ -x "$OTA_STACK" ]]; then
			bash "$OTA_STACK" down || echo "WARN: could not stop local stack-mobile-release"
		fi
	fi
	return "$failed"
}

show_menu() {
	cat <<EOF

╔══════════════════════════════════════════════════════════════╗
║  Mobile APK release cycle (Android OTA + web + TG archive)     ║
║  Repo: $REPO_ROOT
╚══════════════════════════════════════════════════════════════╝

  1) Полный цикл (--all): build → publish → frontend → prod-core frontend baked → prod-core OTA → TG → smoke
  2) Только сборка Android (lint + assembleProdRelease)
  3) Только publish (APK уже собран) + 7z
  4) Frontend build + prod-core baked frontend-only deploy
  5) Только TG bot deploy-sync
  6) Только smoke / status
  7) Toggle AUTO_YES (сейчас: $( [[ "$AUTO_YES" == 1 ]] && echo ON || echo OFF ))
  0) Выход

  Канон: documentation/product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md

EOF
}

interactive_loop() {
	while true; do
		show_menu
		read -r -p "Выбор: " choice
		case "$choice" in
		1)
			DO_BUILD=1
			DO_PUBLISH=1
			DO_FRONTEND=1
			DO_STACK0=1
			DO_PROD_CORE_OTA=1
			REQUIRE_PROD_CORE_OTA_PARITY=1
			DO_TG=1
			DO_SMOKE=1
			if confirm "Запустить полный цикл (включая prod-core OTA)?"; then run_selected || true; fi
			pause_screen ;;
		2) if confirm "Gradle lintProdRelease + assembleProdRelease?"; then run_build || true; fi; pause_screen ;;
		3) if confirm "Publish + 7z (без пересборки Gradle)?"; then run_publish || true; fi; pause_screen ;;
		4) if confirm "Frontend build + stack0-frontend recreate?"; then run_frontend && run_stack0 || true; fi; pause_screen ;;
		5) if confirm "TG push-bot-remote (deploy-sync)?"; then run_tg || true; fi; pause_screen ;;
		6) run_smoke || true; pause_screen ;;
		7) if [[ "$AUTO_YES" == 1 ]]; then AUTO_YES=0; else AUTO_YES=1; fi; echo "AUTO_YES=$( [[ "$AUTO_YES" == 1 ]] && echo ON || echo OFF )"; pause_screen ;;
		0) break ;;
		*) echo "Неизвестный пункт."; pause_screen ;;
		esac
	done
}

if [[ "$DO_BUILD$DO_PUBLISH$DO_FRONTEND$DO_STACK0$DO_TG$DO_SMOKE$DO_PROD_CORE_OTA$DO_PROD_CORE_API" == "00000000" ]]; then
	interactive_loop
	exit 0
fi

run_selected
exit $?
