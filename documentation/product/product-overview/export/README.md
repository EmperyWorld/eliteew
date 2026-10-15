# EliteEW product overview — export (W7+)

**Статус:** готовый бандл · **HTML primary** · **Markdown pack** · **RU + EN** · PDF через Chromium (opt-in)  
**Вход:** markdown в `documentation/product/product-overview/` (RU) и `…/en/` (EN, meaning-first)  
**Сборка:** `python3 documentation/product/product-overview/export/build_export.py`  
(нужен host `.venv` с `markdown`; PDF — `/usr/bin/google-chrome` или `chromium-browser`)

## Выходы

| Путь | Назначение |
|------|------------|
| [`html/index.html`](html/index.html) | Выбор языка RU / EN |
| [`html/ru/`](html/ru/) · [`html/en/`](html/en/) | Обложка · one-pagers · book · diagrams |
| [`html/assets/`](html/assets/) | Shared CSS/JS/brand/Mermaid |
| [`md/ru/`](md/ru/) · [`md/en/`](md/en/) | Markdown-пакеты по языку |
| [`pdf/`](pdf/) | Печать (opt-in; имена `eliteew-overview-{lang}-*.pdf`) |
| [`share/`](share/) | Dated zip: `html/` + `md/` (оба языка) |

PDF: только `ELITEEW_OVERVIEW_WITH_PDF=1`. Пропуск: `ELITEEW_BUYER_SKIP_PDF=1`.

## Честность

- Не схема эксплуатации; safe-to-share после review оператора.
- **Оформление HTML** — общие визуальные токены + метафора Layering (стол · режим чтения Aa · replay · unread · history · completion). Side-rail книги на ≥980px; на узких экранах — кнопка «Содержание».
- **Текст** — только product-overview spine · **не** маркетинговый лендинг.
- **EN** — смысл, не калька с RU.
- Схемы D01–D12; UI screenshots отложены.
- Перед внешней выдачей: scrub IP/client id.
