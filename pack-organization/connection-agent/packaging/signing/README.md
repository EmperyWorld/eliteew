# EliteEW desktop-client · signing (updater + entitlement + metadata)

**Status:** O0+O1 entitlement living; **O2 private updater living**; **Wave 8 signed `latest.v2` living**; **O4 denylist** uses a **dedicated** Ed25519 seed (not entitlement). Fail-closed without baked keys. **No private keys in git**. Public verify keys live in `tauri.conf.json`. **Never** override verify pubkeys via process env (local MitM of Root of Trust).

## Key roles (do not mix)

| Purpose | Private (ops only / SOPS) | Public (client bake) |
|---------|---------------------------|----------------------|
| **Entitlement blob** | `DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY` (32-byte hex seed) | `plugins.eliteew-desktop-client.entitlement_pubkey_hex` |
| **Denylist (O4)** | `DESKTOP_CLIENT_DENYLIST_SIGNING_KEY` (32-byte hex seed) | `plugins.eliteew-desktop-client.denylist_pubkey_hex` |
| **OTA metadata `latest.v2`** | `DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY` (Connected) / `FOFLINE_UPDATE_METADATA_SIGNING_KEY` | `metadata_pubkey_hex` + `metadata_key_id` (per product) |
| **Updater / installer artifacts** | `TAURI_SIGNING_PRIVATE_KEY` | `plugins.updater.pubkey` + `artifact_key_id` |

Generate entitlement keys:

```bash
bash scripts/eliteew/desktop-client-issue-entitlement.sh --generate-keypair
# store seed in vault/SOPS; bake pubkey into tauri.conf.json release
```

Generate metadata / denylist Ed25519 seeds (ops host; never commit):

```bash
python3 - <<'PY'
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
sk = Ed25519PrivateKey.generate()
print("seed", sk.private_bytes_raw().hex())
print("pub ", sk.public_key().public_bytes_raw().hex())
PY
```

Issue USB entitlement file:

```bash
export DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY=…   # seed hex
bash scripts/eliteew/desktop-client-issue-entitlement.sh \
  --license-id <uuid> --out /tmp/eliteew-entitlement.json
```

Never commit `*.key`, `*.pem`, or seed files (see monorepo `.gitignore`).

Publish soft-revoke denylist (dedicated denylist seed; next to OTA channel):

```bash
export DESKTOP_CLIENT_DENYLIST_SIGNING_KEY=…
bash scripts/eliteew/desktop-client-publish-denylist.sh \
  --license-id <uuid> --out docker/data/desktop-client-updates
# clear: --license-id __empty__
# sync denylist.json → prod-core /srv/eliteew/desktop-client-updates
```

## Goals

| Artifact | Linux (command-center / Fedora) | Windows build host |
|----------|----------------------------------|--------------------|
| First install | `rpm` via `pnpm run build:linux` (`mainBinaryName` eliteew-desktop-client / eliteew-fofline) | `nsis` via `pnpm run build:windows` |
| In-app OTA | Signed **RPM** + `.sig` + **`latest.v2.json`** (+ legacy `latest.json` for pre-W8) | Same channel — **`windows-x86_64`**; Authenticode for first-install handout |
| Code signing | **Required** `rpmsign` / repo GPG for OTA install (`rpm -K` must show PGP) | Authenticode cert (customer/ops owned) for first install |

Linux reality: Wave 8+ clients resolve **`latest.v2.json`** only. Legacy AppImage clients on unsigned `latest.json` stay on last published AppImage until bridged.

### Bridge publish flags (Wave 9)

```bash
# Default / explicit dual-write (latest.json + latest.v2)
bash scripts/eliteew/desktop-client-publish-update.sh --bridge-release --version … --rpm … --sig …

# Freeze legacy bridge: write only latest.v2; fails if --version is newer than frozen latest.json
bash scripts/eliteew/desktop-client-publish-update.sh --freeze-legacy --version … --rpm … --sig …
```

`--bridge-release` and `--freeze-legacy` are mutually exclusive. Default without either flag remains dual-write for compatibility.

## Updater artifact keypair (Tauri minisign)

On an ops machine (not committed):

```bash
cd pack-organization/connection-agent
pnpm exec tauri signer generate -w packaging/signing/desktop-client.key
# writes private key file + prints pubkey — store private in vault / SOPS on command-center only
```

- **Public key** → bake into `src-tauri/tauri.conf.json` `plugins.updater.pubkey`. Never ship `REPLACE_WITH` in release conf. Runtime **does not** fall back to a compile-time pubkey when conf is empty.
- **Private key** → `TAURI_SIGNING_PRIVATE_KEY` (+ optional password env) only on build host when producing updater artifacts.
- FoFline should eventually use a **separate** artifact private key; today product bind (`product_id` / `package_id` / metadata key) prevents cross-channel install even while the minisign string is still shared.

Enable updater artifacts only when pubkey is real:

```bash
bash scripts/bundle.sh --with-signing-config
# or: pnpm run build:linux:updater
```

## Publish private channel (O2 + Wave 8)

```bash
export TAURI_SIGNING_PRIVATE_KEY=…   # build host only
export DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY=…  # Connected metadata seed
bash scripts/bundle.sh --with-signing-config

bash scripts/eliteew/desktop-client-publish-update.sh \
  --version 0.4.50 \
  --rpm pack-organization/connection-agent/src-tauri/target/release/bundle/rpm/*.rpm \
  --sig pack-organization/connection-agent/src-tauri/target/release/bundle/rpm/*.rpm.sig \
  --out docker/data/desktop-client-updates

# Writes latest.json (legacy) + signed latest.v2.json
# Sync OUT → prod-core /srv/eliteew/desktop-client-updates
```

FoFline:

```bash
export FOFLINE_UPDATE_METADATA_SIGNING_KEY=…
bash scripts/eliteew/fofline-publish-update.sh --version … --rpm … --sig …
```

Client runtime:

- Channel URL and all verify pubkeys are **bake-time only** (no `DESKTOP_CLIENT_UPDATE_URL` / pubkey env trust overrides).
- Honest codes: `not_configured` / `signing_required` / `offline_skip` / `up_to_date` / `update_available` / `ota_metadata_expired` / `ota_sequence_rollback` / `ota_product_mismatch`.

## RPM GPG (required for OTA install)

```bash
# after tauri build:
rpmsign --addsign dist/…/*.rpm   # ops GPG key on command-center
rpm -Kv path/to/*.rpm            # must show signature OK, not digests-only
```

Recovery/install refuses packages with `nosignature` / missing PGP indication.

## Windows Authenticode vs updater signature

Two different signatures:

1. **Tauri updater `.sig` (minisign)** — required for in-app OTA (`latest.v2` platform entry).
2. **Authenticode** — OS trust for first-install handout; keep mandatory in release checklist.

## Selftest

```bash
bash scripts/eliteew/desktop-client-publish-update-selftest.sh
```

Covers platform merge, signed `latest.v2`, tampered metadata rejection, missing seed / missing `.sig` fail-closed.
