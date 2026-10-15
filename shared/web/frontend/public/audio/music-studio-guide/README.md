# Озвучка экскурсии «Генератор песен»

Каталог **`ru/`** — необязательные **`*.wav`** по **`id`** шагов из `musicStudioGuideData.ts` (`audio/music-studio-guide/ru/<stepId>.wav`).

Регенерация — см. `voice-command-guide/README.md`; имена файлов = **`id`** шага в коде.

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

