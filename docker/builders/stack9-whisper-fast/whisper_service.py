"""
Faster-Whisper Service - STT для русского языка
Модель: large-v3 (MIT лицензия)
"""

import logging
import os

import numpy as np
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)


class FasterWhisperService:
    """Сервис транскрибации на базе faster-whisper (large-v3, русский язык)"""

    def __init__(self):
        self.model: WhisperModel | None = None
        self.model_size = os.getenv("MODEL_SIZE", "large-v3")
        self.language = os.getenv("LANGUAGE", "ru")
        self.device = os.getenv("DEVICE", "cuda")
        # float16 ~3GiB+ for large-v3; int8 fits tighter VRAM next to llama on prod-core.
        default_compute = "float16" if self.device == "cuda" else "int8"
        self.compute_type = (os.getenv("COMPUTE_TYPE") or default_compute).strip() or default_compute
        self.model_dir = "/app/models"

    def load_model(self) -> None:
        """Загружает модель Whisper"""
        if self.model is not None:
            logger.info("Модель уже загружена")
            return

        try:
            logger.info(
                f"Загрузка модели faster-whisper: {self.model_size} (язык: {self.language}, устройство: {self.device})"
            )

            # Используем faster-whisper с указанием модели и языка
            self.model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
                download_root=self.model_dir,
            )

            logger.info("✅ Модель faster-whisper успешно загружена")
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки модели: {e}", exc_info=True)
            raise

    def transcribe(
        self,
        audio_data: bytes,
        language: str | None = None,
        beam_size: int = 5,
        vad_filter: bool = True,
    ) -> dict:
        """
        Транскрибирует аудио в текст

        Args:
            audio_data: Аудио данные (WAV, MP3, etc.)
            language: Язык (по умолчанию русский)
            beam_size: Размер beam search
            vad_filter: Использовать VAD фильтрацию

        Returns:
            Словарь с результатами транскрибации
        """
        if self.model is None:
            self.load_model()

        # Используем русский язык по умолчанию
        target_language = language or self.language

        try:
            # Конвертируем bytes в numpy array для faster-whisper
            # faster-whisper принимает numpy array или путь к файлу
            import io

            import soundfile as sf

            # Читаем аудио из bytes
            audio_io = io.BytesIO(audio_data)
            audio_array, sample_rate = sf.read(audio_io)

            # Конвертируем в float32 если нужно
            if audio_array.dtype != np.float32:
                audio_array = audio_array.astype(np.float32)

            # Нормализуем если нужно
            if np.max(np.abs(audio_array)) > 1.0:
                audio_array = audio_array / np.max(np.abs(audio_array))

            # Транскрибируем
            segments, info = self.model.transcribe(
                audio_array,
                language=target_language,
                beam_size=beam_size,
                vad_filter=vad_filter,
                vad_parameters=dict(min_silence_duration_ms=500),
            )

            # Собираем текст из сегментов
            text_parts = []
            segments_list = []
            for segment in segments:
                text_parts.append(segment.text)
                segments_list.append(
                    {
                        "text": segment.text,
                        "start": segment.start,
                        "end": segment.end,
                        "no_speech_prob": getattr(segment, "no_speech_prob", None),
                    }
                )

            full_text = " ".join(text_parts).strip()

            result = {
                "text": full_text,
                "language": info.language,
                "language_probability": info.language_probability,
                "duration": info.duration,
                "duration_after_vad": getattr(info, "duration_after_vad", None),
                "segments": segments_list,
            }

            logger.info(
                f"Транскрибация завершена: {len(full_text)} символов, "
                f"язык: {info.language} ({info.language_probability:.2%})"
            )

            return result

        except Exception as e:
            logger.error(f"❌ Ошибка транскрибации: {e}", exc_info=True)
            raise
