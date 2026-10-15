# pack-cloud / release

Cloud-door release notes and operator commands.

**Normative matrix:** [ELITEEW-PACK-LAYOUT.md](../../documentation/platform/ELITEEW-PACK-LAYOUT.md) §4 · checklist: [ELITEEW-RELEASE-CHECKLIST.md](../../documentation/platform/ELITEEW-RELEASE-CHECKLIST.md) §Pack release.

| Артефакт | Cloud |
|----------|:-----:|
| stack0 SPA+API bake | yes (`eliteew-deploy.sh release stack0 --all`) |
| Mobile APK / OTA | yes (`eemobile --yes --all`) |
| Tauri Connection Agent | **no** |

## Commands (command-center `.136`)

```bash
# Shared core (always with product SPA/API changes)
bash docker/scripts/eliteew-deploy.sh release stack0 --all

# Cloud door — Mobile only
source docker/scripts/eliteew-docker-aliases.sh
eemobile --yes --all
# equivalent:
bash docker/scripts/mobile-apk-release-cycle.sh --yes --all
```

## Forbidden in this contour

- Building / publishing `pack-organization/connection-agent` (Tauri RPM/NSIS).
- Setting `ELITEEW_PACK_RELEASE=org` while running `eemobile`.

Override cross-door only with explicit `ELITEEW_PACK_ALLOW_CROSS_DOOR=1` (ops exception).
