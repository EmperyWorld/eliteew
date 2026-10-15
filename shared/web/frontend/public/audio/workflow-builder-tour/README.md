# Озвучка экскурсии Workflow Builder

Исходные тексты: **`narrations.ru.json`**, **`narrations.en.json`** (поле `steps`). Голос: **`xenia`** — **выразительная Ксения** в Silero. Вариант **`kseniya`** — другая запись «Ксения, тёплая»; для тура используем **только `xenia`**.

Готовые файлы в репозитории: **`ru/*.wav`** (голос Ксения / `xenia`). Имена: `intro`, `header`, `toolbar`, `palette`, `canvas`, `inspector`, `help`.

**Английский:** `narrations.en.json` — тексты для озвучки при появлении EN‑модели в Silero. Текущий **stack9-silero** в контуре настроен на язык **`ru`**; синтез латиницы отклоняется (`unsupported characters for language 'ru'`). В UI при `en` файлы в `en/` отсутствуют — озвучка тура тихо пропускается.

URL: `{BASE_URL}audio/workflow-builder-tour/{locale}/{stepId}.wav`

Переключатель в UI пишет в **`localStorage`**: `wb-guide-tour-audio-enabled` (`1` / `0`).

## Регенерация (Docker, без JWT)

Нужны **stack0-eliteew-api-prod** и **stack9-silero**. Из корня монорепозитория:

```bash
docker cp shared/web/frontend/public/audio/workflow-builder-tour/narrations.ru.json stack0-eliteew-api-prod:/tmp/wb-narrations.ru.json
docker cp shared/web/frontend/public/audio/workflow-builder-tour/narrations.en.json stack0-eliteew-api-prod:/tmp/wb-narrations.en.json

docker exec stack0-eliteew-api-prod python -c "
import asyncio, json
from pathlib import Path
from api.services.voice_gateway_service import synthesize_speech

async def synth(path_in, out_sub):
    data = json.loads(Path(path_in).read_text(encoding='utf-8'))
    voice = data.get('voice', 'xenia')
    out = Path('/tmp') / out_sub
    out.mkdir(parents=True, exist_ok=True)
    for k, text in data['steps'].items():
        b = await synthesize_speech(text, voice=voice)
        (out / f'{k}.wav').write_bytes(b)
        print(k, len(b), flush=True)

async def main():
    await synth('/tmp/wb-narrations.ru.json', 'wb-guide-ru')
    # EN: только если Silero принимает en; иначе пропустить
    # await synth('/tmp/wb-narrations.en.json', 'wb-guide-en')

asyncio.run(main())
"

mkdir -p shared/web/frontend/public/audio/workflow-builder-tour/ru
docker cp stack0-eliteew-api-prod:/tmp/wb-guide-ru/. shared/web/frontend/public/audio/workflow-builder-tour/ru/
# docker cp stack0-eliteew-api-prod:/tmp/wb-guide-en/. shared/web/frontend/public/audio/workflow-builder-tour/en/
```

Полное описание паттерна: **`product/GUIDED-TOUR-EXCURSION.md`**.

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

