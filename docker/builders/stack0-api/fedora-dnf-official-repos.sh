#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Point Fedora dnf at dl.fedoraproject.org and turn off MirrorManager metalink.
# Invariants:
# - dl.fedoraproject.org serves the Fedora tree itself (HTTP 200, no redirect).
# - download.fedoraproject.org is MirrorManager and 302s to volunteer mirrors.
# - fedora-cisco-openh264 is disabled for image builds (not the Fedora tree).
# - /usr/local/bin/dnf aborts the build if a package URL host is not dl.fedoraproject.org.
# Related:
# - docker/builders/stack0-api/Dockerfile
# - docker/builders/stack0-frontend/Dockerfile
# - docker/builders/stack0-api/Dockerfile.prod-baked
# ---
set -euo pipefail

REPO_DIR="${1:-/etc/yum.repos.d}"

if [[ ! -d "${REPO_DIR}" ]]; then
  echo "ERROR: repo dir missing: ${REPO_DIR}" >&2
  exit 1
fi

shopt -s nullglob
files=("${REPO_DIR}"/fedora*.repo)
if [[ "${#files[@]}" -eq 0 ]]; then
  echo "ERROR: no fedora*.repo under ${REPO_DIR}" >&2
  exit 1
fi

rewrite_repo() {
  local src="$1"
  local tmp
  tmp="$(mktemp)"
  awk '
    /^metalink=/ {
      print "#" $0
      next
    }
    /^#?baseurl=https?:\/\/(download\.fedoraproject\.org|download\.example)\/pub\/fedora\// {
      sub(/^#/, "")
      sub(/https?:\/\/(download\.fedoraproject\.org|download\.example)/, "https://dl.fedoraproject.org")
      print
      next
    }
    /^countme=/ {
      print "countme=0"
      next
    }
    { print }
  ' "${src}" >"${tmp}"

  if grep -qE '^metalink=' "${tmp}"; then
    echo "ERROR: metalink still active in ${src}" >&2
    exit 1
  fi
  if grep -qE '^#baseurl=https?://(download\.fedoraproject\.org|download\.example)/' "${tmp}"; then
    echo "ERROR: non-official baseurl still commented in ${src}" >&2
    exit 1
  fi

  local metalink_n base_n
  metalink_n="$(grep -cE '^#metalink=.*mirrors\.fedoraproject\.org' "${tmp}" || true)"
  base_n="$(grep -cE '^baseurl=https://dl\.fedoraproject\.org/' "${tmp}" || true)"
  if [[ "${metalink_n}" -gt 0 && "${base_n}" -lt "${metalink_n}" ]]; then
    echo "ERROR: ${src} has ${metalink_n} metalink entries and ${base_n} official baseurls" >&2
    exit 1
  fi

  mv "${tmp}" "${src}"
  chmod 644 "${src}"
}

rewritten=0
for f in "${files[@]}"; do
  base="${f##*/}"
  if [[ "${base}" == "fedora-cisco-openh264.repo" ]]; then
    continue
  fi
  if ! grep -qE '^(#)?metalink=.*mirrors\.fedoraproject\.org' "${f}"; then
    continue
  fi
  rewrite_repo "${f}"
  rewritten=1
done

active="$(grep -R -E '^metalink=' "${REPO_DIR}"/fedora*.repo || true)"
active="$(printf '%s\n' "${active}" | grep -v 'fedora-cisco-openh264\.repo' || true)"
if [[ -n "${active}" ]]; then
  echo "ERROR: active Fedora metalink remains" >&2
  printf '%s\n' "${active}" >&2
  exit 1
fi

if [[ "${rewritten}" -eq 0 ]]; then
  if ! grep -R -E '^baseurl=https://dl\.fedoraproject\.org/' "${REPO_DIR}"/fedora*.repo >/dev/null; then
    echo "ERROR: Fedora repos were not pinned to dl.fedoraproject.org" >&2
    exit 1
  fi
fi

install_dnf_guard() {
  [[ "${REPO_DIR}" == "/etc/yum.repos.d" ]] || return 0
  local cisco="${REPO_DIR}/fedora-cisco-openh264.repo"
  if [[ -f "${cisco}" ]]; then
    sed -i 's/^enabled=1/enabled=0/' "${cisco}"
  fi
  cat > /usr/local/bin/dnf << 'EOF'
#!/usr/bin/env bash
# Abort when dnf fetches RPM metadata or packages from anywhere but the official tree.
set -euo pipefail
if [[ "$(id -u)" -eq 0 ]]; then
  if [[ -x /usr/local/libexec/eliteew/fedora-dnf-official-repos.sh ]]; then
    bash /usr/local/libexec/eliteew/fedora-dnf-official-repos.sh
  elif [[ -x /tmp/fedora-dnf-official-repos.sh ]]; then
    bash /tmp/fedora-dnf-official-repos.sh
  fi
fi
log="$(mktemp)"
dnf_log=""
log_before=0
for candidate in /var/log/dnf5.log /var/log/dnf.log; do
  if [[ -f "${candidate}" ]]; then
    dnf_log="${candidate}"
    log_before="$(wc -c < "${candidate}")"
    break
  fi
done
set +e
set +o pipefail
dl_jobs="$(nproc)"
if [[ "${dl_jobs}" -gt 10 ]]; then
  dl_jobs=10
fi
/usr/bin/dnf --setopt=max_parallel_downloads="${dl_jobs}" "$@" 2>&1 | tee "${log}"
rc="${PIPESTATUS[0]}"
set -e
set -o pipefail
if [[ -n "${dnf_log}" && -f "${dnf_log}" ]]; then
  tail -c +$((log_before + 1)) "${dnf_log}" >> "${log}" || true
fi
bad=0
declare -A hosts=()
while IFS= read -r url; do
  [[ -n "${url}" ]] || continue
  url="${url%%)*}"
  url="${url%%,*}"
  url="${url%%]*}"
  host="${url#*://}"
  host="${host%%/*}"
  host="${host%%:*}"
  case "${url}" in
    *.rpm|*/repodata/*|*/Packages/*|*metalink*|*mirrorlist*)
      hosts["${host}"]=1
      case "${host}" in
        dl.fedoraproject.org|download1.rpmfusion.org) ;;
        *)
          echo "ERROR: dnf fetched from non-official mirror host ${host}" >&2
          echo "ERROR: url ${url}" >&2
          bad=1
          ;;
      esac
      ;;
  esac
  case "${host}" in
    *.ua|*.vn.ua)
      echo "ERROR: dnf contacted blocked mirror zone host ${host}" >&2
      echo "ERROR: url ${url}" >&2
      bad=1
      ;;
  esac
done < <(grep -oE 'https?://[^[:space:]'\''"<>]+' "${log}" || true)
if [[ "${#hosts[@]}" -gt 0 ]]; then
  echo "DNF_FETCH_HOSTS: ${!hosts[*]}"
fi
needs_fetch=0
case " $* " in
  *" install "*|*" update "*|*" upgrade "*|*" reinstall "*|*" distro-sync "*) needs_fetch=1 ;;
esac
if [[ "${needs_fetch}" -eq 1 && "${rc}" -eq 0 && "${#hosts[@]}" -eq 0 ]]; then
  if grep -qE 'Nothing to do|already installed' "${log}"; then
    echo "DNF_FETCH_HOSTS: none (nothing to do)"
  elif grep -R -E '^metalink=' /etc/yum.repos.d/fedora.repo /etc/yum.repos.d/fedora-updates.repo /etc/yum.repos.d/fedora-updates-testing.repo >/dev/null 2>&1; then
    echo "ERROR: dnf package command finished with metalink still active" >&2
    exit 1
  else
    echo "DNF_FETCH_HOSTS: dl.fedoraproject.org (pinned baseurl)"
  fi
fi
if [[ "${bad}" -ne 0 ]]; then
  exit 1
fi
exit "${rc}"
EOF
  chmod 755 /usr/local/bin/dnf
}

install_dnf_guard

echo "DNF_BASEURLS:"
grep -R -E '^baseurl=' "${REPO_DIR}"/fedora*.repo | grep -v 'fedora-cisco-openh264\.repo' || true
echo "fedora dnf repos pinned to https://dl.fedoraproject.org (no MirrorManager)"
