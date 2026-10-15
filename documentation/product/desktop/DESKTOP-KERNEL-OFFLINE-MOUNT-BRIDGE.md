# Desktop Kernel offline — mount bridge (Wave K0–K17)

**Status:** living design — Waves **K0–K17** Done as spikes; Kernel offline **not** product Done (`desktop-client-007` still open).
**Edition:** `client` (shared Kernel contract).
**Backlog:** `desktop-client-007` · Post-3b.1 ops chain **#6**.
**Related:** [DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md) §8.1 · [ELITEEW-CLIENT-OFFLINE-AI-PACK.md](../../platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md) · editions [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](../../platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md).

## 1. Intent

Move toward **offline-capable Desktop Kernel** without claiming Done and without replacing O5 device-local panels in one jump.

## 2. SoT layers

| Layer | Location |
|-------|----------|
| **Policy SoT JSON** | [`host/kernel-offline/kernelOfflineMounts.policy.json`](../../../host/kernel-offline/kernelOfflineMounts.policy.json) (`schema_version` **7**) |
| **TS package** | [`@eliteew/kernel-offline-policy`](../../../shared/packages/kernel-offline-policy) — pnpm `workspace:*`; embeds JSON under `src/` |
| Packaging + package embed | `desktop-client-kernel-offline-policy-sync.sh` |
| SPA / desktop-client | workspace consumers |
| Rust | `include_str!` of shared SoT — opens **`presentation_url` only** |

```bash
bash scripts/eliteew/desktop-client-kernel-offline-policy-sync.sh
bash scripts/eliteew/desktop-client-kernel-offline-catalog-parity.sh
```

## 3. Mount modes

| Mode | Meaning |
|------|---------|
| `presentation_url` | Tauri Kernel Webview + path (O5 pack) |
| `o5_panel_only` | Device-local O5 panel; optional `spa_deep_link` into cloud Desktop |
| `spa_offline_only` | SPA `offline_spa_subset` **beyond** O5 pack (no Tauri local panel; **no** `spa_deep_link`) |

Living `spa_offline_only` ids: **DocEditor**, **DocEditorV2**, **Presentations**, **PresentationsArchive**, **EmperyNexusChronicleApp**, **PoemmaApp**, **AssistantApp** (K17 Assistant), **DesktopShellSettings**, **DesktopWidgetShelfApp**, **DesktopDashboardFavoritesApp**, **DesktopAppMaintenance** (K16). Allowlist only.

**Note:** Poemma stays `edition_default.client: false` (needs auth/postgres for cloud sync). K15 only opens the SPA offline gate when the install profile already enables Poemma — it does **not** grow the O5 Tauri client pack. K16 adds the local maintenance chrome screen to SoT labels (already install-profile exempt). **K17:** Assistant (`AssistantApp`) is `spa_offline_only` with FAQ catalog `localStorage` cache + honest LLM/SSE disable offline; `offline_capable: partial`; `client: false` unchanged (FoFline / onprem profiles still gate install).

## 4. Offline UX (K13–K17)

Start Menu notice + deny toast use `formatKernelOfflineSubsetNoticeRu()` with **user `label_ru`** (not mount ids / ops jargon):

`Офлайн сейчас: на устройстве — {labels…}; в рабочем столе — {labels…}.`

Helpers: `kernelOfflineSubsetBreakdown()` / `kernelOfflineLabelRu()` in `@eliteew/kernel-offline-policy`.

Assistant (K17): banner in `AssistantApp` distinguishes cached FAQ vs cold empty; composer / «Спросить» denied offline without silent fallback.

## 5. Bridge directions

| ID | Approach | Status |
|----|----------|--------|
| **A–F** | presentation / SoT / spa_deep_link / subset gate / catalog UX | **Living (K0–K7)** |
| **G–H** | Private package + `workspace:*` | **K8–K9** |
| **I** | SPA offline mounts beyond O5 pack | **K10–K17** |
| **J** | Honest pack vs SPA-only offline notice | **K13–K17 living** |

## 6. Non-goals (hard)

- Claiming `desktop-client-007` Done
- Publishing `@eliteew/kernel-offline-policy` to a public npm registry
- Offline for full `APP_MOUNTED_COMPONENTS`
- Expanding O5 Tauri pack panels without a dedicated O-wave
- Merging SPA + desktop-client into a single monorepo lockfile root
- Flipping Poemma / Assistant `client: true` without an offline-safe `requires` story
- Adding apps with `offline_capable: none` to `spa_offline_only` without a Cause offline UX story

## 7. Phased backlog

| Wave | Outcome | Status |
|------|---------|--------|
| **K0–K12** | Parity → package → workspace → spa_offline_only mounts | **Done** |
| **K13** | Start Menu / deny toast: pack vs SPA-only breakdown | **Done** |
| **K14** | `label_ru` + user notice; **EmperyNexusChronicleApp** → `spa_offline_only` | **Done** |
| **K15** | **PoemmaApp** + shell chrome (settings / widgets / favorites) → `spa_offline_only` | **Done** |
| **K16** | **DesktopAppMaintenance** → `spa_offline_only` (schema v6); honest notice label «Обслуживание» | **Done** |
| **K17** | **AssistantApp** (Assistant) FAQ catalog cache + `spa_offline_only` (schema v7); label «Ассистент» | **Done** (spike) |
| **K18+** | More SPA-offline mounts (only with offline UX) / true O5 pack growth / optional workspace root | Open |

## 8. Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| **Offline-mode** | desktopNative+offline: catalog/open = subset ∪ shell exempts; notice shows live SoT labels. Poemma uses localStorage + explicit sync degrade. Maintenance screen is fully local. Assistant: cached FAQ browse + local FAQ pairs; LLM/SSE denied; cold empty explained. |
| **Dual-flag** | Unchanged from K12 (`spa_offline_only` without `spa_deep_link`). Install profile still gates Poemma / Assistant (`client: false`). |
| **Permission** | Unchanged. |
| **Regression** | catalog-parity; package/FE vitest (breakdown + notice + FAQ cache); cargo `kernel_offline` when touching Rust. |

## 9. Operator notes

- Edit **shared SoT JSON only** → policy-sync (notice counts follow SoT).
- After clone: `pnpm install` in FE and desktop-client.
- Do **not** claim `desktop-client-007` Done after K17 — product bar still needs further mounts / O5 growth.
- Next intentional rebake may ship Kernel offline K17 SoT with SPA (not this wave).
