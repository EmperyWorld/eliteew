FROM docker.io/library/node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY scripts ./scripts
COPY nginx ./nginx
COPY Dockerfile ./Dockerfile
COPY logo_empery.png og-landing.png og-landing-ru.png ./
COPY dist ./dist
RUN npm run build

FROM docker.io/nginxinc/nginx-unprivileged:1.29-alpine
USER root
RUN rm -f /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
