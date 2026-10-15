# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin CUDA runtime for command-center ComfyUI (:31003). Source tree +
# persistent venv are bind-mounted by docker/scripts/start-comfyui-clean.sh.
# Invariants:
# - Python 3.10 (matches .container-venv / torch 2.10.0+cu130).
# - uid 1000 user `comfy` for runuser drop in start script.
# Related:
# - documentation/platform/docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md
# - docker/scripts/start-comfyui-clean.sh
# ---
FROM docker.io/nvidia/cuda:13.0.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3.10 \
        python3.10-venv \
        python3-pip \
        bash \
        ca-certificates \
        curl \
        git \
        libgl1 \
        libglib2.0-0 \
        libx11-6 \
        libxext6 \
        libxrender1 \
        util-linux \
        passwd \
    && ln -sf python3.10 /usr/bin/python3 \
    && ln -sf python3.10 /usr/bin/python \
    && useradd -m -u 1000 -s /bin/bash comfy \
    && mkdir -p /home/comfy/venv /opt/ComfyUI \
    && chown -R comfy:comfy /home/comfy \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/ComfyUI
USER root
CMD ["bash"]
