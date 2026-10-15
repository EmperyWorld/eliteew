# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Faster-Whisper STT and Llama document-analysis helpers for UGS text provider execution.
# Invariants:
# - generation_type routing matches former inline branches in provider_execution_text.
# - decode_binary_payload contract shared with ComfyUI media/music callers via mixin.
# Related:
# - api/services/ugs/provider_execution_text.py
# - api/services/ugs/provider_manager_service_v2.py
# ---

from __future__ import annotations

import asyncio
import base64
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from api.services.ugs.provider_config_models import ProviderError

logger = logging.getLogger(__name__)


def normalize_text_result_payload(result: dict[str, Any] | None) -> dict[str, Any]:
    out = dict(result) if result else {}
    text = out.get("response") or out.get("text") or out.get("content") or ""
    if text and ("text" not in out or "content" not in out):
        out.setdefault("text", text)
        out.setdefault("content", text)
    return out


def decode_binary_payload(raw_value: Any, *, field_name: str) -> bytes:
    if isinstance(raw_value, (bytes, bytearray)):
        return bytes(raw_value)
    if not isinstance(raw_value, str) or not raw_value.strip():
        msg = f"Поле '{field_name}' должно содержать base64-данные файла."
        raise ProviderError(msg)

    payload = raw_value.strip()
    if payload.startswith("data:"):
        payload = payload.split(",", 1)[-1]

    try:
        return base64.b64decode(payload)
    except (TypeError, ValueError) as exc:
        msg = f"Поле '{field_name}' содержит некорректный base64."
        raise ProviderError(msg) from exc


def build_document_analysis_prompt(
    *,
    text: str,
    file_name: str,
    analysis_type: str,
    max_chars: int = 12000,
) -> tuple[str, dict[str, Any]]:
    normalized_analysis_type = analysis_type.strip().lower() or "comprehensive"
    truncated_text = text[:max_chars].strip()
    was_truncated = len(text) > len(truncated_text)

    analysis_instructions = {
        "summary": "Сделай краткое резюме документа на русском языке.",
        "structured": (
            "Сделай структурированный анализ документа на русском языке: ключевые разделы, выводы, риски, рекомендации."
        ),
        "comprehensive": (
            "Сделай подробный анализ документа на русском языке: "
            "основная тема, ключевые факты, важные выводы, риски, рекомендации."
        ),
    }
    instruction = analysis_instructions.get(
        normalized_analysis_type,
        analysis_instructions["comprehensive"],
    )

    truncation_notice = (
        "Документ был обрезан до первых 12000 символов, поэтому отметь, если для полной точности нужен полный текст."
        if was_truncated
        else "Используй весь переданный текст документа."
    )

    prompt = "\n\n".join(
        [
            "Ты анализируешь документ для UGS. Всегда отвечай на русском языке.",
            f"Имя файла: {file_name}",
            f"Режим анализа: {normalized_analysis_type}",
            instruction,
            truncation_notice,
            "Верни ответ в виде понятного markdown-отчёта.",
            "Текст документа:",
            truncated_text,
        ]
    )

    return prompt, {
        "analysis_type": normalized_analysis_type,
        "file_name": file_name,
        "source_length": len(text),
        "truncated": was_truncated,
        "processed_length": len(truncated_text),
    }


async def call_llama_document_analysis(
    llama_provider: Any,
    *,
    generation_type: str,
    input_data: dict[str, Any],
    model: str,
) -> dict[str, Any]:
    from api.services.document_processor import DocumentProcessor  # noqa: PLC0415

    if llama_provider is None:
        msg = "Llama provider not initialized"
        raise RuntimeError(msg)

    file_name = str(input_data.get("file_name") or "document")
    file_bytes = decode_binary_payload(
        input_data.get("file_content"),
        field_name="file_content",
    )
    analysis_type = str(input_data.get("analysis_type") or "comprehensive")

    processor = DocumentProcessor(use_ai_features=False)
    extracted_text = (await processor.extract_text_from_bytes(file_bytes, file_name)).strip()
    if not extracted_text:
        msg = "Не удалось извлечь текст из документа."
        raise ProviderError(msg)

    prompt, document_metadata = build_document_analysis_prompt(
        text=extracted_text,
        file_name=file_name,
        analysis_type=analysis_type,
    )

    result = None
    async for chunk in llama_provider.generate_text(
        prompt=prompt,
        model=model,
        options={"num_predict": 4096},
        stream=False,
    ):
        result = chunk
        break

    out = normalize_text_result_payload(result)
    out.setdefault("analysis_type", document_metadata["analysis_type"])
    out.setdefault("file_name", file_name)
    out.setdefault("document_stats", document_metadata)

    return {
        "provider": "llama",
        "generation_type": generation_type,
        "result": out,
        "metadata": document_metadata,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def _parse_optional_uuid(raw_id: str | None, *, label: str) -> UUID | None:
    if not raw_id or raw_id == "None":
        return None
    try:
        return UUID(raw_id)
    except (ValueError, TypeError):  # fmt: skip
        logger.warning("Invalid %s format: %s", label, raw_id)
        return None


def _detect_audio_mime_type(audio_bytes: bytes, mime_type: Any) -> str:
    resolved = mime_type if isinstance(mime_type, str) else "audio/webm"
    if not resolved or resolved == "application/octet-stream":
        if audio_bytes[:4] == b"RIFF":
            return "audio/wav"
        if audio_bytes[:4] == b"fLaC":
            return "audio/flac"
        if audio_bytes[:4] == b"OggS":
            return "audio/ogg"
        return "audio/webm"
    return resolved


def _extract_transcription_text(transcription: Any) -> str:
    if isinstance(transcription, dict):
        return transcription.get("text", "") or ""
    if isinstance(transcription, str):
        return transcription
    if hasattr(transcription, "text"):
        return transcription.text
    if isinstance(transcription, list) and len(transcription) > 0:
        assert isinstance(transcription, list), "transcription must be a list"
        transcription_list: list[Any] = list(transcription)  # type: ignore[assignment]
        return " ".join([seg.get("text", "") if isinstance(seg, dict) else str(seg) for seg in transcription_list])
    return ""


async def call_faster_whisper(
    generation_type: str,
    input_data: dict[str, Any],
    *,
    content_service: Any | None,
    current_user_id: str | None,
    current_company_id: str | None,
    current_project_id: str | None,
) -> dict[str, Any]:
    """Call whisper-fast (stack9) provider via STTService."""
    from api.services.voice.stt_service import STTService  # noqa: PLC0415

    input_keys = list(input_data.keys())
    input_preview = str(input_data)[:500]
    logger.debug(
        "Faster-Whisper call: %s with data keys: %s",
        generation_type,
        input_keys,
    )
    logger.debug(
        "Faster-Whisper input_data content: %s",
        input_preview,
    )  # Log first 500 chars

    try:
        if generation_type != "audio_transcription_faster_whisper":
            msg = f"Unsupported Faster-Whisper generation type: {generation_type}"
            raise ProviderError(msg)

        # Check all possible keys for audio data
        raw_audio = input_data.get("audio_base64") or input_data.get("audio_data") or input_data.get("audio_bytes")

        # Log what we found
        has_audio_base64 = bool(input_data.get("audio_base64"))
        has_audio_data = bool(input_data.get("audio_data"))
        has_audio_bytes = bool(input_data.get("audio_bytes"))
        has_raw_audio = bool(raw_audio)
        logger.debug(
            "Faster-Whisper audio data check: audio_base64=%s, audio_data=%s, audio_bytes=%s, raw_audio=%s",
            has_audio_base64,
            has_audio_data,
            has_audio_bytes,
            has_raw_audio,
        )

        if not raw_audio:
            # Log full input_data structure for debugging
            input_keys_list = list(input_data.keys())
            input_preview_str = ", ".join(f"{k}={str(v)[:200]}" for k, v in input_data.items())
            logger.error(
                "Faster-Whisper: No audio data found. Input data keys: %s",
                input_keys_list,
            )
            logger.error(
                "Faster-Whisper: Input data values (first 200 chars each): %s",
                input_preview_str,
            )
            msg = "Audio data is required for transcription"
            raise ProviderError(msg)

        if isinstance(raw_audio, str):
            # Strip data URL prefix if present
            if raw_audio.startswith("data:"):
                raw_audio = raw_audio.split(",", 1)[-1]
            try:
                audio_bytes = base64.b64decode(raw_audio)
            except (ValueError, TypeError) as exc:
                msg = f"Invalid base64 audio data: {exc}"
                raise ProviderError(msg) from exc
        elif isinstance(raw_audio, (bytes, bytearray)):
            audio_bytes = bytes(raw_audio)
        else:
            msg = "Unsupported audio data format"
            raise ProviderError(msg)

        language = input_data.get("language")
        model = input_data.get("model")

        # Save original audio to unified content (if content_service available and user_id provided)
        # ⚠️ IMPORTANT: Save with timeout to avoid blocking transcription
        audio_content_id = None
        has_content_service = content_service is not None
        logger.debug(
            "Checking unified content save: content_service=%s, user_id=%s",
            has_content_service,
            current_user_id,
        )
        if content_service and current_user_id:
            try:
                from api.schemas.unified_content import ContentCreate, ContentType, Visibility

                mime_type = _detect_audio_mime_type(audio_bytes, input_data.get("mime_type", "audio/webm"))
                audio_filename = input_data.get("filename", f"audio_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.webm")

                company_uuid = _parse_optional_uuid(current_company_id, label="company_id")
                project_uuid = _parse_optional_uuid(current_project_id, label="project_id")

                audio_content_data = ContentCreate(
                    user_id=current_user_id,
                    name=f"Audio: {audio_filename}",
                    description=f"Original audio file for transcription (model: {model}, language: {language})",
                    content_type=ContentType.AUDIO,
                    mime_type=mime_type,
                    sub_type="transcription_source",
                    original_filename=audio_filename,
                    tags=["transcription", "audio", "ugs"],
                    visibility=Visibility.PRIVATE,
                    source_service="ugs",
                    source_id=str(uuid4()),
                    company_id=company_uuid,
                    project_id=project_uuid,
                    title=None,
                    word_count=None,
                    character_count=None,
                    access_level=None,
                    is_public=None,
                    folder_item_id=None,
                    apply_project_desktop_folder=True,
                    metadata={
                        "generation_type": generation_type,
                        "model": model,
                        "language": language,
                        "file_size": len(audio_bytes),
                    },
                )

                # Save with 30 second timeout to avoid blocking transcription
                try:
                    async with asyncio.timeout(30.0):
                        audio_content = await content_service.create_content(
                            content_data=audio_content_data,
                            file_data=audio_bytes,
                            user_id=current_user_id,
                        )
                    audio_content_id = audio_content.id
                    logger.info(
                        "Saved original audio to unified content: %s",
                        audio_content_id,
                    )
                except TimeoutError:
                    logger.warning("Timeout saving audio to unified content (30s limit), continuing with transcription")
                    audio_content_id = None
            except (OSError, ValueError, TypeError) as e:
                error_msg = str(e)
                # Don't log full traceback for large files or storage issues
                error_preview = error_msg[:200]
                if "too many 500 error responses" in error_msg or "Max retries exceeded" in error_msg:
                    logger.warning(
                        "Failed to save audio to unified content (storage issue): %s",
                        error_preview,
                    )
                else:
                    logger.warning(
                        "Failed to save audio to unified content: %s",
                        error_preview,
                    )
                # Continue with transcription even if saving fails
                audio_content_id = None

        transcription = await STTService.transcribe(audio_data=audio_bytes, language=language)

        transcription_text = _extract_transcription_text(transcription)

        # Save transcription result to unified content (if content_service available and user_id provided)
        # ⚠️ IMPORTANT: Save with timeout to avoid blocking response
        transcription_content_id = None
        if content_service and current_user_id and transcription_text:
            try:
                from api.schemas.unified_content import ContentCreate, ContentType, Visibility

                transcription_filename = f"transcription_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.txt"
                transcription_bytes = transcription_text.encode("utf-8")

                related_content = []
                if audio_content_id:
                    related_content.append(audio_content_id)

                company_uuid = _parse_optional_uuid(current_company_id, label="company_id")
                project_uuid = _parse_optional_uuid(current_project_id, label="project_id")

                transcription_content_data = ContentCreate(
                    user_id=current_user_id,
                    name=f"Transcription: {transcription_filename}",
                    description=f"Transcription result (model: {model}, language: {language})",
                    content_type=ContentType.AI_RESULT,
                    mime_type="text/plain",
                    sub_type="transcription_result",
                    original_filename=transcription_filename,
                    tags=["transcription", "text", "ugs", "whisper"],
                    visibility=Visibility.PRIVATE,
                    source_service="ugs",
                    source_id=str(uuid4()),
                    company_id=company_uuid,
                    project_id=project_uuid,
                    related_content=related_content,
                    title=None,
                    word_count=None,
                    character_count=None,
                    access_level=None,
                    is_public=None,
                    folder_item_id=None,
                    apply_project_desktop_folder=True,
                    metadata={
                        "generation_type": generation_type,
                        "model": model,
                        "language": language,
                        "text_length": len(transcription_text),
                        "character_count": len(transcription_text),
                        "word_count": len(transcription_text.split()),
                    },
                )

                # Save text asynchronously (don't block response)
                # Run in background to avoid delaying user response
                try:
                    async with asyncio.timeout(5.0):
                        transcription_content = await content_service.create_content(
                            content_data=transcription_content_data,
                            file_data=transcription_bytes,
                            user_id=current_user_id,
                        )
                    transcription_content_id = transcription_content.id
                    logger.info(
                        "Saved transcription result to unified content: %s",
                        transcription_content_id,
                    )
                except TimeoutError:
                    logger.warning("Timeout saving transcription to unified content (5s limit), skipping")
                    transcription_content_id = None
            except (OSError, ValueError, TypeError) as e:
                error_msg = str(e)
                # Don't log full traceback for large files or storage issues
                error_preview = error_msg[:200]
                if "too many 500 error responses" in error_msg or "Max retries exceeded" in error_msg:
                    logger.warning(
                        "Failed to save transcription to unified content (storage issue): %s",
                        error_preview,
                    )
                else:
                    logger.warning(
                        "Failed to save transcription to unified content: %s",
                        error_preview,
                    )
                # Continue even if saving fails
                transcription_content_id = None

        result_dict = {
            "provider": "faster_whisper",
            "generation_type": generation_type,
            "result": transcription,
            "timestamp": datetime.now(UTC).isoformat(),
        }

        # Add unified content IDs to result if saved
        if audio_content_id or transcription_content_id:
            result_dict["unified_content"] = {}
            unified_content_dict: dict[str, str] = {}
            if audio_content_id:
                unified_content_dict["audio_id"] = str(audio_content_id)
            if transcription_content_id:
                unified_content_dict["transcription_id"] = str(transcription_content_id)
            result_dict["unified_content"] = unified_content_dict

        return result_dict

    except ProviderError:
        raise
    except (OSError, ValueError, TypeError) as e:
        logger.exception("Faster-Whisper provider error")
        raise ProviderError(str(e)) from e
