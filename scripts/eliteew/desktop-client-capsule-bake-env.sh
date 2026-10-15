#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Export desktop-client release bake env for Sealed Capsule (no secret values printed).
# Invariants:
# - Derives ELITEEW_DESKTOP_CAPSULE_SIGNING_PK from DESKTOP_CLIENT_CAPSULE_SIGNING_KEY.
# - Recipient SK from env, hex file, or gitignored runtime JSON (never committed).
# Related:
# - pack-organization/connection-agent/src-tauri/build.rs
# - scripts/eliteew/desktop-client-ota-release-preflight.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STACK0_ENV="${DESKTOP_CLIENT_STACK0_ENV:-${ROOT}/docker/env_file/.env.stack0.backend}"
RECIPIENT_FILE="${ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK_FILE:-${HOME}/.config/eliteew/desktop-capsule-recipient-sk.hex}"
CAPSULE_JSON="${ELITEEW_DESKTOP_CAPSULE_KEYS_JSON:-${ROOT}/host/runtime/secrets/desktop-capsule-keys-20260809.json}"
MODE="check"
RECIPIENT_SOURCE="env"

while [[ $# -gt 0 ]]; do
	case "$1" in
	--export)
		MODE="export"
		shift
		;;
	--stack0-env)
		STACK0_ENV="${2:-}"
		shift 2
		;;
	--recipient-sk-file)
		RECIPIENT_FILE="${2:-}"
		shift 2
		;;
	--capsule-keys-json)
		CAPSULE_JSON="${2:-}"
		shift 2
		;;
	-h | --help)
		sed -n '2,16p' "$0"
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		exit 2
		;;
	esac
done

read_env_key() {
	local key="$1"
	local file="$2"
	if [[ -n "${!key:-}" ]]; then
		printf '%s' "${!key}"
		return 0
	fi
	if [[ -f "${file}" ]]; then
		python3 - "$file" "$key" <<'PY'
import sys
from pathlib import Path
path, want = sys.argv[1], sys.argv[2]
for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    if k.strip() == want:
        print(v.strip().strip('"').strip("'"), end="")
        break
PY
		return 0
	fi
	return 1
}

SIGNING_SK="$(read_env_key DESKTOP_CLIENT_CAPSULE_SIGNING_KEY "${STACK0_ENV}" || true)"
SIGNING_PK="${ELITEEW_DESKTOP_CAPSULE_SIGNING_PK:-}"
RECIPIENT_SK="${ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK:-}"

if [[ -z "${RECIPIENT_SK}" && -f "${RECIPIENT_FILE}" ]]; then
	RECIPIENT_SK="$(tr -d '[:space:]' <"${RECIPIENT_FILE}")"
	RECIPIENT_SOURCE="hex-file:${RECIPIENT_FILE}"
fi

if [[ (-z "${RECIPIENT_SK}" || -z "${SIGNING_SK}" || -z "${SIGNING_PK}") && -f "${CAPSULE_JSON}" ]]; then
	read -r JSON_RECIPIENT_SK JSON_SIGNING_SK JSON_SIGNING_PK <<<"$(python3 - "${CAPSULE_JSON}" <<'PY'
import json, sys
from pathlib import Path
doc = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(
    (doc.get("recipient_sk_hex") or "").strip(),
    (doc.get("signing_sk_hex") or "").strip(),
    (doc.get("signing_pk_hex") or "").strip(),
)
PY
)"
	if [[ -z "${RECIPIENT_SK}" && -n "${JSON_RECIPIENT_SK}" ]]; then
		RECIPIENT_SK="${JSON_RECIPIENT_SK}"
		RECIPIENT_SOURCE="json:${CAPSULE_JSON}"
	fi
	if [[ -z "${SIGNING_SK}" && -n "${JSON_SIGNING_SK}" ]]; then
		SIGNING_SK="${JSON_SIGNING_SK}"
	fi
	if [[ -z "${SIGNING_PK}" && -n "${JSON_SIGNING_PK}" ]]; then
		SIGNING_PK="${JSON_SIGNING_PK}"
	fi
fi

if [[ -z "${SIGNING_SK}" ]]; then
	echo "FAIL: DESKTOP_CLIENT_CAPSULE_SIGNING_KEY not in env, ${STACK0_ENV}, or ${CAPSULE_JSON}" >&2
	exit 1
fi
# Wave 4: shared recipient SK is no longer baked into the client.

read -r DERIVED_SIGNING_PK VALID <<<"$(python3 - "${SIGNING_SK}" "${SIGNING_PK}" <<'PY'
import sys
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

def hex32(raw: str, label: str) -> bytes:
    t = (raw or "").strip()
    if len(t) != 64 or "REPLACE_WITH" in t:
        raise SystemExit(f"FAIL: {label} must be 64 hex chars")
    return bytes.fromhex(t)

signing_sk = hex32(sys.argv[1], "DESKTOP_CLIENT_CAPSULE_SIGNING_KEY")
derived = Ed25519PrivateKey.from_private_bytes(signing_sk).public_key().public_bytes_raw().hex()
provided = (sys.argv[2] or "").strip()
if provided and provided != derived:
    raise SystemExit("FAIL: signing PK does not match signing SK")
print(derived, "ok")
PY
)"

if [[ "${VALID}" != "ok" ]]; then
	echo "FAIL: capsule key validation" >&2
	exit 1
fi
SIGNING_PK="${DERIVED_SIGNING_PK}"

if [[ "${MODE}" == "export" ]]; then
	printf 'export ELITEEW_DESKTOP_CAPSULE_SIGNING_PK=%q\n' "${SIGNING_PK}"
	printf 'unset ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK\n'
	printf 'unset ELITEEW_CAPSULE_DEV_KEYS\n'
else
	echo "OK: capsule bake env ready (signing PK only; Wave 4 no shared recipient SK)"
	echo "OK: signing PK derived/validated"
fi
