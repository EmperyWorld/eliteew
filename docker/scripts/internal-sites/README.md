# Internal sites / CoreDNS / host DNS helpers

Operator CLIs for **stack12** CoreDNS, host resolver, firewalld, and optional wildcard certs.
Compose: `docker/stack/stack12.yml`. Env: `docker/env_file/.env.stack12`.

**Canon:** `documentation/platform/docker-re_doc/INTERNAL-DNS.md`, `INTERNAL-SITES-ACCESS.md`, `EMPERY-EDGE-IP-OPERATIONS.md`

## Script map

| Path | Role |
|------|------|
| `coredns/` | Live Corefile + zone/hosts overrides (mounted by stack12) |
| `configure-host-resolver-empery-tunnel.sh` | Host systemd-resolved → edge tunnel DNS |
| `validate-empery-tunnel-security.sh` | Edge/DNS/tunnel security checks |
| `apply-firewalld-internal-only.sh` | firewalld LAN HTTP/HTTPS/DNS allow |
| `block-lan-empery-https-firewalld.sh` | Block LAN bypass of edge for `*.eliteew.ru` |
| `site-studio-dns-tls-controller.py` | Site Studio custom-domain DNS/TLS controller |
| `cert-common.sh` + `issue-wildcard-cert*.sh` / `renew-wildcard-cert.sh` / `install-offline-cert*.sh` | Optional ACME / offline cert helpers |
| `empery-tunnel-dns-guard.service` / `.timer` | Periodic DNS stub guard |
| `resolved-dnsstublistener-no.conf.example` | resolved drop-in example |

## Prefer

```bash
sudo bash docker/scripts/internal-sites/configure-host-resolver-empery-tunnel.sh
sudo bash docker/scripts/internal-sites/validate-empery-tunnel-security.sh
sudo bash docker/scripts/internal-sites/apply-firewalld-internal-only.sh

python3 docker/scripts/internal-sites/site-studio-dns-tls-controller.py --mode dry-run
```

Do not resurrect WireGuard-in-docker for stack12 — overlays are host/MikroTik/VPS (see INTERNAL-DNS.md).
