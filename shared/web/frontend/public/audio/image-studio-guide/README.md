# Озвучка экскурсии «Студия изображений»

Каталог **`ru/`** — необязательные **`*.wav`** по **`id`** шагов из `imageStudioGuideData.ts` (путь в коде: `audio/image-studio-guide/ru/<stepId>.wav`).

При отсутствии файла озвучка шага тихо пропускается. Регенерация — по тому же принципу, что в `voice-command-guide/README.md` (Docker `synthesize_speech`, имена файлов = `stepId`).

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

