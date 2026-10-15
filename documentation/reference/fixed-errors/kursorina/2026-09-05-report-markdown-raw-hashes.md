# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Kursorina report showed raw ### instead of headings.
# ---

# Report Markdown shows raw ### markers

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — |

## Symptom

Completed analytical report showed literal `###` / `##` in the body; headings and Mermaid looked like plain/raw Markdown.

## Failure layers

1. **FE render (cause):** `KursorinaReportView` used `ProductAssistantMarkdown`, which styles via Tailwind `prose-*` — **`@tailwindcss/typography` is not in the FE toolchain**, so heading hierarchy CSS never applied (preflight resets h1–h6 to body).
2. **FE normalize:** Jammed ATX (`текст ### Заголовок` without newline) is not a CommonMark heading — `###` stays visible text. Companion/Desktop AI already normalize this; Kursorina report did not.
3. **Mermaid:** Roadmap/diagram fences rendered as code text, not diagrams.

## Root cause

Report path relied on non-functional `prose-*` utilities and skipped jammed-ATX normalize before `react-markdown`.

## What we did

- `KursorinaReportMarkdown`: `normalizeCompanionChatMarkdown` + explicit h1–h3/list/table classes + `MermaidFenceBlock`.
- Wired from `KursorinaReportView`; Vitest locks.

## Recommendations

- Long-read Desktop Markdown: prefer explicit element classes over `prose-*` until typography plugin is adopted project-wide.
- Always run jammed-ATX + GFM table normalize before remark-gfm for model answers.

## Verification

```bash
cd shared/web/frontend && pnpm exec vitest run src/pages/Desktop/apps/kursorina/__tests__/KursorinaReportMarkdown.test.tsx
```

Manual: open completed mission → Отчет — headings without `###`; mermaid fence renders diagram.

## Residual risk

Older answers still in DB may need refresh only in UI (normalize is client-side).
