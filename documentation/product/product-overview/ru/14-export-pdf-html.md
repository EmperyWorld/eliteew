# P14 — Export HTML + Markdown (+ optional PDF)

**Языки:** RU + EN (HTML `html/ru|en`, MD `md/ru|en`, picker `html/index.html`).  
**Статус:** ✅ **HTML primary** · **MD pack** · handover · visual polish · PDF второстепенный  
**Бандл:** каталог [`export/`](../export/)

## Выходы

| Приоритет | Артефакт | Путь |
|-----------|----------|------|
| **1 · HTML** | Вход: 4 path cards + Layering + TOC по частям · nav: Вход / Сжато / Полный текст / Схемы | [`html/index.html`](../export/html/index.html) → `ru/` · `en/` |
| **1 · HTML** | Полный текст по частям + side-rail | [`html/ru/book.html`](../export/html/ru/book.html) |
| **1 · HTML** | Сжато / DD / схемы | `onepagers.html` · `diagrams.html` |
| **1 · MD** | Тот же spine | [`md/README.md`](../export/md/README.md) → `ru/` · `en/` |
| 2 · PDF | опционально | `export/pdf/` — `ELITEEW_OVERVIEW_WITH_PDF=1` |
| Share | zip | `export/share/eliteew-product-overview-share-YYYYMMDD.zip` |

```bash
.venv/bin/python documentation/product/product-overview/export/build_export.py
ELITEEW_OVERVIEW_WITH_PDF=1 .venv/bin/python documentation/product/product-overview/export/build_export.py
```

## Оформление

Общие визуальные токены · метафора Layering · **не** маркетинговый лендинг.  
Manrope · sticky chrome · path cards · **handover-strip** · side-rail по частям · fade-in · **read-progress** · **honesty badges** · **table-scroll** · **поиск по book** · cover glow / logo float · staggered path cards · lang-switch с сохранением страницы/якоря · Mermaid.

## Хост-среда и рабочий слой

| Ось | Хост | DIY | EliteEW |
|-----|------|-----|---------|
| Основная выдача | PDF DIY | то же | **HTML-бандл** + **MD-пакет** |
| Печать | опционально | опционально | PDF вторичен |

**PDF:** для короткого комитетного пакета — `eliteew-overview-{lang}-onepagers.pdf`;
`*-book.pdf` — полный spine (~80 стр.). В share-zip открывайте `OPEN.html`.

## Честно

UI screenshots отложены · safe-to-share после review HTML/MD.

## Related

`export/build_export.py` · `export/html/index.html`
