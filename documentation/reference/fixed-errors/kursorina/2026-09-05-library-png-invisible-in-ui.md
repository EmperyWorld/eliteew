# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Kursorina PNG charts existed in Content Manager but UI showed text only.
# ---

# Library PNG charts invisible in Findings / Report

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — |

## Symptom

Mission produced real PNG charts (`save_png` → Content Manager) and Mermaid evidence, but the Desktop UI showed only text cards / raw markdown — no pictures.

## Failure layers

1. **FE Findings (cause):** `KursorinaFindingsView` rendered library rows as title + snippet only — never mapped `ref` (content UUID) to authenticated download or `<img>`.
2. **FE Report:** Report surface did not gallery library image results; markdown `img` stubbed to `[alt]`; Mermaid depended on undeployed `KursorinaReportMarkdown` (separate raw-`###` wave).
3. **API:** Evidence already carried `kind=library`, `ref=content_id` — sufficient for FE; no schema gap for PNG preview.

## Root cause

Product UI never bound library image evidence to the existing Bearer content-download path used by Desktop AI Chat.

## What we did

- `kursorinaMedia.ts`: detect PNG/library image results; build `/api/v1/content/{uuid}/download`.
- Findings: `AuthenticatedContentDownloadImage` preview for image rows.
- Report: «Графики и визуализации» gallery + content-download `img` in `KursorinaReportMarkdown`.
- Vitest locks on media helpers.

## Recommendations

- Do not load arbitrary http(s) image URLs in Kursorina findings/report.
- Keep PNG SoT as Content Manager + `ref` UUID; Mermaid SoT remains fences in `answer`.
- When changing `results_from_evidence`, preserve UUID `ref` for binary library saves.

## Verification

```bash
cd shared/web/frontend && pnpm exec vitest run \
  src/pages/Desktop/apps/kursorina/__tests__/kursorinaMedia.test.ts \
  src/pages/Desktop/apps/kursorina/__tests__/KursorinaReportMarkdown.test.tsx
```

## Residual risk

Findings do not render full Mermaid from truncated `snippet` (280 chars) — full diagrams stay in the report `answer` when synthesize includes fences.
