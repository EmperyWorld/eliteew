# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Living registry of product-classified defects: discovered → fixed → recorded
# (cause, recommendations, actions). Agents MUST read relevant entries before
# changing that product and MUST add/update an entry after a cause-layer fix.
# Related:
# - .cursor/rules/eliteew-fixed-errors.mdc
# - .cursor/skills/eliteew-fixed-errors/SKILL.md
# - .cursor/hooks/fixed-errors-gate.py
# ---

# Fixed Errors Registry

**Status:** living SoT (agent + operator)  
**Root:** `documentation/reference/fixed-errors/`  
**Machine map:** [`products.json`](products.json)  
**Template:** [`_TEMPLATE.md`](_TEMPLATE.md)

## Why

Повторные регрессии и «частичные фиксы» дороже записи. Реестр хранит **уже разобранные** ошибки по продуктам: симптом → слой причины → что сделали → рекомендации → proof.

## Rules for agents (HARD)

1. **Before code** on a product: `rg` / Read entries under `documentation/reference/fixed-errors/<product_id>/` (and `open/` if present). Hook: `[FIXED ERRORS GATE]`.
2. **After cause-layer fix** (medium+): same phase — create or update an entry via skill **`eliteew-fixed-errors`** / `/eliteew-fixed-errors`. Status `fixed` only with verification evidence.
3. **Classification:** one primary `product_id` from `products.json` (aliases OK). Cross-product → primary + `also_affects:`.
4. **Not** a substitute for living product canon (`documentation/product/...`) or Commit Package.

## Layout

```text
documentation/reference/fixed-errors/
  README.md                 ← this file
  products.json             ← product_id → path globs / aliases
  _TEMPLATE.md
  <product_id>/
    YYYY-MM-DD-<slug>.md    ← one defect / wave
```

## Status values

| Status | Meaning |
|--------|---------|
| `open` | Cause known or partially known; fix not Done |
| `contained` | Temporary containment; cause follow-up required |
| `fixed` | Cause-layer change + verification recorded |

## Index (manual)

| Product | Entries |
|---------|---------|
| `kursorina` | [2026-09-07-shallow-investigation-truncation-block.md](kursorina/2026-09-07-shallow-investigation-truncation-block.md) (`fixed`); [2026-09-07-companies-empty-probe-blocked.md](kursorina/2026-09-07-companies-empty-probe-blocked.md) (`fixed`); [2026-09-07-premature-complete-web-cap.md](kursorina/2026-09-07-premature-complete-web-cap.md) (`fixed`); [2026-09-07-search-companies-api-config.md](kursorina/2026-09-07-search-companies-api-config.md) (`fixed`); [2026-09-07-investigator-not-web-bot.md](kursorina/2026-09-07-investigator-not-web-bot.md) (`fixed`); [2026-09-07-honest-tools-benchmark-finance-library.md](kursorina/2026-09-07-honest-tools-benchmark-finance-library.md) (`fixed`); [2026-09-06-intent-web-grounding.md](kursorina/2026-09-06-intent-web-grounding.md) (`fixed`); [2026-09-06-premature-finish-facets-python.md](kursorina/2026-09-06-premature-finish-facets-python.md) (`fixed`); [2026-09-06-model-local-fetch-host-web-dedupe.md](kursorina/2026-09-06-model-local-fetch-host-web-dedupe.md) (`fixed`); [2026-09-05-ultrawide-content-max-w-4xl.md](kursorina/2026-09-05-ultrawide-content-max-w-4xl.md) (`fixed`); [2026-09-05-synthesize-fake-date-greeting-hygiene.md](kursorina/2026-09-05-synthesize-fake-date-greeting-hygiene.md) (`fixed`); [2026-09-05-fake-four-phase-progress.md](kursorina/2026-09-05-fake-four-phase-progress.md) (`fixed`); [2026-09-05-mermaid-sequence-flow.md](kursorina/2026-09-05-mermaid-sequence-flow.md) (`fixed`); [2026-09-05-mermaid-flowchart-process-flow.md](kursorina/2026-09-05-mermaid-flowchart-process-flow.md) (`fixed`); [2026-09-05-mermaid-report-cramped-chat-preview.md](kursorina/2026-09-05-mermaid-report-cramped-chat-preview.md) (`fixed`); [2026-09-05-library-png-invisible-in-ui.md](kursorina/2026-09-05-library-png-invisible-in-ui.md) (`fixed`); [2026-09-05-composer-documentchartbaricon-undefined.md](kursorina/2026-09-05-composer-documentchartbaricon-undefined.md) (`fixed`); [2026-09-05-mission-vanish-stale-list.md](kursorina/2026-09-05-mission-vanish-stale-list.md) (`fixed`); [2026-09-05-report-markdown-raw-hashes.md](kursorina/2026-09-05-report-markdown-raw-hashes.md) (`fixed`); [2026-09-05-decide-web-spam-ledger-answer.md](kursorina/2026-09-05-decide-web-spam-ledger-answer.md) (`fixed`); [2026-09-05-docs-spam-early-save-fetch-fail.md](kursorina/2026-09-05-docs-spam-early-save-fetch-fail.md) (`fixed`); [2026-09-05-thin-yandex-serp-marketplace-deepen.md](kursorina/2026-09-05-thin-yandex-serp-marketplace-deepen.md) (`fixed`); [2026-09-05-expanded-tools-ecosystem.md](kursorina/2026-09-05-expanded-tools-ecosystem.md) (`fixed`); [2026-09-05-no-planning-forced-library-read.md](kursorina/2026-09-05-no-planning-forced-library-read.md) (`fixed`); [2026-09-05-pdf-untranslated-unicode-ssl-external-search.md](kursorina/2026-09-05-pdf-untranslated-unicode-ssl-external-search.md) (`fixed`); [2026-09-05-runtime-sandbox-egress-uninitialized-tools.md](kursorina/2026-09-05-runtime-sandbox-egress-uninitialized-tools.md) (`fixed`); [2026-09-05-search-python-file-tool-use.md](kursorina/2026-09-05-search-python-file-tool-use.md) (`fixed`) |
| `eliteew-spa` | [2026-09-06-w2-amka-admin-pw-nullish.md](eliteew-spa/2026-09-06-w2-amka-admin-pw-nullish.md) (`fixed`); [2026-09-06-w3-desktop-ai-chat-ewa.md](eliteew-spa/2026-09-06-w3-desktop-ai-chat-ewa.md) (`fixed`); [2026-09-06-w4-typecheck-zero.md](eliteew-spa/2026-09-06-w4-typecheck-zero.md) (`fixed`) |
| `marketing-cabinet` | [2026-09-06-compose-unknown-deps-bags.md](marketing-cabinet/2026-09-06-compose-unknown-deps-bags.md) (`fixed`) |
| `stack0-deploy` | [2026-09-06-autostart-short-name-bake-tag-active-line.md](stack0-deploy/2026-09-06-autostart-short-name-bake-tag-active-line.md) (`fixed`) |
| `site-studio` | [2026-09-15-site-studio-flux2-klein-photo.md](site-studio/2026-09-15-site-studio-flux2-klein-photo.md) (`fixed`); [2026-09-15-z-image-prompt-hygiene.md](site-studio/2026-09-15-z-image-prompt-hygiene.md) (`fixed`); [2026-09-15-worker-podman-xdg-home-split.md](site-studio/2026-09-15-worker-podman-xdg-home-split.md) (`open`, thin-bake XDG dir) |
| `ewa` | [2026-09-06-api-health-ewa-pool-not-open.md](ewa/2026-09-06-api-health-ewa-pool-not-open.md) (`fixed`) |
| `desktop-shell` | [2026-09-06-comfort-soft-blur-sibling-disclosure.md](desktop-shell/2026-09-06-comfort-soft-blur-sibling-disclosure.md) (`fixed`); [2026-09-06-finetune-fonts-deeplink-reveal.md](desktop-shell/2026-09-06-finetune-fonts-deeplink-reveal.md) (`fixed`); [2026-09-06-personalize-language-morph-path.md](desktop-shell/2026-09-06-personalize-language-morph-path.md) (`fixed`); [2026-09-06-personalize-density-wallpaper-heap.md](desktop-shell/2026-09-06-personalize-density-wallpaper-heap.md) (`fixed`) |
| `mobile` | [2026-09-28-tracked-fcm-service-account-key.md](mobile/2026-09-28-tracked-fcm-service-account-key.md) (`fixed`) |

Add a row when creating a new product folder.

## Related

- Cause-first: `cause-first-intake.mdc`, skill `cause-first`
- Hook owner: `.cursor/hooks/fixed-errors-gate.py`
- Serial session: [../../platform/AGENT-SERIAL-SESSION.md](../../platform/AGENT-SERIAL-SESSION.md)
