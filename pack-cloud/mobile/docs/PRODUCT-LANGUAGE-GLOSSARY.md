# Mobile Android · Product language glossary

**Super Roadmap i18n-004** — user-facing terms (RU primary, EN mirror in `values-en`).

| Glossary id | RU (product) | EN | Do not show in UI |
|-------------|--------------|-----|-------------------|
| `ai_creation_hub` | AI · центр создания | AI · creation hub | UGS |
| `ew_desk` | EWDesk | EWDesk | — |
| `gaf_chat` | Чат GAF | GAF chat | — |
| `desktop_hub` | Рабочий стол | Desktop hub | — |
| `generation_studio` | Студия генерации | Generation studio | UGS pipeline names |

## Rules (i18n-005)

- Internal API routes may keep `ugs/*`; labels use glossary strings.
- Error copy: prefer «раздел AI» / «AI section», not raw «UGS».
- Pseudo-locale QA: `en-XA` via `MobileI18nSupport.PSEUDO_LOCALE_TAG` and shell pref `i18n_pseudo_locale_debug`.
