# Shared offline-policy helpers

Reference · source inspection dated 2026-10-11. `@eliteew/kernel-offline-policy` is a private TypeScript workspace package used by the SPA and connection agent. [package.json](package.json) exports [src/index.ts](src/index.ts) directly; it is not a separately published npm service.

## Public interface

The exports provide policy lookup, presentation/deep-link/subset predicates, app-id lists, Russian labels/catalog hints, subset breakdown and `SPA_OPEN_APP_QUERY` (`eliteewOpenApp`). Mount modes are `presentation_url`, `o5_panel_only`, and `spa_offline_only`. A policy entry describes eligibility and presentation; it does not enforce backend authorization or make a network feature work offline.

## Policy and consumers

The code imports [its embedded JSON copy](src/kernelOfflineMounts.policy.json). The repository host copy is [host/kernel-offline/kernelOfflineMounts.policy.json](../../../host/kernel-offline/kernelOfflineMounts.policy.json); [sync](../../../scripts/eliteew/desktop-client-kernel-offline-policy-sync.sh) and [catalog parity](../../../scripts/eliteew/desktop-client-kernel-offline-catalog-parity.sh) scripts own alignment. Comments/package descriptions still mention a retired `EliteEW/shared` location; the live host path above is authoritative for this layout.

Consumers resolve `workspace:*` through their own pnpm workspaces. See [frontend workspace](../../web/frontend/pnpm-workspace.yaml) and [connection-agent workspace](../../../pack-organization/connection-agent/pnpm-workspace.yaml). Avoid changing policy copies independently.

## Tests and limits

`pnpm test` is declared in this package and runs Vitest after dependencies are prepared. The documentation audit checked the exports and consumer manifests; it did not run this test or synchronization scripts. Runtime offline coverage is owned by [the mount bridge canon](../../../documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md).
