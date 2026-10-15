# ============================================================================
# Qwen3-TTS Service (Base voice clone) — stack9
# Silero-compatible HTTP API: /health, /synthesize, /voices
# ============================================================================
FROM docker.io/nvidia/cuda:12.4.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    software-properties-common \
    tzdata \
    libsndfile1 \
    curl \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && add-apt-repository ppa:deadsnakes/ppa -y \
    && apt-get update && \
    apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-dev \
    build-essential \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.12 && \
    python3.12 -m pip install --upgrade setuptools wheel

RUN ln -sf /usr/bin/python3.12 /usr/bin/python3 && \
    ln -sf /usr/bin/python3.12 /usr/bin/python

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN pip3 install --no-cache-dir --break-system-packages \
    torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

COPY main.py /app/main.py
COPY qwen3_tts_service.py /app/qwen3_tts_service.py

RUN groupadd -r --gid 1000 app && useradd -r --uid 1000 -g app -d /app app && \
    mkdir -p /app/models /app/.cache /app/voices && chown -R 1000:1000 /app

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=0
ENV NVIDIA_VISIBLE_DEVICES=all
ENV CUDA_HOME=/usr/local/cuda
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
ENV HF_HOME=/app/.cache/huggingface
ENV MODELSCOPE_CACHE=/app/.cache/modelscope

HEALTHCHECK --interval=30s --timeout=15s --start-period=600s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["python3", "main.py"]
