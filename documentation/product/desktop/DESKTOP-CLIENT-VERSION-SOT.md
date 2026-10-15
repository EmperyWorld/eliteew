# Desktop Client — Version Single Source of Truth

**Status:** living Release Management SoT (2026-08-15).  
**Scope:** `pack-organization/connection-agent` tree + Connected / FoFline public OTA channels.  
**Does not cover:** `pack-cloud/mobile/` (Mobile Android), SPA `appBuildId` / bake tags (separate gates).

When this file and a peer diverge on **which semver is TREE** or **how channel lag is declared**, **this file wins**.

Peers: [DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md) · [DESKTOP-FOFLINE-EDITION.md](DESKTOP-FOFLINE-EDITION.md) · [DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md) · [DESKTOP-CLIENT-WINDOWS-BUILD-VM.md](DESKTOP-CLIENT-WINDOWS-BUILD-VM.md).

---

## 1. Definitions

| Term | Meaning |
|------|---------|
| **TREE_SEMVER** | Immutable write target for the desktop-client **source tree**. Stored once in [`pack-organization/connection-agent/package.json`](../../../pack-organization/connection-agent/package.json) `version`. |
| **CHANNEL_MATRIX** | Machine status of each public channel × platform relative to TREE_SEMVER. File: [`pack-organization/connection-agent/docs/release-state.v1.json`](../../../pack-organization/connection-agent/docs/release-state.v1.json). |
| **sequence** | OTA metadata monotonic counter in `latest.v2.json` (trust/replay). **Not** a second product version. |
| **Current** | TREE_SEMVER + CHANNEL_MATRIX + live curl of public `latest.json` / `latest.v2.json`. |
| **Historical** | Past ship notes. Must never be read as Current live. |

### TREE mirrors (read-only copies)

Bump **only** via [`scripts/eliteew/desktop-client-bump-version.sh`](../../../scripts/eliteew/desktop-client-bump-version.sh). Manual hand-edits of one mirror are a **parity break**.

| Path | Role |
|------|------|
| `package.json` `version` | **Write SoT** |
| `src-tauri/Cargo.toml` `version` | Cargo package |
| `src-tauri/tauri.conf.json` `version` | Tauri bundle / updater identity |
| `src/lib/launcher/appVersion.ts` `APP_VERSION` | Launcher chrome + presence |
| `docs/release-state.v1.json` `tree_semver` | Matrix header (must equal SoT) |

Lock: [`pack-organization/connection-agent/src/releaseVersion.contract.test.ts`](../../../pack-organization/connection-agent/src/releaseVersion.contract.test.ts).

---

## 2. CHANNEL_MATRIX statuses

Per channel (`connected` | `fofline`) × platform key (`linux-x86_64-rpm` | `windows-x86_64` | …):

| `status` | Meaning |
|----------|---------|
| `live` | Public metadata semver **equals** TREE_SEMVER for that platform. |
| `lag` | Public platform intentionally **behind** TREE_SEMVER (documented reason required). |
| `hold` | Freeze / do not treat as ship target (reason required). |
| `omitted` | Platform absent from signed metadata (e.g. RPM-only wave). |

**Linux-ahead-Windows** under packaging policy is **`lag`**, not silent drift. See [DESKTOP-CLIENT-WINDOWS-BUILD-VM.md](DESKTOP-CLIENT-WINDOWS-BUILD-VM.md).

---

## 3. Integrity rules (fail-closed)

1. All TREE mirrors == `package.json` version.
2. `release-state.v1.json` `tree_semver` == TREE_SEMVER.
3. For each checked channel, public `latest.json.version` == `latest.v2.json.version` (else **collapse**).
4. Public Linux RPM semver must equal the matrix row `semver` for `linux-x86_64-rpm`.
5. If matrix `status=live`, that row `semver` must equal TREE_SEMVER.
6. Docs must not invent a second “live” semver outside Current + matrix.

Preflight: [`scripts/eliteew/desktop-client-ota-release-preflight.sh`](../../../scripts/eliteew/desktop-client-ota-release-preflight.sh)

| Mode | What it proves |
|------|----------------|
| `--tree-only` | Parity + matrix header (no network, no signing secrets) |
| `--integrity-only` | Tree + live latest/latest.v2 + matrix (no signing secrets) |
| default | Integrity + release signing/capsule env for publish |

---

## 4. Operator bump

```bash
bash scripts/eliteew/desktop-client-bump-version.sh --to X.Y.Z
# then notes / matrix channel rows / publish as usual
bash scripts/eliteew/desktop-client-ota-release-preflight.sh --tree-only
pnpm --dir pack-organization/connection-agent exec vitest run src/releaseVersion.contract.test.ts
```

Bump refuses to run when TREE mirrors already disagree.

---

## 5. Current vs Historical (anti-chaos)

- **Current (2026-09-13):** TREE **0.5.37** in repo (`release-state.v1.json`); Linux RPM channels still **lag 0.5.36** until OTA publish/rsync (Connected/FoFline). Notes theme: EBrowser clearnet WebContext + stage not labwc-fullscreen + X11 stage bounds. Windows NSIS **lag 0.4.61** (`nsis_major_only_policy`). Always re-read CHANNEL_MATRIX + curl — do not copy a second live semver into other docs.
- **Historical** ship dates (example: 2026-08-12 **0.4.48**) stay labeled **Historical / superseded**. They are not a second SoT.

Security apply / Full Security patch waves remain **blocked** until this SoT’s locks are green and the operator unlocks the next wave.

---

## 6. Related

| Topic | Doc / script |
|-------|----------------|
| Product OTA UX | DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1 |
| FoFline channel | DESKTOP-FOFLINE-EDITION.md |
| Security boundaries | DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §6 Tree version |
| Publish | `desktop-client-publish-update.sh`, `fofline-publish-update.sh` |
| One-shot RPM release | `desktop-client-ota-release.sh --rpm-only` |
