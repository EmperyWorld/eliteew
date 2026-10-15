# pack-organization / release

Org-door (Connection Agent) release notes and operator commands.

**Normative matrix:** [ELITEEW-PACK-LAYOUT.md](../../documentation/platform/ELITEEW-PACK-LAYOUT.md) §4 · checklist: [ELITEEW-RELEASE-CHECKLIST.md](../../documentation/platform/ELITEEW-RELEASE-CHECKLIST.md) §Pack release.

| Артефакт | Org |
|----------|:---:|
| stack0 SPA+API (тот же / их контур) | yes |
| Tauri Connection Agent RPM·NSIS | yes (`desktop-client-ota-release.sh`) |
| Seat / device license issue | yes (`desktop-client-issue-*.sh`) |
| Mobile APK | no (не обязателен) |

## Commands (command-center `.136`)

```bash
# Shared core when API/SPA contracts changed for agent session
bash docker/scripts/eliteew-deploy.sh release stack0 --all

# Org door — Connection Agent OTA (RPM / FoFline pack as scripted)
bash scripts/eliteew/desktop-client-ota-release-preflight.sh
bash scripts/eliteew/desktop-client-ota-release.sh
```

Code tree: `pack-organization/connection-agent/` (not under `EliteEW/`).

## Forbidden in this contour

- Treating org OTA as part of `eemobile` / cloud mobile cycle.
- Setting `ELITEEW_PACK_RELEASE=cloud` while running connection-agent OTA.

Override cross-door only with explicit `ELITEEW_PACK_ALLOW_CROSS_DOOR=1` (ops exception).
