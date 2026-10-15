# Экскурсия файлового менеджера

Файлы: `ru/<id шага>.wav` (Ксения). Тексты: `narrations.ru.json`. Ключ `localStorage` озвучки: `cm-guide-audio-enabled`.

Регенерация — как у голосового штаба: скопировать JSON в API-контейнер, `synthesize_speech`, `docker cp` в `ru/`.

```bash
docker cp shared/web/frontend/public/audio/content-manager-guide/narrations.ru.json stack0-eliteew-api-prod:/tmp/cm-guide-narrations.json

docker exec stack0-eliteew-api-prod python -c "
import asyncio, json
from pathlib import Path
from api.services.voice_gateway_service import synthesize_speech
data = json.loads(Path('/tmp/cm-guide-narrations.json').read_text(encoding='utf-8'))
async def main():
    Path('/tmp/cm-guide-ru').mkdir(parents=True, exist_ok=True)
    for k, text in data['steps'].items():
        b = await synthesize_speech(text, voice=data.get('voice', 'xenia'))
        (Path('/tmp/cm-guide-ru') / f'{k}.wav').write_bytes(b)
        print(k, len(b))
asyncio.run(main())
"

mkdir -p shared/web/frontend/public/audio/content-manager-guide/ru
docker cp stack0-eliteew-api-prod:/tmp/cm-guide-ru/. shared/web/frontend/public/audio/content-manager-guide/ru/
```

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

