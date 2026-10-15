# ============================================================================
# F5-TTS Service (voice clone) — stack9 · MIT (SWivid/F5-TTS)
# Silero/qwen3-compatible HTTP API: /health, /synthesize, /voices
# Base: local ew_whisper_fast (CUDA 12.4 + PyTorch cu124) — avoids hub pull when
# nvidia/cuda:12.4.0-devel tag is not cached (IPv6/DNS issues on some hosts).
# ============================================================================
ARG F5_TTS_BASE_IMAGE=ew_whisper_fast:large-v3
FROM ${F5_TTS_BASE_IMAGE}

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

COPY main.py /app/main.py
COPY f5_tts_service.py /app/f5_tts_service.py

RUN mkdir -p /app/voices && chown -R 1000:1000 /app/main.py /app/f5_tts_service.py /app/requirements.txt /app/voices

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=0
ENV NVIDIA_VISIBLE_DEVICES=all
ENV CUDA_HOME=/usr/local/cuda
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
ENV HF_HOME=/app/.cache/huggingface
ENV F5_TTS_MODEL=F5TTS_v1_Base
ENV F5_TTS_CKPT_FILE=hf://Misha24-10/F5-TTS_RUSSIAN/F5TTS_v1_Base_v2/model_last_inference.safetensors
ENV F5_TTS_VOCAB_FILE=hf://Misha24-10/F5-TTS_RUSSIAN/F5TTS_v1_Base/vocab.txt
ENV F5_TTS_NFE_STEP=24
ENV F5_TTS_DEVICE=cuda:0
ENV F5_TTS_NFE_STEP=16

HEALTHCHECK --interval=30s --timeout=15s --start-period=420s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["python3", "main.py"]
