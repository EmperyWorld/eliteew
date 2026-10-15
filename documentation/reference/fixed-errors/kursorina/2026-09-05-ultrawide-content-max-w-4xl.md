# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Kursorina main column capped at max-w-4xl on ultrawide.
# ---

# Ultrawide content stuck at max-w-4xl

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — |

## Symptom

На широкоугольных Desktop-окнах колонка отчёта / источников / цели / композера оставалась узкой полосой (~56rem) с большими пустыми полями по бокам.

## Failure layers

FE layout — hard-coded `max-w-4xl` на каждой вкладке без общего shell.

## Root cause

Контент-шелл был рассчитан на «читаемую колонку блога», а не на заполнение широкого Desktop workspace с разумным cap.

## What we did

- Добавлен `kursorinaLayout.ts`: `KURSORINA_CONTENT_MAX` = `max-w-[min(100%,88rem)]`, общий PAD/SHELL.
- Wired: Report / Findings / Goal / Composer.
- Findings на xl — 2 колонки; chrome (header tabs, sidebar) подтянуты к desktop tokens.

## Recommendations

- Не возвращать локальный `max-w-4xl` на вкладках Kursorina — только `kursorinaLayout` shells.
- Cap ~88rem оставлять: полный bleed на 4K ухудшает чтение prose.

## Verification

```text
pnpm exec biome check …kursorina… → clean
pnpm exec vitest run …KursorinaReportMarkdown… → 6 passed
rg max-w-4xl under kursorina apps → no content shells
```

## Residual risk

Mindmap/pie по-прежнему Mermaid SVG; facet-slot gate before finish — вне этого fix.
