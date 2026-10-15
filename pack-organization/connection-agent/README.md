# EliteEW organization connection agent

Explanation · source inspection dated 2026-10-11. This Tauri 2 application provides native connected/offline-capable entrances over shared EliteEW contracts. [Connected-client canon](../../documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md), [security boundaries](../../documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md) and [version authority](../../documentation/product/desktop/DESKTOP-CLIENT-VERSION-SOT.md) own detailed behavior.

## Source and versions

[package.json](package.json), [Cargo.toml](src-tauri/Cargo.toml) and [tauri.conf.json](src-tauri/tauri.conf.json) all declare tree version **0.5.37** at this audit revision. A tree version does not certify the currently published channel. [release-state.v1.json](docs/release-state.v1.json) and release metadata have separate roles. The prior README's 0.4.63 tree version was stale.

The frontend uses React/Vite and pins **pnpm 11.21.0**, independently of the browser SPA's pnpm 12 pin. The Rust workspace includes `w-transport-core` and `wg-portal-helper`. Default feature `retail` and optional `ops-system-wg` select different native capabilities.

## Local development

With the pinned package manager, Rust and platform-native Tauri prerequisites installed:

```bash
cd pack-organization/connection-agent
pnpm install --frozen-lockfile
pnpm tauri dev
pnpm test
```

[The Tauri build configuration](src-tauri/tauri.conf.json) points development at port 1420 and packages `dist`. Linux WebKit/GTK libraries and Windows tooling are platform-specific requirements; inspect [build scripts](scripts/) before installing them. The following are declared package scripts, not builds executed by the documentation audit:

```bash
pnpm run build:linux
pnpm run build:windows
```

Linux output is RPM; Windows output is NSIS. Signing/updater and FoFline builds have separate scripts/config overlays. Do not substitute an unsigned local bundle for a published updater artifact.

## Runtime boundaries

Native Rust code owns device identity, entitlement validation, capsule import, transport and update verification. The frontend uses [tauri-bridge](src/lib/tauri-bridge/) and product feature UI; inspect the bridge exports before exposing native actions.

Retail capsule import keeps channel configuration on the native side; plaintext seat JSON with channel configuration is rejected. `seat_channel_bring_up` and system WireGuard IPC belong to the operator profile. Offline entitlement uses signed verification and sealed local storage; selected offline panels are not full cloud feature parity.

## Operator operations

Seat/capsule/entitlement issuance writes backend data and must use an authorized operator workflow. Relevant scripts live at the repository root, so first return there before following the issuance runbook:

- [Seat issuance](../../scripts/eliteew/desktop-client-issue-seat.sh)
- [Connected issuance](../../scripts/eliteew/desktop-client-issue-connected.sh)
- [Entitlement issuance](../../scripts/eliteew/desktop-client-issue-entitlement.sh)
- [Air enrollment](../../documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md)

Signing material belongs to the operator/configuration plane. Public verification keys are baked into release configuration; do not put signing seeds, tokens or channel configuration into examples or frontend code. Authenticode availability and published Windows/Linux channel parity require release evidence.

## Related documents

- [Launcher journey](../../documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md)
- [FoFline](../../documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md)
- [Offline-policy helpers](../../shared/packages/kernel-offline-policy/README.md)
- [Pack layout](../../documentation/platform/ELITEEW-PACK-LAYOUT.md)
