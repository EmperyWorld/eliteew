# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Mermaid in Kursorina report looked like a cramped chat preview.
# ---

# Mermaid in report looks cramped / chat-bubble ugly

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | `desktop_ai_chat` (shared Mermaid theme v4) |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — |

## Symptom

Mermaid diagrams in the analytical report looked poor: tiny labels, ~260px scroll cage, purple “AI” palette — not a readable long-form figure.

## Failure layers

1. **FE presentation (cause):** Report reused chat `MermaidFenceBlock` defaults (`max-h-65` + `mermaidSvgEmbeddedClamp` with 10–12px labels).
2. **Theme:** Mermaid `themeVariables` were violet-heavy; Gantt lacked dedicated sizing/colors.
3. **Cache:** SVG cache keyed only by source — theme bumps would not invalidate without version.

## Root cause

Long-read report path rendered diagrams with chat-bubble preview constraints.

## What we did

- `MermaidFenceBlock` `presentation="document"` for Kursorina report (taller figure, expanded SVG sizing).
- Mermaid config v4: neutral desktop colors, gantt bar/padding, font 14px; cache key includes config version.

## Recommendations

- Keep chat presentation default for AI Chat bubbles.
- Use `document` for product long-read surfaces (reports, dossiers).

## Verification

```bash
cd shared/web/frontend && pnpm exec vitest run \
  src/pages/Desktop/apps/kursorina/__tests__/KursorinaReportMarkdown.test.tsx \
  src/features/desktop-ai-chat/__tests__/DesktopAiChatMarkdown.mermaidRemount.test.tsx
```

## Residual risk

Upstream Mermaid gantt layout for very long Russian task titles may still need horizontal scroll — expand modal remains available.

## Follow-up (2026-09-05)

`presentation=document` initially set `expanded` (native SVG width) + `max-h` 70vh — operator rejected as oversized. Corrected to `size=document` (column fit + readable labels) + `max-h ≈ 22rem`, gantt `useMaxWidth: true`, theme config **v5**.

## Follow-up 2 (2026-09-05)

Near-black Gantt section slabs looked like opaque black chunks. Report now uses **paper-light** Mermaid palette (soft gray sections, blue task bars) on a light figure card; chat keeps **soft-dark** (elevated slate, not `#0f/#16` black). Config **v6** + cache key includes palette.

## Follow-up 3 (2026-09-05)

Operator rejected Mermaid Gantt aesthetics entirely (rectangular bars). Cause fix: report path parses gantt fences → **`KursorinaRoadmapTimeline`** (editorial vertical timeline). Non-gantt Mermaid unchanged.

## Follow-up 4 (2026-09-05)

Shared module `features/diagrams/roadmap`: **`MermaidFenceBlock`** routes all gantt (chat + document) → **`RoadmapTimeline`**. Single product path; Kursorina report uses the same fence.
