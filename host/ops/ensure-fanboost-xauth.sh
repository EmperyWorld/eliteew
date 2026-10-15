#!/usr/bin/env bash
# ---
# EliteEW command-center host ops · FANBoost X11 auth aliases
# Purpose: mirror the headless X cookie for :0 and current hostnames so
#          nvidia-settings works after hostname/FQDN changes.
# ---
set -euo pipefail

XAUTH_FILE="${XAUTHORITY:-/var/lib/fanboost/xauth}"

log() { printf '[ensure-fanboost-xauth] %s\n' "$*"; }

if [[ ! -f "$XAUTH_FILE" ]]; then
	log "skip: xauth file missing ($XAUTH_FILE)"
	exit 0
fi

mapfile -t entries < <(xauth -f "$XAUTH_FILE" list 2>/dev/null || true)
if ((${#entries[@]} == 0)); then
	log "skip: xauth file empty ($XAUTH_FILE)"
	exit 0
fi

cookie="$(
	printf '%s\n' "${entries[@]}" \
		| awk 'NF >= 3 && $2 == "MIT-MAGIC-COOKIE-1" { print $3; exit }'
)"
if [[ -z "${cookie:-}" ]]; then
	log "skip: no MIT-MAGIC-COOKIE-1 entry in $XAUTH_FILE"
	exit 0
fi

aliases=(
	':0'
	'localhost/unix:0'
	"$(hostname)/unix:0"
)
fqdn="$(hostname -f 2>/dev/null || true)"
if [[ -n "$fqdn" && "$fqdn" != "$(hostname)" ]]; then
	aliases+=("${fqdn}/unix:0")
fi
while IFS= read -r entry; do
	display="${entry%% *}"
	[[ -n "$display" ]] && aliases+=("$display")
done <<<"$(printf '%s\n' "${entries[@]}")"

added=0
seen='|'
for alias in "${aliases[@]}"; do
	[[ "$seen" == *"|${alias}|"* ]] && continue
	seen="${seen}${alias}|"
	if xauth -f "$XAUTH_FILE" list "$alias" 2>/dev/null | rg -Fq "$cookie"; then
		continue
	fi
	xauth -f "$XAUTH_FILE" add "$alias" . "$cookie"
	added=$((added + 1))
done

chmod 600 "$XAUTH_FILE" 2>/dev/null || true

if ((added > 0)); then
	log "added ${added} xauth alias(es) in $XAUTH_FILE"
else
	log "ok: xauth aliases already present ($XAUTH_FILE)"
fi
