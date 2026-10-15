# Trusted Substrate — Tauri payload

The living product artifact is the Connected Desktop Client RPM
(`elite-ew-desktop-client` / `EliteEW_Desktop_Client-*.rpm`). Fedora kickstart
and ISO staging are retired; Buildroot `rootfs_overlay` is the only install SoT.

## Buildroot profile

| Flag | Value |
|------|-------|
| `PAYLOAD_ELECTRON` | `0` |
| `PAYLOAD_TAURI` | `1` |
| Pin | `config/payload-tauri.env` → RPM path, sha256, version |
| `payload_trust` | `tauri-living` |
| `payload_format` | `rpm` |

`scripts/bake-desktop-client-into-target.sh`, called by board `post-build.sh`,
installs the verified RPM payload into the Buildroot target as
`/usr/bin/eliteew-desktop-client` and seeds the payload slot. Missing path,
digest mismatch, or unsupported package fails the image build.

## Runtime

- labwc owns the multi-window session.
- `/usr/bin/eliteew-desktop-client` is preferred.
- The signed payload slot is the fallback/update path.
- W-transport remains owned by the Connection Agent, not the substrate.

## Verification

```bash
bash scripts/selftest-installer.sh
bash scripts/selftest-w6.sh
```

## Related

- [PAYLOAD-UPDATE.md](PAYLOAD-UPDATE.md)
- [ROOTFS-FROM-SOURCE.md](ROOTFS-FROM-SOURCE.md)
- `scripts/bake-desktop-client-into-target.sh`
