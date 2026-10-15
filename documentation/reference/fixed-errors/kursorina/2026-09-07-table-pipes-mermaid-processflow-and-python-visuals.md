# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Kursorina brief matrix table pipes, Mermaid ProcessFlow subgraphs, and Python visuals.
# ---

# Brief Matrix Table Pipes, Mermaid ProcessFlow Subgraphs, and Python Visuals

| Field | Value |
|---|---|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-07` |
| **also_affects** | `desktop_ai_chat` |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — |

## Symptom

1. **Brief Matrix rendered as raw text with pipes:** The 35-question brief questionnaire matrix in Section 3 of the analytical report was displayed as plain paragraphs of text separated by `|` instead of a structured Markdown table.
2. **Mermaid regression:** Architecture diagrams containing `subgraph` fell back to raw Mermaid v11 SVG rectangles instead of using EliteEW's custom `ProcessFlow` editorial component.
3. **Absence of Python visuals:** Analytical reports lacked Python-computed charts and metrics when user goals did not include narrow keywords like `python` or `matplotlib`.

## Failure layers

1. **FE Markdown Normalizer (cause 1):** In `companionChatMarkdownNormalize.ts`, `isCompanionGfmTableSeparatorLine` checked cell delimiters against `/^:?-{3,}:?$/` requiring at least 3 dashes. When LLM generated valid GFM 2-dash separators (`:--`), the normalizer misidentified the separator row, inserted an empty line right after the header, and broke remark-gfm parsing.
2. **FE Diagram Parser (cause 2):** In `parseMermaidFlowchart.ts`, an early return `if (/\bsubgraph\b/i.test(source)) return null;` forced all flowcharts with subgraphs into raw Mermaid SVG fallback instead of routing them to `ProcessFlow`.
3. **BE Orchestration & Default Model (cause 3):** `goal_wants_python` in `plan.py` only checked narrow keyword terms, ignoring technical conditions and suitability investigations. Furthermore, `tool_run_python` lacked a default model for technical readiness investigations when `code` was empty.
4. **Report Synthesizer (cause 4):** `synthesize.py` did not instruct the LLM or provide image link injection for generated PNG charts stored in Content Manager.

## Root cause

- Regex mismatch on GFM table separator boundaries (`-{3,}` vs valid `-{1,}`).
- Premature parser bailout on Mermaid `subgraph` lines that were already ignored during tokenization.
- Missing enterprise architecture scoring model in the sandboxed Python runner and lack of chart markdown image embedding.

## What we did

1. **Table Separator Repair:** Changed `isCompanionGfmTableSeparatorLine` regex to `/^:?-+:?$/`, supporting 1, 2, 3+ dashes with or without alignment colons (`:--`, `:-:`, `--:`, `---`).
2. **ProcessFlow Subgraph Support:** Removed the `subgraph` early return from `parseMermaidFlowchart.ts`, allowing diagrams with subgraphs to parse into topological steps rendered by `ProcessFlow`.
3. **Enterprise Technical Readiness Engine:**
   - Added `default_technical_readiness_code` to `python_tool.py` computing domain readiness percentages (Business, Stack, Data, OS Kernel, InfoSec, RBAC, Standards).
   - Added `bar` support to `_PltShim` and modern dark-theme Pillow chart rendering with percentages, gridlines, and labels.
   - Expanded `goal_wants_python` and `goal_wants_technical_readiness_default` in `plan.py` to cover technical conditions and readiness audits.
4. **Chart Link Integration:**
   - Added rule 7 to `_SYNTH_SYSTEM` mandating chart image embeds: `![График](/api/v1/content/<content_id>/download)`.
   - Updated `polish_product_answer` to automatically embed generated PNG chart deliverables from evidence into Section 2 or Section 8 if omitted by the LLM.

## Recommendations

- Keep GFM table separators aligned with full GFM specification (`-` or more dashes).
- Route all process schemes through `ProcessFlow` rather than falling back to unstyled Mermaid SVG.
- Ensure analytical workers proactively run computational models and generate visual deliverables for enterprise audiences.

## Verification

```bash
cd shared/web/frontend && pnpm exec vitest run \
  src/features/ewa/__tests__/companionChatMarkdownNormalize.test.ts \
  src/features/diagrams/process-flow/__tests__/parseMermaidFlowchart.test.ts \
  src/pages/Desktop/apps/kursorina/__tests__/KursorinaReportMarkdown.test.tsx

cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_kursorina_worker.py -q
```
