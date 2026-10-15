###############################################################################
# EliteEW Frontend - Fedora 44 + Nginx (runtime only)
#
# Этот образ НЕ собирает фронт внутри контейнера.
# Сборка делается на хосте (pnpm build → dist-build), как и раньше.
# Контейнер только отдаёт статические файлы через nginx на Fedora 44.
#
# Сборка из корня репо:
#   docker build -f docker/builders/stack0-frontend/Dockerfile -t eliteew-frontend-fedora:latest .
###############################################################################

FROM fedora:44@sha256:43b29f65a41eb9c35e1cd5323e3bdf3b655c2357a9f4f1ff2f9c2798e5045d80

LABEL maintainer="Empery World DevOps"
LABEL description="EliteEW Frontend - Fedora 44 + Nginx (static SPA)"
LABEL version="1.0.5"

ENV TZ=Asia/Vladivostok

# Official Fedora tree only (dl.fedoraproject.org). No MirrorManager mirrors.
COPY docker/builders/stack0-api/fedora-dnf-official-repos.sh /tmp/fedora-dnf-official-repos.sh
RUN bash /tmp/fedora-dnf-official-repos.sh \
  && for i in 1 2 3; do dnf -y upgrade --refresh && break || sleep 15; done \
  && for i in 1 2 3; do dnf -y install --setopt=install_weak_deps=False \
    nginx tzdata ca-certificates curl \
    && break || sleep 15; done \
  && dnf -y clean all \
  && ln -fs /usr/share/zoneinfo/"$TZ" /etc/localtime

# CSP: entrypoint генерирует /var/lib/nginx/csp/csp.conf (include в eliteew-security-headers.conf)
COPY docker/builders/stack0-frontend/docker-entrypoint-csp.sh /docker-entrypoint-csp.sh
RUN chmod +x /docker-entrypoint-csp.sh

# Шаблон server {} из compose монтируется в /srv; до старта entrypoint копирует его в writable runtime (+ CSI). Fallback bootstrap — HEALTHCHECK образа без compose.
COPY docker/builders/stack0-frontend/nginx-runtime-default-bootstrap.conf /var/lib/nginx/runtime/default.conf
COPY docker/builders/stack0-frontend/nginx-conf.d-include-runtime-default.conf /etc/nginx/conf.d/00-eliteew-runtime-default.conf

# Непривилегированный пользователь 1000:1000 (совместим с хостом)
RUN groupadd -r --gid 1000 app && \
    useradd -r --uid 1000 -g app -d /app app && \
    mkdir -p /var/lib/nginx/tmp/client_body /var/log/nginx /var/lib/nginx/csp && \
    touch /run/nginx.pid && \
    chown -R app:app /var/lib/nginx /var/log/nginx /run/nginx.pid

WORKDIR /usr/share/nginx/html

EXPOSE 8080

# Здоровье: как в docker/stack/stack0_f.yml (HTTP 200 на /), а не только pgrep nginx
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD curl -sf http://127.0.0.1:8080/ -o /dev/null || exit 1

# Логирование FEC: см. nginx.prod.conf (CSI «\u{1b}»), docker-entrypoint-csp.sh (/srv шаблон → /var/lib/nginx/runtime), tail access-docker.log в stderr.

USER 1000:1000

ENTRYPOINT ["/docker-entrypoint-csp.sh"]
CMD ["nginx", "-g", "daemon off;"]
