# EliteEW command-center golden image (`.136`)

Unattended **Fedora Server 44** install media for **command-center** — build/deploy plane, not prod runtime and not a registry product image.

**Target hardware (2026 migration):** Ryzen 9 5950X-class host, **RTX 5060 Ti**, fresh NVMe (install disk is **wiped**).

**Canon:** [documentation/platform/COMMAND-CENTER-GOLDEN-IMAGE.md](../../documentation/platform/COMMAND-CENTER-GOLDEN-IMAGE.md)

## Wipe warning

Kickstart uses `zerombr` + `clearpart --all`. Booting this ISO on the wrong disk **destroys data**. Use only the **new command-center SSD**.

## Build (on any Fedora host with `lorax` or `xorriso`)

```bash
cd <repo>/pack-organization/command-center-image
cp -n config.env.example config.env
# Edit BASE_ISO, optional SSH_PUBLIC_KEY for user owned
bash scripts/prepare-payload.sh
bash scripts/build-iso.sh
bash scripts/verify-iso.sh
```

Output: `out/EliteEW-CC-F44-YYYYMMDD-HHMM.iso`

## Install

1. Boot ISO on target machine (UEFI, target = **new** SSD only).
2. Anaconda runs unattended kickstart (network: **static `192.168.1.136/24`** if the installer NIC is up; otherwise fix NM on first boot).
3. Reboot → **`eliteew-cc-firstboot.service`** (NVIDIA akmod, tuned, linger, optional harden).
4. Read `/opt/eliteew-cc/README-FIRST.txt` on the host.
5. Clone monorepo, `.venv`, **do not** start prod stack0 on `.136`.

## After install

On **`.136`** as `owned` (or copy script from workstation):

```bash
bash /path/to/post-install-on-host.sh
# After Forgejo SSH key: ELITEEW_CC_CLONE=1 bash post-install-on-host.sh
```

From workstation: `ssh-copy-id owned@192.168.1.136` **before** harden disables password auth.

```bash
bash docker/scripts/eliteew-command-center.sh smoke
```

ComfyUI lives on **gpu141** after migration — not on this image.
