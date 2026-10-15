# EWDesk — стиль постов и обложек (v2)

**Status:** Канон с **2026-06-14**. Заменяет шаблон «Что вы почувствуете / Что это даёт» и промпты с UI/текстом на картинке.

**Связь:** лента и API — [EWDESK-NEWS.md](EWDESK-NEWS.md); исторические пакетные черновики soft-retired в `trash/` (бывшие `host/comfyui/EWDESK-POSTS-BATCH-DRAFT*.md`); Comfy — `host/comfyui/ewdesk_comfy_heroes.py`.

---

## 1. Текст поста

### Тон

- Русский, разговорный, как коллега рассказывает об изменении.
- Без emoji в заголовке, без «🚀», без маркетингового крика.
- Без внутреннего жаргона (API, stack, UGS, SSE, CRM-lite, worker, runtime и т.п.).
- Без обязательных блоков «## Что вы почувствуете» и «## Что это даёт в реальной работе».

### Структура (рекомендуемая)

1. **Заголовок** — короткий, конкретный (до ~70 символов).
2. **Лид** — 1–3 предложения: что изменилось и зачем это пользователю.
3. **Детали** — ещё 0–2 абзаца, только если нужны примеры («нажали — открылось»).
4. **Цитата** — одна строка `> «…»`, по желанию, без пафоса.
5. **Быстрый переход** — опционально, 1–2 deeplink-ссылки, если пост про конкретное приложение.

Формат deeplink: `[Название](/__eliteew-desktop-open-app__/ComponentName)` — см. [EWDESK-NEWS.md](EWDESK-NEWS.md).

### Черновик в репозитории

```markdown
## `YYYY-MM-DD-topic-slug`

**Заголовок:** …

**Тело:**

…
```

Разделитель между постами: `---` на отдельной строке.

### Публикация

- Пакетный скрипт: `shared/api/scripts/publish_ewdesk_news_batch_direct.py` с **`--no-rewrite`** (текст уже в v2, LLM polish не нужен).
- Обновление уже опубликованных: `shared/api/scripts/apply_ewdesk_batch_v2.py` (текст + обложка, **`published_at` не меняется**).
- Кнопка «Перегенерить с ИИ» в админке по-прежнему использует старый polish-шаблон; для новых постов предпочтительно править черновик v2 вручную или через пакет.

---

## 2. Обложка (ComfyUI)

### Workflow

- `host/comfyui/01_top.json`
- Скрипт: `host/comfyui/ewdesk_comfy_heroes.py`
- Prod-core: ComfyUI на `.111` (LAN/port — см. [EWDESK-NEWS.md](EWDESK-NEWS.md)); локально часто `http://127.0.0.1:31003`.

### Промпт (`clip_prompt` в манифесте)

- **Только** короткая визуальная тема на русском (3–8 слов): абстракт, свет, форма, природа+sci-fi.
- **Запрещено** в теме: интерфейсы, экраны, телефоны, документы, кнопки, лента, текст, надписи, логотипы, «AI», «чат», «презентация со слайдами».
- Скрипт оборачивает тему: `Future IT, {тема}, cyan и violet, 3D иллюстрация, мягкий свет, минимализм` — **без** слова «текст» в финальном промпте.

### Примеры удачных `clip_prompt`

| Тема поста | clip_prompt |
|------------|-------------|
| Голос спутника | `мягкая звуковая спираль в пустоте, violet` |
| Студия сайтов | `лестница из света в облаках` |
| Экскурсия | `сфера из света в тумане, фиолетовый рассвет` |

### Артефакты

- PNG: `host/comfyui/ewdesk_comfy_out/<slug>.png`
- Манифест: `ewdesk_batch_manifest*.json` — поле `id` совпадает со slug в черновике.

---

## 3. Пакеты в репозитории

Манифесты JSON остаются в `host/comfyui/`. Текст пакетных черновиков (2026-04…06) soft-retired в `trash/` — не living product canon. Новый пакет: staging-черновик вне дерева продукта + явный `--draft-glob`.

| Период | Черновик | Манифест |
|--------|----------|----------|
| Апрель 2026 (legacy) | soft-retired `trash/…/EWDESK-POSTS-BATCH-DRAFT-2026-04-v2.md` | `ewdesk_batch_manifest_202604_v2.json` |
| 1–11 мая | soft-retired `…/EWDESK-POSTS-BATCH-DRAFT.md` | `ewdesk_batch_manifest.json` |
| 12–27 мая | soft-retired `…/EWDESK-POSTS-BATCH-DRAFT-2026-05-12-27.md` | `ewdesk_batch_manifest_20260512_27.json` |
| 28 мая – 13 июня | soft-retired `…/EWDESK-POSTS-BATCH-DRAFT-2026-05-28-06-13.md` | `ewdesk_batch_manifest_20260528_0613.json` |
| **14 июня – 17 августа 2026** | `documentation/product/desktop/EWDESK-POSTS-BATCH-DRAFT-2026-06-14-08-17.md`; duplicate host copy retired on 2026-10-11. Publishing takes an explicit `--draft` or `--draft-glob` path. | `host/comfyui/ewdesk_batch_manifest_20260614_0817.json` |
| **Все посты (apply)** | explicit `--draft-glob` (restore from trash or operator staging) | `ewdesk_batch_manifest_v2_full.json` |

---

## 4. Операторский runbook (.111)

```bash
# 1) Сгенерировать обложки (на хосте с ComfyUI)
cd host/comfyui
python3 ewdesk_comfy_heroes.py \
  --comfy http://127.0.0.1:31003 \
  --manifest ewdesk_batch_manifest_v2_full.json \
  --out-dir ewdesk_comfy_out

# 2) Применить текст + картинки к уже опубликованным (published_at сохраняется)
# --draft-glob обязателен: living drafts removed from comfyui/
podman exec stack0-eliteew-api-prod-baked python3 /app/api/scripts/apply_ewdesk_batch_v2.py \
  --draft-glob '/path/to/EWDESK-POSTS-BATCH-DRAFT*.md' \
  --manifest /app/comfyui/ewdesk_batch_manifest_v2_full.json \
  --images-dir /app/comfyui/ewdesk_comfy_out
```

Новые даты (ещё нет в БД): `publish_ewdesk_news_batch_direct.py --no-rewrite` как в [EWDESK-NEWS.md](EWDESK-NEWS.md).

---

## 5. Источник смысла

Черновики опираются на продуктовый канон ([EWDESK-NEWS.md](EWDESK-NEWS.md)) и факты релиза; не выдумывать.
