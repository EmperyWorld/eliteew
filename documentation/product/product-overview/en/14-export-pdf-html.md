# P14 — Export HTML + Markdown (+ optional PDF)

**Status:** ✅ **HTML primary** · **MD pack** · handover · visual polish · PDF secondary  
**Bundle:** [`export/`](../export/)

## Outputs

| Priority | Artifact | Path |
|----------|----------|------|
| **1 · HTML** | Start: 4 path cards + Layering + TOC by part · nav: Start / Brief / Full text / Diagrams | `export/html/` (lang picker + `ru/` + `en/`) |
| **1 · HTML** | Full text by part + side-rail | `book.html` per language |
| **1 · HTML** | Brief / Q&A / diagrams | `onepagers.html` · `diagrams.html` |
| **1 · MD** | Same spine | `export/md/ru/` · `export/md/en/` |
| 2 · PDF | optional | `export/pdf/` — `ELITEEW_OVERVIEW_WITH_PDF=1` |
| Share | zip | `export/share/eliteew-product-overview-share-YYYYMMDD.zip` |

```bash
.venv/bin/python documentation/product/product-overview/export/build_export.py
ELITEEW_OVERVIEW_WITH_PDF=1 .venv/bin/python documentation/product/product-overview/export/build_export.py
```

## Look

Shared visual tokens · Layering metaphor · **not** marketing-landing copy.  
Manrope · sticky chrome · path cards · **handover-strip** · side-rail by part · fade-in ·
**read-progress** · **honesty badges** · **table-scroll** · **book search** · cover glow /
logo float · staggered path cards · lang-switch keeps page/hash · Mermaid.

## Host environment vs work layer

| Axis | Host | DIY | EliteEW |
|------|------|-----|---------|
| Primary delivery | DIY PDF | same | **HTML bundle** + **MD pack** |
| Print | optional | optional | PDF secondary |

**PDF tip:** for a short committee pack prefer `eliteew-overview-{lang}-onepagers.pdf`;
`*-book.pdf` is the full spine (~80 pages). Open `OPEN.html` in the share zip for HTML.

## Honestly

UI screenshots deferred · safe-to-share after HTML/MD review.

## Related

`export/build_export.py` · `export/html/index.html`
