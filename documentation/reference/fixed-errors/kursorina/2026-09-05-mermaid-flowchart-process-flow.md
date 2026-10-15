# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Mermaid flowchart SVG is not product-quality; route to ProcessFlow.
# ---

# Mermaid flowchart looks like junk rectangles (report + chat)

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | `desktop_ai_chat` |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — |

## Symptom

After gantt → RoadmapTimeline, remaining Mermaid flowcharts in Kursorina report / Desktop AI Chat still looked like low-quality SVG boxes (same class of UX failure as Mermaid Gantt).

## Failure layers

1. **FE presentation (cause):** `MermaidFenceBlock` still called Mermaid v11 SVG for `flowchart`/`graph`.
2. **Theme polish (symptom):** paper-light / soft-dark themeVariables cannot fix Mermaid’s layout model for product long-read.

## Root cause

Product surfaces used Mermaid flowchart SVG as the primary process-scheme UI.

## What we did

- Shared `features/diagrams/process-flow`: `parseMermaidFlowchart` + `ProcessFlow`.
- `MermaidFenceBlock` routes parseable flowchart/graph → ProcessFlow (after gantt → RoadmapTimeline); unparseable → Mermaid fallback.

## Recommendations

- Do not “fix” flowchart UX with Mermaid themeVariables.
- Sequence/mindmap/etc. still Mermaid until a dedicated editorial renderer exists.

## Verification

```bash
cd shared/web/frontend && pnpm exec vitest run \
  src/features/diagrams/process-flow/__tests__/parseMermaidFlowchart.test.ts \
  src/pages/Desktop/apps/kursorina/__tests__/KursorinaReportMarkdown.test.tsx
```

## Residual risk

Exotic nested subgraphs / HTML labels may fall back to Mermaid SVG.
