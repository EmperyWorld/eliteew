# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# CPU-heavy science stack operations — runs only on queue-worker science sidecar.
# Invariants:
# - Not imported from stack0-api request paths.
# Related:
# - api/services/document_processor.py (semantic analyze caller)
# - api/services/live_voice/pipeline_orchestrator.py (WAV merge caller)
# ---
from __future__ import annotations

import base64
import logging
from collections import Counter
from io import BytesIO
from typing import Any, cast

logger = logging.getLogger(__name__)

MIN_WORD_LENGTH = 3


def semantic_analyze_text(text: str, *, max_features: int = 20) -> dict[str, Any]:
    """TF-IDF semantic analysis via scikit-learn; Counter fallback if sklearn missing."""
    try:
        import numpy as np  # type: ignore[import-not-found]
        from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore[import-not-found]
        from sklearn.metrics.pairwise import cosine_similarity  # type: ignore[import-not-found]
    except ImportError as exc:
        logger.warning("[STEP] science_engine_sklearn_unavailable err=%s", exc)
        return _semantic_analyze_counter_fallback(text)

    try:
        vectorizer = TfidfVectorizer(max_features=max_features, stop_words="english")
        sentences = text.split(".")[:10]
        if len(sentences) <= 1:
            return _semantic_analyze_counter_fallback(text)

        tfidf_matrix = vectorizer.fit_transform(sentences)
        feature_names = vectorizer.get_feature_names_out()
        matrix_sum = cast(Any, tfidf_matrix).sum(axis=0)
        scores = np.asarray(matrix_sum).ravel()
        top_indices = scores.argsort()[-10:][::-1]
        key_terms = [feature_names[i] for i in top_indices]
        similarity_matrix = cosine_similarity(tfidf_matrix)
        coherence = float(np.mean(similarity_matrix))
        return {
            "key_terms": list(key_terms),
            "coherence": coherence,
            "sentence_count": len(sentences),
            "confidence": min(coherence * 2, 1.0),
        }
    except Exception as exc:
        logger.exception("[STEP] science_engine_semantic_analyze_fail err=%s", exc)
        return _semantic_analyze_counter_fallback(text)


def _semantic_analyze_counter_fallback(text: str) -> dict[str, Any]:
    words = text.split()
    word_freq = Counter(words[:100])
    common_words = word_freq.most_common(10)
    key_terms = [word for word, _ in common_words if len(word) > MIN_WORD_LENGTH]
    return {
        "key_terms": key_terms[:10],
        "coherence": 0.5,
        "sentence_count": len(text.split(".")),
        "confidence": 0.6,
    }


def merge_wav_chunks(chunks: list[bytes], *, pause_seconds: float = 0.1) -> bytes:
    """Merge WAV chunks using scipy (supports IEEE float PCM from TTS pipelines)."""
    try:
        import numpy as np  # type: ignore[import-untyped]
        import scipy.io.wavfile  # type: ignore[import-untyped]
    except ImportError as exc:
        msg = "Science sidecar requires scipy+numpy for WAV merge"
        raise RuntimeError(msg) from exc

    combined_samples: list[Any] = []
    sample_rate: int | None = None
    for chunk_audio in chunks:
        wav_io = BytesIO(chunk_audio)
        wav_io.seek(0)
        sr, samples = scipy.io.wavfile.read(wav_io)
        if sample_rate is None:
            sample_rate = int(sr)
        if samples.dtype != np.int16:
            if samples.dtype in (np.float32, np.float64):
                peak = np.max(np.abs(samples))
                if peak > 0:
                    samples = samples / peak
            samples = (samples * 32767).astype(np.int16)
        combined_samples.append(samples)

    if sample_rate is None:
        raise ValueError("Sample rate is required for audio processing")

    pause_samples = int(sample_rate * pause_seconds)
    pause = np.zeros(pause_samples, dtype=np.int16)
    combined_audio = combined_samples[0]
    for samples in combined_samples[1:]:
        combined_audio = np.concatenate([combined_audio, pause, samples])

    wav_buffer = BytesIO()
    scipy.io.wavfile.write(wav_buffer, sample_rate, combined_audio)
    wav_buffer.seek(0)
    return wav_buffer.getvalue()


def merge_wav_chunks_base64(chunks_base64: list[str], *, pause_seconds: float = 0.1) -> str:
    raw_chunks = [base64.b64decode(chunk) for chunk in chunks_base64]
    merged = merge_wav_chunks(raw_chunks, pause_seconds=pause_seconds)
    return base64.b64encode(merged).decode("ascii")
