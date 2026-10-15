# Озвучка экскурсии «EWA Desktop» (спутник на столе)

Каталог **`ru/`** — **`*.wav`** по **`id`** шагов из `EwaDesktopGuideModal.tsx`.

Путь в рантайме: `/audio/ewa-desktop-guide/ru/<stepId>.wav`.

## Регенерация (stack9 CosyVoice3, локально)

```bash
# из корня монорепозитория
podman compose -f docker/stack/stack9.yml --env-file docker/env_file/.env.stack9 up -d cosyvoice3
bash docker/scripts/generate-ewa-desktop-guide-audio-stack9.sh
```

Голос по умолчанию: **`companion_ewa`** (`narrations.ru.json`). Legacy Silero:

```bash
EWA_GUIDE_TTS_CONTAINER=stack9-silero EWA_GUIDE_TTS_MODE=silero bash docker/scripts/generate-ewa-desktop-guide-audio-stack9.sh
```

После генерации: `cd shared/web/frontend && pnpm run build:react-compiler`.

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

