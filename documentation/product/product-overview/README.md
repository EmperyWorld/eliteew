# EliteEW — product overview pack

Публичный обзор продукта · gift-to-world / MIT · **не** схема эксплуатации.

| Language | Entry |
|----------|-------|
| **Русский** | [`ru/00-README.md`](ru/00-README.md) |
| **English** | [`en/00-README.md`](en/00-README.md) (meaning-first) |

| Artifact | Path |
|----------|------|
| Shared diagrams | [`assets/diagrams/`](assets/diagrams/) |
| HTML / MD export | [`export/html/index.html`](export/html/index.html) (lang picker) |
| Share zip | `export/share/eliteew-product-overview-share-*/` · open **`OPEN.html`** |
| Optional PDF | `export/pdf/eliteew-overview-{ru,en}-*.pdf` |

Secondary area catalog (not this pack): [`../eliteew-overview/`](../eliteew-overview/).

Build:

```bash
.venv/bin/python documentation/product/product-overview/export/build_export.py
```

Optional PDF: `ELITEEW_OVERVIEW_WITH_PDF=1` (alias: `ELITEEW_BUYER_WITH_PDF=1`).
