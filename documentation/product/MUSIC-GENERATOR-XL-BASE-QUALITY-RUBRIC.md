# XL Base — operator quality rubric (Phase 5)

**Статус:** Канон (2026-05-23). Программа 24h hardening Phases 1–5 **Done** — living SoT: **this document** + [MUSIC-GENERATOR.md](MUSIC-GENERATOR.md) (dated 24h pipeline plan / lyrics-tags implementation one-shots → `trash/`).

Операторская шкала для **quality loop**: batch re-run лайкнутых рецептов на **v2_base** и сравнение Comfy debug до/после pipeline (Phases 1–4).

См. также: [MUSIC-GENERATOR.md](MUSIC-GENERATOR.md), [MUSIC-FORGE-APP.md](MUSIC-FORGE-APP.md).

## Когда применять

- После изменений lyrics gate, tags finalize или observability.
- При регрессии «Comfy OK, но трек пустой / skeleton».
- Перед релизом XL Base на прод.

## Шаг 1 — batch из liked recipes

1. Лайкнуть удачные треки в генераторе (`POST /music-generator/record-like-recipe`) — в metadata сохраняются lyrics/tags/BPM.
2. Создать подход:

```http
POST /api/v1/music-generator/batch-tests/approaches/from-liked-recipes
```

```json
{
  "content_ids": ["<uuid-1>", "<uuid-2>"],
  "ksampler_use_comfy_template": true,
  "duration_seconds": 30
}
```

3. Дождаться завершения в UI batch-tests или по `music_batch_approaches.status`.
4. Оценить образцы по рубрике ниже; для «меченых» использовать `rating=tagged` и highlights (`vocal`, `transition`, `rhythm`, …).

**Ожидание:** skeleton lyrics отклоняются при создании подхода (400), не доходят до Comfy.

## Шаг 2 — compare debug JSON

Сохранённые history лежат в `host/generated_files/comfyui_debug_prompts/` (env `COMFYUI_DEBUG_SAVE_PROMPT_DIR`).

```bash
cd shared/api
uv run python scripts/compare_xl_base_comfy_debug.py \
  path/to/before.json path/to/after.json --pretty
```

Смотреть поля:

| Поле | Смысл |
|------|--------|
| `sung_lines` | Должно быть ≥ 6 для ru; 0 = skeleton (баг pipeline) |
| `tags_len` / `tags_section_count` | После Phase 3 tags ≤ ~1600, секций ≤ 10 |
| `seed_applied` | Реальное значение node 109, не wire id |
| `bpm` | Совпадает с рецептом / tags BPM lock |
| `ksampler_*` | При `ksampler_use_comfy_template` — как в `Musicv2_base.json` |

## Шаг 3 — operator rubric (слух + метаданные)

Оценка **1–5** по каждому критерию; pass batch run: среднее ≥ **3.5**, ни один критерий < **2**.

### Vocal clarity (вокальная разборчивость)

- **5** — слова различимы в припеве и куплетах, артикуляция стабильна.
- **3** — припев читается, куплеты частично «каша».
- **1** — нет вокала или только hum/phoneme без слов при непустых lyrics.

### Section transitions (переходы секций)

- **5** — Intro → Verse → Chorus без обрывов и щелчков; структура слышна.
- **3** — переходы заметны, но не ломают трек.
- **1** — хаотичные скачки, секции не соответствуют lyrics.

### BPM lock (ритм / темп)

- **5** — ударные и groove на заявленном BPM (±3 BPM по ощущению).
- **3** — темп «плавает» в отдельных секциях.
- **1** — явный mismatch с tags/BPM (half-time/double без intent).

### Дополнительно (не блокирует pass)

- **Hook** — запоминается ли 4–8 тактов припева.
- **Mix balance** — вокал не тонет и не режет.
- **Lyrics alignment** — язык и mood близки к тексту (не semantic QA, операторское впечатление).

## SQL — алерты observability (Phase 4)

```sql
SELECT id, created_at,
       input_data->>'xl_base_lyrics_sung_lines' AS sung,
       input_data->>'xl_base_seed_applied' AS seed,
       input_data->>'xl_base_alert_sung_lines_zero' AS alert
FROM generation_requests
WHERE input_data->>'xl_base_alert_sung_lines_zero' = 'true'
ORDER BY created_at DESC LIMIT 20;
```

Batch rows также пишут `xl_base_*` в `ugs_input_data` при создании подхода.

## Definition of done (quality loop)

- [ ] ≥ 3 liked recipes прогнаны через `from-liked-recipes` без 400 на lyrics.
- [ ] Compare JSON: `sung_lines` after > before на историческом skeleton кейсе.
- [ ] Rubric заполнена для каждого образца; tagged highlights сохранены в batch feedback.
- [ ] Нет строк с `xl_base_alert_sung_lines_zero=true` после деплоя pipeline.
