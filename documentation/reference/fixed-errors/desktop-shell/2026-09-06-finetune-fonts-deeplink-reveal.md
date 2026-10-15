# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Fine-tune dual font grids + deep-link into closed disclosures.
# ---

# Fine-tune dual fonts and closed deep-link targets

| Field | Value |
|-------|--------|
| **product_id** | `desktop-shell` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md` |
| **commit** | — |

## Symptom

Fine-tune showed two full font grids as peer everyday decisions; storage-map / hotspot deep-links scrolled to fields inside closed `<details>` without opening them; Widgets panel showed taxonomy essay.

## Failure layers

FE IA (Fine-tune budget) · navigate/reveal journey · Widgets primary copy.

## Root cause

SoT §4 Fonts chooser and deep-link reveal were not implemented; Widgets still rendered `cardWidgetPanelTaxonomyNote`.

## What we did

- Body\|Display Fonts chooser in Visual Studio Fine-tune.
- `revealDesktopSettingsNavigateTarget` before `scrollIntoView`.
- Removed Widgets taxonomy note + declutter lock.
- Runtime Look SoT navigate Vitest; nest containment + jargon locks.

## Recommendations

- Do not restore peer dual font grids on Fine-tune primary.
- Any new nested Settings field must remain reachable via ancestor-details open on navigate.

## Verification

```text
pnpm exec vitest run EverydayIa + NavigateReveal + LookSot.runtime + declutter → pass
```

## Residual risk

Honest cognitive ≥15 still needs browser Measure; Measure not claimed Done here.
