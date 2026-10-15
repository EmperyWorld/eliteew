# ============================================================================
# CosyVoice3 Service (zero-shot voice clone) — stack9 · Apache-2.0
# HTTP API: /health, /synthesize, /voices (f5/qwen3-compatible contract)
# ============================================================================
FROM docker.io/nvidia/cuda:12.4.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    software-properties-common \
    tzdata \
    git \
    curl \
    sox \
    libsox-dev \
    libsndfile1 \
    ffmpeg \
    build-essential \
    gcc g++ \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && add-apt-repository ppa:deadsnakes/ppa -y \
    && apt-get update && \
    apt-get install -y --no-install-recommends \
    python3.10 \
    python3.10-dev \
    python3.10-venv \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.10 && \
    python3.10 -m pip install --upgrade setuptools wheel

RUN ln -sf /usr/bin/python3.10 /usr/bin/python3 && \
    ln -sf /usr/bin/python3.10 /usr/bin/python

ARG COSYVOICE_GIT_REF=main
RUN git clone --depth 1 --branch "${COSYVOICE_GIT_REF}" --recursive \
    https://github.com/FunAudioLLM/CosyVoice.git /opt/CosyVoice

WORKDIR /opt/CosyVoice

COPY cosyvoice-deps.txt /tmp/cosyvoice-deps.txt

# lightning/pytorch-lightning pin torch 2.3.x — reinstall cu124 pair after all CosyVoice deps.
RUN pip3 install --no-cache-dir --break-system-packages \
    torch==2.4.0+cu124 torchaudio==2.4.0+cu124 --index-url https://download.pytorch.org/whl/cu124 && \
    pip3 install --no-cache-dir --break-system-packages -r /tmp/cosyvoice-deps.txt && \
    pip3 install --no-cache-dir --break-system-packages --force-reinstall \
    torch==2.4.0+cu124 torchaudio==2.4.0+cu124 --index-url https://download.pytorch.org/whl/cu124 && \
    pip3 install --no-cache-dir --break-system-packages \
    fastapi==0.115.6 uvicorn==0.30.0 pydantic==2.7.0 grpcio==1.57.0 gdown==5.1.0 rich==13.7.1 && \
    pip3 install --no-cache-dir --break-system-packages setuptools==69.5.1 && \
    pip3 install --no-cache-dir --break-system-packages openai-whisper==20231117 --no-build-isolation --no-deps && \
    pip3 install --no-cache-dir --break-system-packages tiktoken

WORKDIR /app

COPY requirements.txt /app/requirements.txt
COPY main.py /app/main.py
COPY cosyvoice3_service.py /app/cosyvoice3_service.py

RUN pip3 install --no-cache-dir --break-system-packages -r /app/requirements.txt

# openai-whisper/lightning pull torch 2.3.x — final pin must be last pip step.
RUN pip3 install --no-cache-dir --break-system-packages --force-reinstall --no-deps \
    torch==2.4.0+cu124 torchaudio==2.4.0+cu124 \
    nvidia-cudnn-cu12==9.1.0.70 nvidia-cublas-cu12==12.4.2.65 \
    nvidia-cuda-runtime-cu12==12.4.99 nvidia-cuda-nvrtc-cu12==12.4.99 \
    nvidia-cufft-cu12==11.2.0.44 nvidia-curand-cu12==10.3.5.119 \
    nvidia-cusolver-cu12==11.6.0.99 nvidia-cusparse-cu12==12.3.0.142 \
    nvidia-nccl-cu12==2.20.5 nvidia-nvtx-cu12==12.4.99 \
    nvidia-cuda-cupti-cu12==12.4.99 nvidia-nvjitlink-cu12==12.4.99 triton==3.0.0 \
    --index-url https://download.pytorch.org/whl/cu124

RUN groupadd -r --gid 1000 app && useradd -r --uid 1000 -g app -d /app app && \
    mkdir -p /app/models /app/.cache /app/voices && \
    chown -R 1000:1000 /app /opt/CosyVoice

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=0
ENV NVIDIA_VISIBLE_DEVICES=all
ENV CUDA_HOME=/usr/local/cuda
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
ENV HF_HOME=/app/.cache/huggingface
ENV COSYVOICE_ROOT=/opt/CosyVoice
ENV COSYVOICE_MODEL_DIR=/app/models/Fun-CosyVoice3-0.5B
ENV COSYVOICE_MODEL_ID=FunAudioLLM/Fun-CosyVoice3-0.5B-2512
ENV COSYVOICE_DEVICE=cuda:0
ENV PYTHONPATH=/opt/CosyVoice:/opt/CosyVoice/third_party/Matcha-TTS

HEALTHCHECK --interval=30s --timeout=15s --start-period=600s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["python3", "main.py"]
