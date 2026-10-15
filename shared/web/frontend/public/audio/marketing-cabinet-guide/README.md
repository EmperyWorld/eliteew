# Маркетинговый кабинет — озвучка экскурсии

Файлы: **`ru/<stepId>.wav`** (голос **Ксения**, Silero **`xenia`**, stack9) и опционально **`en/<stepId>.wav`** (Silero **`en_0`**, `language=en` в API). Идентификаторы шагов совпадают с `MarketingCabinetGuideModal`: `intro`, `toolbar`, `sidebar`, `overviewMode`, `dashboardToolbar`, `widgetChrome`, `dashboardGrid`. Исходные тексты: **`narrations.ru.json`**, **`narrations.en.json`**. Ключ `localStorage`: `mc-guide-audio-enabled`.

Фронт: `/audio/marketing-cabinet-guide/<locale>/<id>.wav` (`ru` | `en`).

## Поднять stack9

Из **корня монорепозитория** (нужны сеть `ew_net_3365`, NVIDIA runtime и образы):

```bash
docker compose -f docker/stack/stack9.yml --env-file docker/env_file/.env.stack9 up -d
```

Проверка Silero на хосте: `curl -sf http://127.0.0.1:32001/health`

## Регенерация WAV через контейнер `stack9-silero`

После обновления кода Silero (поддержка **`language: en`**) пересоберите образ **`stack9-silero`** и перезапустите сервис, иначе контейнер отдаст старый `/synthesize` без английской модели.

```bash
chmod +x docker/scripts/generate-marketing-cabinet-guide-audio-stack9.sh
./docker/scripts/generate-marketing-cabinet-guide-audio-stack9.sh
```

Английские тексты (пишет в **`public/audio/marketing-cabinet-guide/en/`**):

```bash
MARKETING_GUIDE_NARRATIONS=shared/web/frontend/public/audio/marketing-cabinet-guide/narrations.en.json \
  ./docker/scripts/generate-marketing-cabinet-guide-audio-stack9.sh
```

Другое имя контейнера: `STACK9_SILERO_CONTAINER=my-silero ./docker/scripts/generate-marketing-cabinet-guide-audio-stack9.sh`

## Регенерация через API (stack0)

Аналогично `voice-command-guide`: `docker cp` **`narrations.ru.json`** в `stack0-eliteew-api-prod`, цикл `synthesize_speech`, `docker cp` **`ru/`** обратно в `public/audio/marketing-cabinet-guide/ru/`.

## Фронт в Docker

Контейнер **`stack0-eliteew-frontend-prod`** отдаёт **`dist-build`**. После добавления WAV выполните сборку фронта и при необходимости перезапустите nginx-контейнер.

## Layout (2026-06)

WAV files live under `{ru,en}/{man,woman}/{stepId}.wav`:

- **man** — po&T (`man_1` TTS)
- **woman** — TZBrand (`baya` TTS)
- Locale follows app i18n (`ru` / `en` when `narrations.en.json` exists)

Regenerate (command-center, stack9 up):

```bash
bash docker/scripts/generate-guide-audio-stack9.sh <this-folder-name>
```

Batch all tours with `narrations.ru.json`:

```bash
bash docker/scripts/generate-all-guide-audio-stack9.sh
```

