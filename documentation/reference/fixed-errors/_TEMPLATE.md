# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Template for one fixed-errors registry entry (copy into <product_id>/).
# ---

# <short title>

| Field | Value |
|-------|--------|
| **product_id** | `<from products.json>` |
| **status** | `open` \| `contained` \| `fixed` |
| **date** | `YYYY-MM-DD` |
| **also_affects** | — \| other product_ids |
| **canon** | `documentation/product/...` |
| **commit** | `sha` or — |

## Symptom

What the user/operator saw.

## Failure layers

List layers (decide / tool / API / FE / deploy / …) — not only the last symptom.

## Root cause

One sentence at the failure layer.

## What we did

- Paths / behavior changed (or planned if `open`).

## Recommendations

- Do / don't for future work on this product.
- Regression locks (tests, guards).

## Verification

```text
command → result
```

## Residual risk

Honest leftover risk, or «none noted».
