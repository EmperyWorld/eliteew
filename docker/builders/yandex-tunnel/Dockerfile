# EliteEW · Empery World — образ SSH reverse tunnel (autossh) к VM в Yandex Cloud
# Сборка из корня монорепозитория; entrypoint см. docker/scripts/yandex-tunnel/yandex-tunnel-entrypoint.sh
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        openssh-client \
        autossh \
        connect-proxy \
        socat \
    && rm -rf /var/lib/apt/lists/*

COPY docker/scripts/yandex-tunnel/yandex-tunnel-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
