# Озвучка экскурсии «Голосовой штаб»

Каталог **`ru/`** — готовые **`*.wav`** (голос **Ксения**, silero `xenia`). Исходные тексты: **`narrations.ru.json`**.

Фронт подхватывает файлы как `/audio/voice-command-guide/ru/<id шага>.wav` (Vite `public/`).

## Регенерация без токена (Docker API)

Когда поднят `stack0-eliteew-api-prod`, из **корня монорепозитория**:

```bash
docker cp shared/web/frontend/public/audio/voice-command-guide/narrations.ru.json stack0-eliteew-api-prod:/tmp/narrations.ru.json

docker exec stack0-eliteew-api-prod python -c "
import asyncio, json
from pathlib import Path
from api.services.voice_gateway_service import synthesize_speech
data = json.loads(Path('/tmp/narrations.ru.json').read_text(encoding='utf-8'))
async def main():
    Path('/tmp/vcc-guide-ru').mkdir(parents=True, exist_ok=True)
    for k, text in data['steps'].items():
        b = await synthesize_speech(text, voice=data.get('voice', 'xenia'))
        (Path('/tmp/vcc-guide-ru') / f'{k}.wav').write_bytes(b)
        print(k, len(b))
asyncio.run(main())
"

mkdir -p shared/web/frontend/public/audio/voice-command-guide/ru
docker cp stack0-eliteew-api-prod:/tmp/vcc-guide-ru/. shared/web/frontend/public/audio/voice-command-guide/ru/
```

## Регенерация с токеном (хост → API)

```bash
cd shared/web/frontend
ELITEEW_SYNTH_API_URL=http://127.0.0.1:29000 ELITEEW_BEARER_TOKEN='<access_jwt>' node scripts/generate-voice-command-guide-audio.mjs
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

