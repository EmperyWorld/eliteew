# Prod-core host scripts (`.111`)

Run on prod-core or via SSH from command-center. User-facing egress CLI remains `eliteew-podman-egress.sh` (wraps these helpers).

| Script | Role |
|--------|------|
| `apply-podman-egress-lock.sh` | apply / verify / set-mode / status-json (egress NFT) |
| `podman-egress-lib.sh` | policy helpers |
| `podman-egress-monitor.sh` | write status JSON (timer) |
| `harden-prod-core-host.sh` | OS harden: firewall FedoraServer, SSH keys-only, Cockpit LAN, disable leftovers |
| `refresh-nvidia-cdi.sh` | Refresh NVIDIA CDI after driver/stack changes |
| `start-stack9-voice.sh` | Whisper large-v3 + Silero v5 CIS (soft-fail on boot if NVIDIA down) |

**Canon:** `documentation/platform/docker-re_doc/PROD-CORE-PODMAN-EGRESS.md`, `documentation/platform/PROD-CORE-HOST-HARDEN.md`

```bash
# From command-center / on prod-core
sudo env ELITEEW_HARDEN_SKIP_NVIDIA=1 bash docker/scripts/prod-core/harden-prod-core-host.sh
bash docker/scripts/prod-core/start-stack9-voice.sh

bash docker/scripts/eliteew-podman-egress.sh install
bash docker/scripts/eliteew-podman-egress.sh status
```
