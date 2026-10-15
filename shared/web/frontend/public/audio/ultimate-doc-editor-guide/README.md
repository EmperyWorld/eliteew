# Экскурсия Ultimate Document Editor

Файлы: `ru/<stepId>.wav` (Ксения). Ключ `localStorage` озвучки: `ultimate-doc-editor-guide-audio-enabled`.

Идентификаторы шагов (должны совпадать с полем `id` в `ultimateDocEditorGuideData.ts`):

- Режим **edit**: `ude-edit-intro`, `ude-edit-header`, `ude-edit-toolbar`, `ude-edit-surface`, `ude-edit-fab`
- **markdown**: `ude-md-intro`, `ude-md-toolbar`, `ude-md-surface`
- **preview**: `ude-preview-intro`, `ude-preview-pane`, `ude-preview-editor`
- **view**: `ude-view-intro`, `ude-view-header`, `ude-view-surface`

Регенерация — как у контент-менеджера: JSON с текстами шагов в API-контейнер, `synthesize_speech`, `docker cp` в `ru/`.

```bash
# Пример: подготовить narrations.ru.json с полями voice и steps { stepId: "текст" }

docker cp shared/web/frontend/public/audio/ultimate-doc-editor-guide/narrations.ru.json stack0-eliteew-api-prod:/tmp/ude-guide-narrations.json

docker exec stack0-eliteew-api-prod python -c "
import asyncio, json
from pathlib import Path
from api.services.voice_gateway_service import synthesize_speech
data = json.loads(Path('/tmp/ude-guide-narrations.json').read_text(encoding='utf-8'))
async def main():
    Path('/tmp/ude-guide-ru').mkdir(parents=True, exist_ok=True)
    for k, text in data['steps'].items():
        b = await synthesize_speech(text, voice=data.get('voice', 'xenia'))
        (Path('/tmp/ude-guide-ru') / f'{k}.wav').write_bytes(b)
        print(k, len(b))
asyncio.run(main())
"

mkdir -p shared/web/frontend/public/audio/ultimate-doc-editor-guide/ru
docker cp stack0-eliteew-api-prod:/tmp/ude-guide-ru/. shared/web/frontend/public/audio/ultimate-doc-editor-guide/ru/
```

После добавления WAV: `pnpm run build:react-compiler` в `shared/web/frontend`.

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

