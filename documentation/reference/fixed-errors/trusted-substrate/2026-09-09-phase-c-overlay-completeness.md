# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

# Phase C: kiosk wants leak / dual overlay / repair client cp / installer on metal

| Field | Value |
|-------|--------|
| **status** | fixed |
| **date** | 2026-09-09 |
| **product_id** | trusted-substrate |
| **also_affects** | — |
| **severity** | Buildroot overlay / install SoT |

## Symptom

Audit Phase C: kiosk could appear in `multi-user.wants` after BR finalize; payload-templates drifted from overlay; repair tried host-cp Desktop Client; metal got live GUI installer from extract.

## Root cause

- Kiosk unit declared `WantedBy=multi-user.target` → enable after post-build.
- Dual editable trees without sync SoT.
- Repair treated client as SoT path extract.
- Install archive includes live installer tools needed only on USB root.

## Fix

- Remove kiosk `[Install]`; post-build asserts no WantedBy + seatd wants.
- `sync-payload-templates-from-overlay.sh` (labels excluded).
- Repair: OS helpers only; client via prepare-payload/RPM.
- Apply: strip installer binary/session/share (+ kiosk wants) after extract.

## Verification

```bash
bash pack-organization/trusted-substrate/scripts/selftest-installer.sh
bash pack-organization/trusted-substrate/scripts/sync-payload-templates-from-overlay.sh --check
```

Residual: next BR rebake for C1 archive listing proof on new `rootfs.tar.gz`.
