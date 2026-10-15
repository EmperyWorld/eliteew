# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Immutable static Site-Image for LAN Edge (Celeron): nginx-unprivileged alpine + baked content.
# Invariants:
# - Build only on Heavy-Node (command-center); never compile on Edge.
# - Content is staged into ./content before podman build (see site-edge-carrier-deploy.sh).
# Related:
# - documentation/platform/SITE-EDGE-CARRIER.md
# - docker/scripts/site-edge-carrier-deploy.sh
# ---
FROM docker.io/nginxinc/nginx-unprivileged:1.29-alpine

USER root
RUN rm -f /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf
COPY content/ /usr/share/nginx/html/

USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
