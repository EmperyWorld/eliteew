# syntax=docker/dockerfile:1.7
############################
# EliteEW stack0 backend images
# Build context: docker/builders/stack0-api
############################
ARG FEDORA_IMAGE=docker.io/library/fedora:44@sha256:43b29f65a41eb9c35e1cd5323e3bdf3b655c2357a9f4f1ff2f9c2798e5045d80
ARG UV_VERSION=0.12.8

############################
# Stage: builder-base
############################
FROM ${FEDORA_IMAGE} AS builder-base
ARG UV_VERSION
ARG BUILD_JOBS=1

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    UV_INDEX_STRATEGY="unsafe-best-match" \
    UV_HTTP_TIMEOUT=1800 \
    PATH="/usr/local/bin:/uvbin:/opt/venv/bin:$PATH" \
    MAKEFLAGS="-j${BUILD_JOBS}" \
    CMAKE_BUILD_PARALLEL_LEVEL="${BUILD_JOBS}"

# Official Fedora tree only. download.fedoraproject.org redirects to volunteer mirrors.
COPY fedora-dnf-official-repos.sh /tmp/fedora-dnf-official-repos.sh
RUN bash /tmp/fedora-dnf-official-repos.sh \
    && dnf update -y --refresh && \
    dnf upgrade -y --setopt=install_weak_deps=False \
    && dnf install -y --setopt=install_weak_deps=False \
    gcc gcc-c++ make cmake git wget curl python3-devel libpq-devel \
    libffi-devel openssl-devel zlib-devel python3-pip \
    && dnf clean all

RUN python3 -m pip install --break-system-packages "uv==${UV_VERSION}" \
    && install -d /uvbin \
    && ln -sf "$(command -v uv)" /uvbin/uv

RUN uv venv /opt/venv

COPY requirements.txt constraints.txt ./
COPY requirements/ ./requirements/

############################
# Python dependency bundles
############################
FROM builder-base AS deps-api
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --no-cache \
      --python /opt/venv/bin/python \
      -c constraints.txt \
      -c requirements/locks/api.lock \
      -r requirements/api.in


FROM deps-api AS deps-queue-worker
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --no-cache \
      -c constraints.txt \
      -c requirements/locks/queue-worker.lock \
      -r requirements/queue-worker.in

FROM builder-base AS deps-site-studio-worker
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --no-cache \
      -c constraints.txt \
      -c requirements/locks/site-studio-worker.lock \
      -r requirements/site-studio-worker.in

############################
# Runtime base
############################
FROM ${FEDORA_IMAGE} AS runtime-base
ARG BUILD_JOBS=1

WORKDIR /app

ENV TZ=Asia/Vladivostok \
    PYTHONUNBUFFERED=1 \
    PYTHON_JIT=1 \
    PATH="/usr/local/bin:/opt/venv/bin:$PATH" \
    MAKEFLAGS="-j${BUILD_JOBS}" \
    CMAKE_BUILD_PARALLEL_LEVEL="${BUILD_JOBS}" \
    PLAYWRIGHT_BROWSERS_PATH=/app/playwright-browsers

COPY fedora-dnf-official-repos.sh /tmp/fedora-dnf-official-repos.sh
RUN bash /tmp/fedora-dnf-official-repos.sh \
    && dnf upgrade -y --setopt=install_weak_deps=False --skip-unavailable \
    --disablerepo=fedora-cisco-openh264 \
    && dnf install -y --setopt=install_weak_deps=False --skip-unavailable \
    --disablerepo=fedora-cisco-openh264 \
    python3 curl procps-ng libpq libicu \
    && dnf clean all \
    && ln -fs /usr/share/zoneinfo/"$TZ" /etc/localtime

RUN bash -lc 'getent passwd 1000 >/dev/null || echo "stack0-runtime:x:1000:1000::/tmp:/bin/sh" >> /etc/passwd; getent group 1000 >/dev/null || echo "stack0-runtime:x:1000:" >> /group'

RUN mkdir -p /app/models /app/generated_files /app/playwright-browsers /app/docker/scripts /app/smoke \
    && chmod -R 777 /app/models /app/generated_files /app/playwright-browsers

COPY scripts/start_all.sh /app/docker/scripts/start_all.sh
COPY scripts/lib/ /app/docker/scripts/lib/
COPY scripts/smoke_queue_worker_boot.py /app/smoke/smoke_queue_worker_boot.py
# Layer A RabbitMQ queue-worker health only — not Celery; see documentation/platform/docker-re_doc/STACK0-HEALTHCHECK-LAYERS.md
RUN chmod 755 /app/docker/scripts/start_all.sh /app/docker/scripts/lib/*.py

############################
# Runtime docs / browser tooling
############################
FROM runtime-base AS runtime-docs-browser

RUN dnf install -y --setopt=install_weak_deps=False --skip-unavailable \
    --disablerepo=fedora-cisco-openh264 \
    ffmpeg tesseract tesseract-langpack-rus tesseract-langpack-eng \
    poppler-utils ghostscript libreoffice-core ImageMagick java-openjdk \
    alsa-lib atk at-spi2-atk cups-libs dbus-libs expat \
    libX11 libXcomposite libXdamage libXext libXfixes libXrandr \
    libgbm libXScrnSaver libxkbcommon pango cairo mesa-libgbm nss nss-util nspr \
    && dnf clean all

############################
# Target: eliteew-api-prod
############################
FROM runtime-docs-browser AS api
ARG BUILD_LOCK_HASH=unknown
# OpenSSH client: Air enrollment edge control (forced-command SSH via Meet WG).
# Celery/site-studio already ship openssh-clients; API create/reveal path needs it too.
# Fail closed: --skip-unavailable would ship an image that logs edge_ssh_missing.
RUN dnf install -y --setopt=install_weak_deps=False \
    --disablerepo=fedora-cisco-openh264 \
    openssh-clients \
    && test -x /usr/bin/ssh \
    && dnf clean all
COPY --from=deps-api /opt/venv /opt/venv
ENV BUILD_LOCK_HASH=${BUILD_LOCK_HASH}
LABEL org.eliteew.build.lock_hash="${BUILD_LOCK_HASH}"
EXPOSE 8000
CMD ["/bin/bash", "-lc", "exec /app/docker/scripts/start_all.sh"]

############################
# Target: RabbitMQ general queue worker
############################
FROM runtime-docs-browser AS queue-worker
COPY --from=deps-queue-worker /opt/venv /opt/venv
COPY scripts/start_queue_worker.sh /app/docker/scripts/start_queue_worker.sh
RUN playwright install chromium \
    && chmod 755 /app/docker/scripts/start_queue_worker.sh
EXPOSE 8095 8096
CMD ["/bin/bash", "-lc", "exec /app/docker/scripts/start_queue_worker.sh"]

FROM queue-worker AS api-worker

############################
# Celery executor
############################
FROM runtime-base AS celery-worker
ARG BUILD_LOCK_HASH=unknown
COPY --from=deps-api /opt/venv /opt/venv
RUN dnf install -y --setopt=install_weak_deps=False --skip-unavailable \
    --disablerepo=fedora-cisco-openh264 \
    ffmpeg openssh-clients \
    && dnf clean all
ENV BUILD_LOCK_HASH=${BUILD_LOCK_HASH}
LABEL org.eliteew.build.lock_hash="${BUILD_LOCK_HASH}"
CMD ["python", "-m", "celery", "-A", "api.tasks.celery_app", "worker", "--loglevel=info", "--concurrency=4", "--hostname=worker@%h", "--max-tasks-per-child=100", "--time-limit=300", "--soft-time-limit=240"]

############################
# Celery beat — same venv as API (autodiscover imports full api.tasks graph).
############################
FROM runtime-base AS celery-beat
ARG BUILD_LOCK_HASH=unknown
COPY --from=deps-api /opt/venv /opt/venv
ENV BUILD_LOCK_HASH=${BUILD_LOCK_HASH}
LABEL org.eliteew.build.lock_hash="${BUILD_LOCK_HASH}"
CMD ["python", "-m", "celery", "-A", "api.tasks.celery_app", "beat", "--loglevel=info", "--pidfile=/tmp/celerybeat.pid"]

############################
# Site Studio RabbitMQ worker
############################
FROM runtime-base AS site-studio-worker
COPY --from=deps-site-studio-worker /opt/venv /opt/venv
# Podman-only control plane for Site Studio runtime orchestration.
# openssh-clients + rsync: Edge Carrier build/transfer (site-edge-carrier-deploy.sh → .10).
# XDG_CONFIG_HOME: Podman client config home. Compose sets HOME=/home/owned for Carrier
# SSH (~/.ssh bind); do not use that HOME for containers.conf (host ~/.config is not mounted).
ENV XDG_CONFIG_HOME=/var/lib/eliteew/xdg-config
RUN dnf install -y --setopt=install_weak_deps=False --skip-unavailable \
    --disablerepo=fedora-cisco-openh264 \
    podman podman-compose \
    openssh-clients \
    rsync \
    && mkdir -p /var/lib/eliteew/xdg-config \
    && chown 1000:1000 /var/lib/eliteew/xdg-config \
    && dnf clean all
CMD ["python", "-m", "api.workers.queue_worker"]

FROM api AS production
