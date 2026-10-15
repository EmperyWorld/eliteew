# ============================================================================
# Silero TTS Service - Синтез речи (русский)
# Используем базовый CUDA образ и устанавливаем PyTorch вручную
FROM docker.io/nvidia/cuda:12.4.0-devel-ubuntu22.04

# Устанавливаем Python 3.12 через deadsnakes PPA и зависимости
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    software-properties-common \
    tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && add-apt-repository ppa:deadsnakes/ppa -y \
    && apt-get update && \
    apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-dev \
    build-essential \
    gcc g++ \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем pip и setuptools для Python 3.12
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.12 && \
    python3.12 -m pip install --upgrade setuptools wheel

# Создаем симлинк для python3
RUN ln -sf /usr/bin/python3.12 /usr/bin/python3 && \
    ln -sf /usr/bin/python3.12 /usr/bin/python

# ============================================================================
# УСТАНОВКА PYTHON ЗАВИСИМОСТЕЙ
# ============================================================================
WORKDIR /app

# Копируем requirements
COPY requirements.txt /app/requirements.txt

# Установка PyTorch с CUDA поддержкой (CUDA 12.4)
# ⚠️ ВНИМАНИЕ: Первая сборка может занять 10-20 минут из-за размера PyTorch (2-3 GB)
RUN pip3 install --no-cache-dir --break-system-packages \
    torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# Установка остальных зависимостей
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# ============================================================================
# КОПИРОВАНИЕ КОДА СЕРВИСА
# ============================================================================
COPY main.py /app/main.py
COPY silero_service.py /app/silero_service.py
COPY voice_aliases.py /app/voice_aliases.py

# ============================================================================
# НЕПРИВИЛЕГИРОВАННЫЙ ПОЛЬЗОВАТЕЛЬ И ДИРЕКТОРИИ (соответствует хосту 1000:1000)
# ============================================================================
RUN groupadd -r --gid 1000 app && useradd -r --uid 1000 -g app -d /app app && \
    mkdir -p /app/models/silero /app/.cache && chown -R 1000:1000 /app

# ============================================================================
# ENVIRONMENT
# ============================================================================
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=0
ENV NVIDIA_VISIBLE_DEVICES=all
ENV CUDA_HOME=/usr/local/cuda
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

# ============================================================================
# HEALTHCHECK
# ============================================================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ============================================================================
# EXPOSE PORT
# ============================================================================
EXPOSE 8000

# ============================================================================
# START COMMAND
# ============================================================================
CMD ["python3", "main.py"]
