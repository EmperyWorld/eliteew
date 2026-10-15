# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

# Installed metal: ping OK, SSH connection refused (no host keys)

| Field | Value |
|-------|--------|
| **status** | fixed |
| **date** | 2026-09-09 |
| **product_id** | trusted-substrate |
| **also_affects** | — |
| **severity** | install SoT / OpenSSH |

## Symptom

After GUI install COMPLETE + reboot: host answers ICMP on lab static IP, TCP/22 **connection refused**. Live USB SSH worked earlier.

## Failure layers

1. **Install archive** — `rootfs.tar.gz` included `sshd` + enablement unit but **no** `etc/ssh/ssh_host_*`.
2. **Live vs install asymmetry** — live media got host keys on first boot; pack-from-ext2 never generated keys into the install tarball.
3. **OpenSSH** — without host keys, daemon does not listen → refuse, not auth failure.

## Root cause

Install SoT omitted OpenSSH host key material **and** earlier pack-as-user left host keys owned by UID 1000 when they were later baked. OpenSSH refuses non-root host keys → daemon never listens (connection refused).

## Fix (cause layer — current SoT)

- **Do not** bake `ssh_host_*` into `images/rootfs.tar.gz`.
- `eliteew-ts-install-apply` — after extract: `rm` any host keys + `chroot … ssh-keygen -A` (unique per machine).
- `sshd.service.d/eliteew-ts-hostkeys.conf` — chown + `ssh-keygen -A` before start (heal).
- `pack-install-rootfs-metal.sh` — **copy-only** BR SoT; refuses archives that contain private host keys.
- Retired crutch: fuse-repack that baked shared keys into `out/rootfs.tar.gz`.

## Verification

```bash
gzip -dc images/rootfs.tar.gz | tar -t | rg 'ssh_host_.*_key$'   # must be empty
# after install:
ssh-keygen -l -f /etc/ssh/ssh_host_ed25519_key
ssh eliteew-ts@192.168.8.10 true
```

## Recommendations

Never ship install archive with sshd enabled and empty **or shared** `/etc/ssh/ssh_host_*`. Prefer install-time / first-boot `ssh-keygen -A` that blocks listen until keys exist.
