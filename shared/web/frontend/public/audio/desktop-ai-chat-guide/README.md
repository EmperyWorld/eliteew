# Desktop AI Chat — озвучка экскурсии

Файлы: `ru/<stepId>.wav` (голос **Ксения**, Silero **`xenia`**, stack9). Исходные тексты: **`narrations.ru.json`**. Ключ `localStorage`: `desktop-ai-chat-guide-audio-enabled`.

Фронт: `/audio/desktop-ai-chat-guide/ru/<id>.wav`.

## Важно для Docker (nginx stack0)

Контейнер **`stack0-eliteew-frontend-prod`** монтирует только **`shared/web/frontend/dist-build`** в `/usr/share/nginx/html`. Файлы из `public/` попадают туда **только при сборке** (`pnpm run build:react-compiler` или ваш prod-build). Если после генерации WAV вы не пересобрали фронт — в UI запросы к `.wav` дадут **404** и будет тишина. После сборки: `docker restart stack0-eliteew-frontend-prod` (если нужен сброс кэша).

## Регенерация через Stack9 в Docker (предпочтительно)

Скрипт вызывает **`POST http://127.0.0.1:8000/synthesize`** **внутри** контейнера **`stack9-silero`** (тот же endpoint, что использует API через `SileroService`).

Из **корня монорепозитория**:

```bash
./docker/scripts/generate-desktop-ai-chat-guide-audio-stack9.sh
```

Или с другим именем контейнера: `STACK9_SILERO_CONTAINER=my-silero ./docker/scripts/...`

Вспомогательный модуль: `docker/scripts/_desktop_ai_chat_guide_tts_stack9.py` — ответ `/synthesize` — **JSON** с полем `audio_base64`; в файлы `.wav` пишутся только **декодированные** PCM/WAV-байты (не сырой JSON), иначе браузер даёт `MEDIA_ERR_SRC_NOT_SUPPORTED` / `Unable to decode audio data`.

## Регенерация через API (stack0)

При поднятом **`stack0-eliteew-api-prod`** (обёртка над тем же Silero):

```bash
docker cp shared/web/frontend/public/audio/desktop-ai-chat-guide/narrations.ru.json stack0-eliteew-api-prod:/tmp/desktop-ai-chat-guide-narrations.json

docker exec stack0-eliteew-api-prod python -c "
import asyncio, json
from pathlib import Path
from api.services.voice_gateway_service import synthesize_speech
data = json.loads(Path('/tmp/desktop-ai-chat-guide-narrations.json').read_text(encoding='utf-8'))
async def main():
    Path('/tmp/desktop-ai-chat-guide-ru').mkdir(parents=True, exist_ok=True)
    for k, text in data['steps'].items():
        b = await synthesize_speech(text, voice=data.get('voice', 'xenia'))
        (Path('/tmp/desktop-ai-chat-guide-ru') / f'{k}.wav').write_bytes(b)
        print(k, len(b))
asyncio.run(main())
"

mkdir -p shared/web/frontend/public/audio/desktop-ai-chat-guide/ru
docker cp stack0-eliteew-api-prod:/tmp/desktop-ai-chat-guide-ru/. shared/web/frontend/public/audio/desktop-ai-chat-guide/ru/
```

Без WAV тур работает только с текстом; отсутствие файла при `play()` не ломает UI.

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

