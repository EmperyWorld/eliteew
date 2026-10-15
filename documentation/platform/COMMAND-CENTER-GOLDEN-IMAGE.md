# Command-center golden image (`.136`)

**Status:** living ops (2026-09-23). **Not** a Ministry registry product image. **Not** Trusted Substrate / EmpiierOS.

## Purpose

Reproducible **Fedora Server 44** install for **command-center** (`192.168.1.136`, `empery.world`): builds, git, env staging, podman, dev tooling. Target migration hardware: **Ryzen 9 5950X** + **RTX 5060 Ti** + **new NVMe** (install disk wiped).

Prod runtime stays on **prod-core `.111`**. ComfyUI after migration: **gpu141** `:31003` — not baked into this image.

## Build tree

```text
pack-organization/command-center-image/
  kickstart/eliteew-command-center.ks
  pack-organization/command-center-image/scripts/prepare-payload.sh | build-iso.sh | verify-iso.sh
  payload/                  # firstboot, README, image.json
  out/                      # generated ISO (gitignored)
```

Quick start: [pack-organization/command-center-image/README.md](../../pack-organization/command-center-image/README.md).

**USB boot:** xorriso remaster must use `-boot_image any replay` (see `build-iso.sh`). If the installer dies right after GRUB, rebuild the ISO and re-`dd` — or `cd pack-organization/command-center-image && sudo FORCE_MKKSISO=1 bash pack-organization/command-center-image/scripts/build-iso.sh` (lorax).

## Install invariants

| Rule | Why |
|------|-----|
| Boot ISO only on **new CC SSD** | Kickstart `clearpart --all` |
| LUKS passphrase | Operator enters at Anaconda (`autopart --encrypted`) |
| First boot | `eliteew-cc-firstboot.service` — RPM Fusion, **akmod-nvidia** (5060 Ti), `tuned throughput-performance`, optional bundled harden |
| No prod autostart | `eliteew-podman-autostart` stays off on `.136` |
| Clone monorepo after install | Image does not ship `powered_by_emperyworld` |

## Post-install (first hour)

1. **`passwd`** — drop kickstart temp password.
2. **`ssh-copy-id owned@192.168.1.136`** from workstation (before harden turns off password SSH).
3. First boot: `sudo systemctl status eliteew-cc-firstboot.service` · log `/var/log/eliteew-cc-firstboot.log` · stamp `/var/lib/eliteew-cc-firstboot.done`. Reboot once if `akmod-nvidia` built a module.
4. **`nvidia-smi`** on 5060 Ti after reboot.
5. Forgejo deploy key on host → clone `ssh://git@130.193.43.111:2222/eliteew/powered_by_emperyworld.git` to `/data/repos/powered_by_emperyworld` (checkouts live under `/data/repos/`, not the home directory). Scripts resolve the checkout from their own location.
6. **`pack-organization/command-center-image/scripts/post-install-on-host.sh`** — status + optional `ELITEEW_CC_CLONE=1` deps.
7. **Drivers + utilities (5060 Ti, Ryzen microcode, build/podman CLI):**  
   `sudo bash pack-organization/command-center-image/scripts/install-host-drivers-and-tools.sh`  
   (optional ` --with-amnezia` if `awg-quick` not installed). **Secure Boot:** reboot → enroll **MOK** when akmods prompts → `nvidia-smi`.
8. **`sudo bash docker/scripts/command-center/harden-command-center-host.sh`** (from clone; needs working SSH key). LAN-only SSH/Cockpit: **`ew-cc harden-lan`** or **`sudo bash ~/ewonika/scripts/eliteew-cc-firewall-lan.sh`** (removes zone-wide `ssh`/9090, binds `192.168.1.136:9090`, `ListenAddress`, LLMNR off).
9. **`bash .vscode/preflight-check.sh`** · optional **`sudo bash .vscode/install-os-dev-tools.sh`** (subset; step 7 covers most).

### Network modes (`.136`)

Script **`eliteew-cc-network-mode.sh`** (install: `install-network-mode.sh`; lists `config/*.txt` → `/etc/eliteew/`). Human-readable catalog: `sudo eliteew-cc-network-mode.sh help`.

| Mode | Name | Behavior |
|------|------|----------|
| **1** | Plain WAN | VPN off; default route via LAN gateway; prod-core/LAN unchanged. |
| **2** | Full Amnezia tunnel | All IPv4 via `awg0` (split excludes `192.168.1.0/24`). For NetVM-style egress, not daily idle on CC. |
| **3** | LAN only | No default route; `nft` drops non-LAN egress. Build-host isolation. |
| **4** | **Daily CC (recommended)** | LAN local; hosts in `direct-allow-domains.txt` direct to WAN; Cursor/API hosts in `cursor-vpn-domains.txt` via VPN (split `AllowedIPs` + routes + `nft`). |

VPN canonical file: install **`amnezia_for_awg.conf`** → `/etc/amnezia/amneziawg/awg0.conf`, then `sudo eliteew-cc-network-mode.sh sync-base` → `awg0.conf.base` (modes 2/4 generate profiles from `.base`, not from last tunnel profile). TUI: `sudo python3 net_mon.py` — keys **1–4**, **h** for mode help.

**Mode switch latency:** `eliteew-cc-network-mode.sh 1|2|4` no longer runs **metalink curl** on every switch (only reinstalls nft from cached `/var/lib/eliteew-cc-block-tld-ips`). Refresh mirror IPs explicitly: `sudo eliteew-cc-network-mode.sh refresh-block-tld` (prefer **mode 1**). `awg-quick` up/down uses 25s/45s timeouts + forced teardown of stuck `amneziawg-go`. Modes **2** and **4** set interface **MTU 1280** and `net.ipv4.tcp_mtu_probing=1`: MTU 1420 plus Amnezia overhead stalls large TCP (speed falls to 0) until the tunnel is recreated. Mode **4** reuses `/var/lib/eliteew-cc-mode4-*-ips` and does not resolve through the tunnel; `refresh-4` resolves via the LAN gateway with a 1s cap per name. Modes **1** and **3** delete `0.0.0.0/1` and `128.0.0.0/1`. Mode **3** DNS is only the LAN gateway.

**NetworkManager vs awg0:** install drop-in `/etc/NetworkManager/conf.d/99-eliteew-awg0-unmanaged.conf` (`interface-name:awg0` unmanaged) so VPN stays on **awg-quick** + CC-Net only — not NM «external activate». Bundled in `install-network-mode.sh` / `ew-cc install`.

**Fedora dnf:** host and prod-core use only `https://dl.fedoraproject.org` (`sudo bash docker/scripts/eliteew-dnf-official-host.sh`). Metalink is off. RPM Fusion, when used for the NVIDIA driver, is pinned to `https://download1.rpmfusion.org` with metalink off. Chrome, Cursor, COPR, Steam, and Cisco OpenH264 stay disabled. `/usr/local/bin/dnf` stops the transaction if a package URL host is anything other than those two official hosts. `dnf-mirror-policy` no longer rewrites `country=` mirror lists. **Blocked TLD (e.g. `.ua`):** `/etc/eliteew/blocked-tld-zones.txt` and optional `refresh-block-tld` (nft `inet eliteew_cc_block` egress drop only for **hostnames ending in the blocked TLD**, e.g. `*.ua` — not MirrorManager `location=UA`, which shared mirror IPs and broke dnf). That table is **not** the mode **4** direct allowlist (`inet eliteew_cc`); allowlist nft is installed only in mode **4** and removed by `nft_flush` on **1/2/3**. Mode **4** host routes (`/32` → awg0) are cleared on exit to **1/2/3** via `cleanup_mode4_split_routes`. Uses **current** routing — no script overrides CC-Net mode. **Install/driver scripts never switch modes:** mode **1** = WAN without VPN, mode **2** = full VPN — operator choice only (`eliteew-cc-network-mode.sh 1|2|3|4`).

### Optional: Amnezia (CLI, not GUI)

The **AmneziaVPN** `.run` app is desktop/GUI. On Server use **AmneziaWG**: COPR `amneziavpn/amneziawg`, then **`awg-quick`** + **`awg-quick@.service`**. Script: `pack-organization/command-center-image/scripts/install-amneziawg-client.sh`. Export config from the mobile/desktop Amnezia app. On **command-center**, prefer **split tunnel** (keep **`192.168.1.0/24`** off the VPN) so LAN builds/prod-core stay reachable.

## Post-install smoke

```bash
bash docker/scripts/eliteew-command-center.sh smoke
```

Harden (from git, idempotent):

```bash
sudo bash docker/scripts/command-center/harden-command-center-host.sh
```

## Related

- Host harden: [PROD-CORE-HOST-HARDEN.md](PROD-CORE-HOST-HARDEN.md) §Command-center
- Topology: [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current
- Kiosk ISO pattern (different SKU): [docker-re_doc/KIOSK-FEDORA-SERVER-ISO.md](docker-re_doc/KIOSK-FEDORA-SERVER-ISO.md)
