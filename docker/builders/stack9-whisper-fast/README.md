# Faster-Whisper Service

STT (Speech-to-Text) сервис на базе faster-whisper с моделью large-v3 для русского языка.

## Особенности

- **Модель**: large-v3 (MIT лицензия)
- **Язык**: только русский (ru)
- **GPU**: NVIDIA CUDA поддержка
- **API**: FastAPI REST API

## Сборка образа

⚠️ **ВНИМАНИЕ**: Первая сборка может занять **10-20 минут** из-за:
- Базового образа NVIDIA CUDA (~5-7 GB)
- PyTorch с CUDA поддержкой (~2-3 GB)
- faster-whisper и зависимости (~500 MB)

**Это нормально!** Последующие сборки будут быстрее благодаря кешу Docker.

### Быстрая сборка

```bash
cd docker/audio-services/whisper-fast
docker build -t ew_whisper_fast:large-v3 .
```

### Запуск через docker-compose

```bash
docker compose -f docker/stack/stack9.yml up -d whisper-fast
```

## Проверка работы

```bash
# Healthcheck
curl http://localhost:32000/health

# Транскрибация
curl -X POST http://localhost:32000/transcribe \
  -F "file=@audio.wav" \
  -F "language=ru"
```

## Переменные окружения

- `MODEL_SIZE` - размер модели (по умолчанию: `large-v3`)
- `LANGUAGE` - язык (по умолчанию: `ru`)
- `DEVICE` - устройство (`cuda` или `cpu`)

## Модели

Модели автоматически скачиваются при первом запуске в `/app/models`.
Можно предзагрузить модель, смонтировав volume с моделями.
