# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Mermaid sequenceDiagram SVG replaced by SequenceFlow.
# ---

# Mermaid sequenceDiagram looks like junk lifelines (report + chat)

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | `desktop_ai_chat` |
| **canon** | `documentation/product/desktop/KURSORINA.md` |

## Symptom

Sequence diagrams in chat/report still used Mermaid SVG after gantt/flowchart editorial routes.

## Root cause

Product surfaces used Mermaid sequenceDiagram SVG as primary interaction UI.

## What we did

- `features/diagrams/sequence-flow`: parse + SequenceFlow
- `MermaidFenceBlock` routes after gantt/flowchart; unparseable → Mermaid

## Verification

```bash
cd shared/web/frontend && pnpm exec vitest run \
  src/features/diagrams/sequence-flow/__tests__/parseMermaidSequence.test.ts \
  src/pages/Desktop/apps/kursorina/__tests__/KursorinaReportMarkdown.test.tsx \
  src/features/desktop-ai-chat/__tests__/DesktopAiChatMarkdown.mermaidRemount.test.tsx
```

## Residual risk

Nested alt/loop visual grouping deferred; messages flattened.
