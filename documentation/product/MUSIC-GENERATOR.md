# Генератор песен (Creative Studio) — legacy API

> **Desktop UI superseded (2026-06-28):** пользовательское приложение на столе — **`MusicForgeApp`** / «Студия песен» ([`MUSIC-FORGE-APP.md`](MUSIC-FORGE-APP.md)). Frontend `MusicGenerator` (`pages/MusicGenerator/`) перенесён в `trash/`; этот документ описывает **legacy API** `/api/v1/music-generator/*` и operator-контуры (v3, batch tests, XL Base pipeline).

**Пользовательская инструкция (актуальный UX):** [`handbook-user-docs/06-generator-pesen.md`](handbook-user-docs/06-generator-pesen.md) — сценарий MusicForge «Студия песен».

**Пользовательский поток:** [`MUSIC-FORGE-APP.md`](MUSIC-FORGE-APP.md). Legacy API detail: this doc + [`MUSIC-GENERATOR-REFERENCE.md`](MUSIC-GENERATOR-REFERENCE.md). Historical MusicGeneratorPage step-flow soft-retired under `trash/` (id 20260812-155119, was …/MUSIC-GENERATOR-FLOW.md).

**Полная сводка (стили, промпты, поля запросов, UGS):** [`MUSIC-GENERATOR-REFERENCE.md`](MUSIC-GENERATOR-REFERENCE.md).

**Отдельное приложение (legacy API):** [`MUSIC-EVOLUTION-APP.md`](MUSIC-EVOLUTION-APP.md) — backend `/api/v1/music-evolution/*` (солисты, corpus, golden lanes). Desktop UI снят; пользовательский стол — MusicForge.

## API (`/api/v1/music-generator`)

| Эндпоинт | Назначение |
|----------|------------|
| `POST /lyrics` | Текст песни через UGS/Llama; тело: `theme` (**не длиннее 20 символов** — мастер «Основной»), `style` (пресет как на фронте), `language`. Опционально те же поля, что у музыки: `temperature`, `cfg_scale`, `top_p` — в Llama `options` и краткая директива в промпте (вариативность / следование / разнообразие). Промпт включает **жанровый блок** `LYRICS_STYLE_GUIDE_RU`. |
| `POST /improve-lyrics` | Улучшение текста; опционально `temperature`, `cfg_scale`, `top_p` — как для `/lyrics`. |
| `POST /generate-style` | Теги стиля на английском (инструментал и продакшн для UGS); опционально `temperature`, `cfg_scale`, `top_p`. См. ниже про lyrics vs tags. |
| `POST /suggest-production-params` | Подсказка параметров трека по тексту/стилю (BPM, вокал, длительность, тональность). |
| `POST /validate-lyrics` | Проверка перед генерацией |
| `POST /promo-script` | Промо-озвучка: LLM собирает короткий дикторский сценарий и tags по тезисам/сырому тексту; затем UI показывает предпросмотр и запускает `POST /generate` со `style=promo_voiceover`. |
| `POST /generate` | Генерация MP3 (ace_step / diffrhythm) |
| `POST /v3/lyrics`, `/v3/suggest-production-params`, `/v3/generate-style`, `/v3/generate` | Независимая **Версия 3**: отдельные prompts/presets/tags, отдельный UGS `music_generator_generate_ace_v3`, отдельный Comfy workflow `audio_ace_step_1_5_split_4b_v3.json`. |
| `POST /record-like-recipe` | Опциональная запись JSON-рецепта лайкнутого трека, если включён `MUSIC_GENERATOR_LIKED_RECIPES_DIR`. |
| `POST /record-dislike-feedback` | Дизлайк: причина (`vocal`, `mix`, …, `other` + текст) + снимок рецепта в таблицу `music_generator_dislike_feedback`. Вызывать до `DELETE` контента. |

### Batch tests (`/api/v1/music-generator/batch-tests`)

| Эндпоинт | Назначение |
|----------|------------|
| `GET /capabilities` | Лимиты, highlight-каталог feedback, env flags |
| `POST /approaches` | Создать подход (массовые короткие демо; workflow `v2` / `v2_base` / `v2_sft` / `v3`) |
| `POST /approaches/from-liked-recipes` | **Quality loop (XL Base):** batch только **`v2_base`** из лайкнутых треков (`content_ids`); XL lyrics/tags pipeline как на `/generate`; skeleton lyrics → 400 |
| `GET /approaches`, `GET /approaches/{id}` | Список и детали подхода |
| `POST /approaches/{id}/cancel`, `PATCH …/rename` | Отмена / переименование |
| `POST /generations/{id}/feedback` | Оценка образца (`positive` / `tagged` + highlights) |
| `GET /generations/{id}/xl-apply` | Снимок параметров для «применить в XL Studio» |

Для **`v2_base`** все строки batch проходят `_finalize_v2_base_batch_row` (parity с `POST /generate`). Операторский rubric и compare debug JSON: [MUSIC-GENERATOR-XL-BASE-QUALITY-RUBRIC.md](MUSIC-GENERATOR-XL-BASE-QUALITY-RUBRIC.md) (dated 24h pipeline plan → `trash/`).

### XL Base pipeline (`v2_base`)

Серверная подготовка lyrics/tags перед Comfy (шаблон `Musicv2_base.json`): strict gate на skeleton lyrics, tags cap/compress, observability `xl_base_*` в UGS и metadata трека. Реализация: `music_generator_xl_base_pipeline.py`; quality loop: `music_generator_xl_base_quality_loop.py`. Подробности — living code + [MUSIC-GENERATOR-XL-BASE-QUALITY-RUBRIC.md](MUSIC-GENERATOR-XL-BASE-QUALITY-RUBRIC.md) (dated lyrics-tags implementation one-shot → `trash/`).

- `/lyrics` для `v2_base`: post-check + auto-retry 1× при skeleton; wizard блокирует generate при `xl_base_valid=false`.
- Seed в Comfy debug: wire `["109", 0]` ≠ applied value в `prompt.109.inputs.value`.
- Compare debug: `shared/api/scripts/compare_xl_base_comfy_debug.py`.

### `lyrics` vs `tags` (enriched-секции + отдельные tags)

- **`lyrics`** — слова вокала + секции в формате legacy или enriched:
  - legacy: `[Verse]`
  - enriched: `[Verse: instruments/effects/transitions, N BPM feel]`
  - после секции допускается короткая строка `(Voice: ...)`.
  Для автошагов (`/lyrics`, `/improve-lyrics`) используется enriched-формат по умолчанию.
- **Гендерная согласованность вокала:** для автошагов текст мягко выравнивается под выбранный `vocal` (`male`/`female`), чтобы не смешивать «я устала» при мужском голосе и наоборот. Для `duet` принудительная правка не применяется.
- **`tags`** — вся аранжировка на английском: BPM, инструменты, продакшн-секции (`[intro]`, `[build up]`, `[drop]`, …), эффекты, микс. Порядок секций в tags согласуется с текстом: в промпт `generate-style` попадают `lyrics_track_structure_canonical_for_style_prompt` (канонические `[verse]`/`[chorus]`/…) и `lyrics_section_outline_for_style_prompt` (как в тексте, с «occurrence 2» для повторов). Если в ответе LLM нет BPM — в начало добавляется типичный BPM для пресета (`music_generator_tag_finalize`). Для клубных EDM-пресетов (`ELECTRONIC_STYLES_REQUIRING_DROP`: techno, house, trance, edm, hardstyle, drum and bass, dubstep — **без** широкого `electronic` и **без** `luna`) при отсутствии маркеров дописываются `[build up]` / `[drop]`; для **drum and bass** и **dubstep** при необходимости ещё `[breakdown]`. Фронт перед `POST /generate` для этих пресетов требует в поле tags и `[build up]`, и `[drop]`.
- **Нормализация tags:** в `music_generator_tag_finalize` и перед сборкой графа UGS (`studio_comfy_workflows.build_ace_music_workflow`): удаляются обратные кавычки `` ` `` (частая ошибка LLM вместо запятых); первое вхождение `NNN BPM` в строке tags приводится к числу **`bpm` из тела запроса** (40–320), чтобы не расходиться с ползунком формы. В промпт `generate-style` добавлен сжатый блок `ACE_STEP_TAG_VOCAB_HINT_EN` (конкретные термины: вокал, ударные, гитары, синт, микс; без «литературных» хвостов), а также контекст `lyrics_section_music_hints_for_style_prompt`.
- **`validate_lyrics_for_music`**: поддерживает enriched-секции (`[Section: ...]`) и `(Voice: ...)` без блокировки; блокирующая проверка остаётся для явно технических фраз продакшна в обычных строках (`sound_effect_in_lyrics`), предупреждение `arrangement_hint_in_lyrics` — только для русских «миксовых» подсказок вне секционных ремарок.

**Модель Llama для текстовых шагов** (`/lyrics`, `/improve-lyrics`, `/generate-style`, UGS-типы `music_generator_*`): если в `.env.stack0.backend` задано **`LLAMA_MODEL_MUSIC_TEXT_GEN`**, API использует его (приоритет над `default_model` в конфиге провайдера Llama в БД). Прямой HTTP для названия трека (`_generate_song_title`) — тот же env. Переопределение на запрос: `input_data.model` в UGS (если появится в API).

### Текст и санитайз

Ответы LLM проходят `sanitize_lyrics_ai_output`: снятие внешних `` ``` ``, хвостов `Примечание:` / `Note:` / `Disclaimer` / `P.S.`.

`validate_lyrics_for_music` возвращает `normalized_lyrics` и `lyrics_were_normalized` (тот же санитайз, что и перед проверкой).

Prompt-контракт `/lyrics`, `/improve-lyrics` и V3 lyrics усилен как songcraft-слой: текст должен иметь конкретную ситуацию, развитие между куплетами, смысловой поворот/решение/иронию в bridge или финале, а не только абстрактное настроение. Для русского текста отдельно закреплены морфология, естественный порядок слов, рифма без ломания ударений и использование `ё` там, где это держит ударение (`всё`, `твоё`, `идёт`, `ещё`). Запрещены пустые клише вроде «в ритме ночи», «в ритме танца», «ритмы сердца», «огни города зовут», «между небом и землёй»; авто-санитайз дополнительно вычищает самые частые формы `ритм/звук/такт` и эти клише. По умолчанию lyrics больше не должны уходить только в любовно-страдальческую схему: разрешён широкий набор ракурсов — юмор, быт, дорога, работа, город, дружба, социальный нерв, победа, семейная память, риск и т.д.

`POST /generate` принимает `skip_lyrics_validation`; при ошибках валидации ответ **422** с `code: lyrics_validation_failed`, плюс `normalized_lyrics` при необходимости.

### BPM и вокал

Сервер и узел ACE/Comfy принимают `bpm` в диапазоне **10–300** (если поле не передано — обычно **120**). Фронт для основной формы держит пользовательский диапазон **40–320**, но перед отправкой и в схеме API значение приводится к серверному диапазону.

`POST /suggest-production-params` дополнительно проверяет явные формы 1-го лица в lyrics (русский текст) и при явном перевесе может скорректировать `vocal` (`male`/`female`) в ответе, чтобы голос не расходился с текстом.

### Промо-озвучка

Вкладка **«Промо-ролик»** — это короткий дикторский сценарий, не песня. Поток двухшаговый:

1. `POST /promo-script` принимает `mode=brief|raw`, `theses` или `raw_text`, `promo_preset`, `vocal`, `language`, `target_duration_sec` (30–300) и promo director факторы: `promo_tempo_intensity`, `promo_rhythm_intensity`, `promo_genre_bias`, `promo_voice_strength`, `promo_bed_level`, `promo_stinger_intensity`, `promo_drama_contrast`, `promo_clarity` (1–10).
2. Backend возвращает `lyrics`, `tags`, `recommended_duration_sec`, `recommended_bpm`, `estimated_spoken_words` и `director`. Рекомендованная длительность считается по фактическому дикторскому тексту, с учётом пауз/контраста/силы голоса.
3. UI показывает сценарий и tags в предпросмотре: их можно поправить, переписать или перенести в «Профессиональный». После сценария UI выставляет рекомендованную длительность.
4. После подтверждения `POST /generate` запускается со `style=promo_voiceover`, `ugs_workflow=v2`, `promo_preset` и теми же director факторами; BPM берётся по длительности и director-профилю, если пользователь явно не задал своё значение.

Для promo backend использует отдельную нормализацию: вынимает `lyrics` из JSON-like ответов LLM, чистит хвост `tags`, переводит `[Line]`/`[Sting]` в ACE-friendly секции, держит `(Arrangement: ...)` и `(Voice: ...)` на английском. Promo director дополнительно усиливает tags: жанровый уклон пресета, ритм, плед, ducking под речь, силу стингов, контраст, CTA spotlight и разборчивость. Внутренний шаг `promo-script` не отправляет отдельный UGS-toast «текст песни»; финальный MP3 уведомляется как обычный результат генератора.

### Уведомления и deep link

- После успешного сохранения трека в unified content отправляется in-app уведомление `source: music_generator` с `metadata.open_app`: `MusicGenerator`, `unifiedContentId`, `musicGeneratorTab: generator`.
- Успешное завершение **только** пайплайна `music_generator_generate_*` в UGS **не** дублируется отдельным UGS-тостом (отдельное уведомление после сохранения файла).
- GAF: при новом сообщении — `source: gaf_chat`, `open_app`: `GAFChatApp`, `targetChatId` (если чат не в mute у получателя).

### Разметка текста

Секции — в **`[ ]`** отдельной строкой, лучше в enriched-формате: `[Intro: Atmospheric Breakbeat, 87 BPM feel]`, `[Drop: Drum & Bass, 174 BPM]`. Legacy `[Verse]` остаётся валидным. Для Comfy enriched-заголовки автоматически нормализуются в workflow-friendly вид (`[Section]` + строка `(Arrangement: ...)`), при этом в metadata сохраняется исходный enriched-текст.

**Тема и форма:** в промпте задан контракт `LYRICS_THEME_PRIORITY_UNIVERSAL_RU` (примеры частушек, баллады, сонета, рэпа, поп-структуры) и функция `_get_form_specific_instructions(theme)` — усиление для тем, где в тексте явно названы частушки, баллада, сонет, рэп. Пресет стиля вторичен. На фронте добавлен пресет **`folk`** («Народная / частушки») в селекте жанра текста.

### UI (фронт)

Вкладка «Генератор»: три колонки на широком экране — **текст** слева, **запуск и результат** по центру, **параметры трека (звук)** справа; на узком экране порядок: текст → звук → запуск. Ползунки вариативности / следования / разнообразия (режим «Стандарт») дублируются в запросы текста и стиля.

Вкладка **«Подходы»** тестирует только текущие 4 версии (`XL Turbo`, `XL Base`, `XL SFT`, `ACE V3`). Смена жанра в форме подхода сразу обновляет стартовые **tags**, BPM/temperature/CFG/top-p random-диапазоны и фиксированные вокал/тональность/размер по `musicStyleProfiles.ts`; смена версии пересобирает sane random-профиль под Turbo/Base/SFT/V3. В UI есть быстрые профили диапазонов **«Сбалансировано»**, **«Чище вокал»**, **«Шире поиск»**; реализация вынесена из React-компонента в `BatchTests/musicBatchTestHelpers.ts` и покрыта Vitest. Кнопка **AI демо** в блоке «Текст демо» вызывает существующие локальные AI-эндпоинты `/lyrics` и `/generate-style`, сжимает ответ до короткого демо-блока и обновляет tags перед запуском batch. В карточке подхода есть краткая аналитика: успешные/оценённые строки, первый лучший кандидат, seed/BPM/CFG/temperature/sampler и средний CFG по успешным.

Вкладка **XL Base/SFT**: слева — модель, пресет сэмплинга и блок **Запуск**; справа — подсвеченная **Тема песни**, жанр XL, **XL preview** под спойлером (текст/теги, AI текст/теги). Полный поток — «Создать XL-трек»; без LLM — «Сгенерировать из текста и тегов». Смена жанра XL синхронизирует tags и типичные параметры формы до генерации, чтобы не оставался старый sound prompt. Галочка **«KSampler как в шаблоне Comfy»** по умолчанию **снята** (безопасный client `cfg` 1.2–3.2); включение явно шлёт `ksampler_use_comfy_template=true`. После генерации на любой вкладке студия **не переключается** на «Профессиональный» из-за синхронизации `unifiedContentId` в payload окна. По реальным оценкам демо Base-пресеты сэмплинга сдвинуты в вокально-стабильный коридор (`temperature` около 0.78–0.92, `top_p` около 0.87–0.90, KSampler `cfg` около 2.0–2.2), а full-song запуск Base/SFT получил BPM-guard для жанров, где плохие оценки были связаны с уходом в чужой темп: например `drum and bass` не опускается в поповый 110–125 BPM, `country_pop` удерживается около 96 BPM, `luna` — около 118 BPM. Те же guard-правила применяются при запуске Wizard v2 и при переносе rated batch-кандидата через «применить в XL Studio».

Жанры расширены пресетами **trap**, **punk rock**, **shoegaze**, **darkwave**, **eurodance**, **UK garage**, **flamenco pop**, **city pop**. На фронте типичные параметры формы вынесены в `MusicGenerator/musicStyleProfiles.ts`; backend синхронизирует BPM, `Style:`-префиксы, lyrics-guides и ACE tag-finalize. Для **eurodance** действует правило EDM tags: нужны `[build up]` и `[drop]`.

**Версия 3** в блоке «Пайплайн UGS» вкладки «Основной» не использует старые `/lyrics` и `/generate-style`: фронт `MusicGenerator/v3/` хранит отдельный localStorage и вызывает только `/music-generator/v3/*`. В UI есть два режима: **Авто** (пользователь выбирает только тему, стиль, язык и вокал; BPM/тональность/длительность берутся из suggest + V3-пресета, sampler/encoder — из пресета стиля) и **Ручной** (как раньше, все параметры доступны). Результаты сохраняются как обычный `music_generator` unified content, но с metadata `music_generator_version: v3`, `ugs_workflow: v3`, `music_generator_v3_generation_mode`. MP3 workflow V3 сохраняет `SaveAudioMP3.quality=320k`.

В авто-режиме V3 можно выбрать **солиста** (`soloist`): это не voice cloning, а максимально точный для текущего ACE Step/ComfyUI text2music способ закрепить голос через `tags/caption` и lyrics structure. ComfyUI `TextEncodeAceStepAudio1.5` принимает `tags` и `lyrics` как conditioning; документация ACE Step описывает vocal gender/timbre/technique через caption/tags (`female vocal`, `male vocal`, `breathy`, `raspy`, `falsetto`, `harmonies`) и vocal hints в lyrics. Поэтому солист добавляет фиксированные voice descriptors, style descriptors и prompt-директиву, а не speaker-id.

V3 отдельно управляет двумя слоями ACE Step 1.5 / ComfyUI:

- `TextEncodeAceStepAudio1.5`: `cfg_scale`, `temperature`, `top_p`, `top_k`, `min_p`, `generate_audio_codes`, а также `bpm`, `duration`, `language`, `keyscale`, `timesignature`.
- `KSampler` / latent: `steps`, `cfg`, `sampler_name`, `scheduler`, `denoise`, `batch_size`, `shift`.

Жанровые V3-пресеты задают не только tags/BPM, но и эти sampler/encoder defaults; UI позволяет их менять перед запуском в ручном режиме.

Выбор V3 `vocal` больше не выводится из жанрового пресета после выбора пользователя. Для русского solo-текста prompt и backend-постобработка выравнивают формы первого лица под `male`/`female`; для `duet` lyrics получают явные секции `[Verse - male lead]`, `[Verse - female lead]`, `[Chorus - duet harmonies]`, а tags дополняются `male and female duet vocal`, `alternating leads`, `call and response`.

Солисты V3 auto: **Венера** (женский dream/synth/electro-pop, интимный close-mic vocal, ностальгия 90-х/00-х и гипнотичные хуки), **Север** (мужской баритон, cinematic pop rock), **Мира** (smoky female soul/R&B), **Неон** (male urban/trap-pop), **Искра** (bright female pop belting), **Орбита** (duet male/female). Если солист задаёт свой `vocal`, backend считает его главным и не даёт suggest-у заменить голос.

Для V3 `lyrics` перед ACE теперь синхронизируются как в стабильном V2-контракте: сохраняются/добавляются enriched-заголовки `[Section: English production hints, N BPM feel]`, а workflow превращает их в `[Section]` + английскую строку `(Arrangement: …)`. Обычные русские круглые скобки и inline-эхо вроде `(танцую)` удаляются, потому что ACE-Step часто поёт их как backing vocals и даёт артефакты. `generate-style` получает обязательный section skeleton из тех же lyrics и обязан зеркалить порядок секций в `tags`.

### Тесты

`shared/api/tests/test_music_lyrics_validation.py` — санитайз, `normalized_lyrics`, контракт lyrics/tags (заголовки `[Drop]`, фразы `white noise sweep`, каноническая структура для style).

`shared/api/tests/test_music_generator_v3.py` — контракт V3 schema, выбор workflow `audio_ace_step_1_5_split_4b_v3.json` и split 4B CLIP nodes.

### БД (описания UGS)

Миграция `shared/api/migrations/applied/20260405_music_generator_generation_types_descriptions.sql` — уточнение `description` для `music_generator_lyrics` и `music_generator_style`.

Миграция `shared/api/migrations/applied/20260407_ensure_music_generator_wizard_professional_generation_types.sql` — строки `generation_types` для `music_generator_generate_ace_wizard` / `_professional` (и DiffRhythm с теми же суффиксами), иначе UGS возвращает «тип генерации … не найден». Идемпотентна; применить через `api/migrations/apply_migrations.sh`.
