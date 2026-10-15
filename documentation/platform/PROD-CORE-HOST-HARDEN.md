# Prod-core host harden (OS / firewall / SSH)

Operator one-shot after BIOS / desktop drift on **prod-core `.111`**:

```bash
sudo env ELITEEW_HARDEN_SKIP_NVIDIA=1 \
  bash docker/scripts/prod-core/harden-prod-core-host.sh
```

What it does:

| Area | Result |
|------|--------|
| firewalld | Default **FedoraServer**; no Workstation `1025-65535` open range; SSH; Cockpit `9090` only from `192.168.1.0/24` + `192.168.8.10`; Meet media `10.77.77.1 → udp/34000`; Meet WG **HTTP backhaul** `10.77.77.1 → tcp/{29000,29001,29002,36000,13402,29180,29173}` + `wg0` in zone; LAN DNS `8053` |

Without the HTTP backhaul TCP rules, edge sees `No route to host` to `10.77.77.2:29001` and public `app.eliteew.ru` returns **502** while local `:29000/:29001` stay healthy. Canon: `documentation/platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md`.

Live repair (prod-core, root):

```bash
ZONE=FedoraServer
EDGE=10.77.77.1
for p in 29000 29001 29002 36000 13402 29180 29173; do
  sudo firewall-cmd --permanent --zone="$ZONE" \
    --add-rich-rule="rule family=\"ipv4\" source address=\"${EDGE}/32\" port port=\"${p}\" protocol=\"tcp\" accept"
done
sudo firewall-cmd --permanent --zone="$ZONE" --add-interface=wg0
sudo firewall-cmd --reload
bash docker/scripts/yandex-tunnel/wg-backhaul/verify-wg-backhaul.sh
```
| Cockpit | Remains enabled; **9090** gated to LAN (+ optional extra CIDR env); CC script binds socket to `.136` |
| SSH | `/etc/ssh/sshd_config.d/00-eliteew-prod.conf` (before `50-redhat.conf`): **PasswordAuthentication no**, X11 off |
| Services off | nexus-fleet (+ unit files retired under `/var/tmp/eliteew-retired-units/`), avahi, cups, abrt*, cooler/lact, bluetooth, plasmalogin, qemu-ga, iscsi, sssd, noisy nvidia units until drivers |
| resolved | LLMNR/mDNS off (`/etc/systemd/resolved.conf.d/99-eliteew-prod.conf`) |
| journald | Cap `SystemMaxUse=800M`, retain 14d |
| User timers | Disables duplicate `eliteew-meet-media-guard` + retired `eliteew-ssfew-agent` |
| Meet guard | Keeps **system** timer; drop-in `CONTAINER_HOST=unix:///run/user/1000/podman/podman.sock` |

NVIDIA is **not** installed by this script when `ELITEEW_HARDEN_SKIP_NVIDIA=1`. After you install drivers:

```bash
sudo modprobe nvidia && sudo nvidia-smi
sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml
sudo systemctl enable --now nvidia-persistenced
bash docker/scripts/prod-core/start-stack9-voice.sh
ELITEEW_PROD_CORE_LOCAL=1 bash docker/scripts/start-prod-core-stacks.sh stack2
```

## Command-center (`.136`) twin

Operator plane (builds, NFS export, SDDM/xrdp; living ComfyUI is on **gpu141**, not `.136`) — similar but **keeps** NFS/nginx/NVIDIA/SDDM/xrdp:

```bash
sudo bash docker/scripts/command-center/harden-command-center-host.sh
# optional RGB cleanup (script prints hint):
sudo dnf remove -y coolercontrol coolercontrold lact openrgb openrgb-udev-rules
```

Disables wrong-host `eliteew-meet-media-guard` user timer on `.136` (Meet JVB lives on prod-core).
