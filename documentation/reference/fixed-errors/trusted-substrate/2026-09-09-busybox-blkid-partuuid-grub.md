# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — post-install GRUB: no such device /dev/nvme0n1p2 from poisoned PARTUUID.
# ---

# trusted-substrate — BusyBox blkid poisoned PARTUUID in grub.cfg

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-09` |
| **product_id** | `trusted-substrate` |
| **symptom** | Install “complete” quickly; reboot GRUB: `error: no such device "/dev/nvme0n1p2"` |
| **failure layer** | apply grub.cfg generation |
| **root cause** | Live `blkid` is BusyBox; `blkid -s PARTUUID -o value` ignored flags and returned `/dev/nvme0n1p2: LABEL=… UUID=…`. That string was written as `root=PARTUUID=…`. |
| **fix** | `lsblk -no PARTUUID/UUID` + UUID-shape gate; write grub.cfg to `/boot/grub` and ESP `EFI/BOOT`. |
| **verification** | Log line showed poisoned PARTUUID; stick has BusyBox blkid + util-linux lsblk. |
