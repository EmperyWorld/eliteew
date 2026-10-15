# Command-center host scripts

| Script | Role |
|--------|------|
| `harden-command-center-host.sh` | OS harden on `.136`: SSH keys-only, Cockpit LAN, disable mdns/RGB leftovers; keeps NFS/nginx/NVIDIA/SDDM/xrdp |

Canon: `documentation/platform/PROD-CORE-HOST-HARDEN.md` §Command-center

```bash
sudo bash docker/scripts/command-center/harden-command-center-host.sh
```
