# EliteEW cloud browser SPA — static from edge disk; API/Socket.IO via WG → prod-core :29000.
# Included from app.eliteew.ru server block (see nginx-app-https-*-cloud-spa.conf).
#
# Release root: /srv/eliteew/cloud-spa/current (symlink → releases/<deploy_id>/, slim tree)
# Media root:   /srv/eliteew/cloud-spa/media/ (long-lived public/ prefixes — deploy-cloud-spa-to-edge.sh)
# CSP/snippets: /etc/nginx/eliteew/cloud-spa/ (deploy-cloud-spa-to-edge.sh)
#
# Paths still proxied to prod-core frontend (:29001): host-volume OTA, auth-proxy fallback.

root /srv/eliteew/cloud-spa/current;
index index.html;

gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

# --- Backhaul: API + realtime (stack0 API :29000) ---
location ^~ /api/ {
    proxy_pass http://eliteew_sites_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Authorization $http_authorization;
    proxy_cache_bypass $http_upgrade;
    proxy_buffering off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    client_max_body_size 100M;
}

location ^~ /socket.io/ {
    proxy_pass http://eliteew_sites_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_cache_bypass $http_upgrade;
    proxy_buffering off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}

# Host aliases on prod-core frontend container (not in dist-build).
location ^~ /desktop-client-updates/ {
    proxy_pass http://eliteew_app_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
}

location ^~ /fofline-updates/ {
    proxy_pass http://eliteew_app_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
}

# EmpiierOS capsule OTA edge (RO+tmpfs on prod-core :29181 via WG backhaul).
# NOT eliteew_app_upstream / NOT fofline-updates volume. Strip /empiieros-ota prefix.
location ^~ /empiieros-ota/ {
    proxy_pass http://eliteew_empiieros_ota_upstream/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 900s;
    proxy_send_timeout 900s;
    client_max_body_size 2m;
}

location ~ ^/auth-proxy/(.*)$ {
    proxy_pass http://eliteew_auth_upstream/$1$is_args$args;
    proxy_http_version 1.1;
    proxy_set_header Host auth.eliteew.ru;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Prefix /auth-proxy;
    proxy_set_header X-Forwarded-Port 443;
    proxy_buffering off;
}

# --- Version / maintenance (no-cache; must match prod-core deploy_id) ---
location = /app-build-version.txt {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri =404;
}

location = /maintenance-state.json {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri =404;
}

location = /maintenance.html {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    add_header Cache-Control "no-store" always;
    add_header Retry-After "60" always;
    try_files $uri =404;
}

location = /index.html {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri =404;
}

location = /fofline-oidc-bridge.html {
    access_log off;
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Cache-Control "no-store" always;
    add_header Content-Security-Policy "default-src 'none'; script-src 'sha256-p1ACBByB+igNHJPYOrmLXbRCVEtqM6cR0wpHU54V3fU='; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
    try_files $uri =404;
}

# --- Mobile standalone page (in dist-build) ---
location = /download/empery-mobile.apk {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    return 302 https://app.eliteew.ru/mobile-app/;
}

location = /mobile-app {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    return 301 /mobile-app/;
}

location /mobile-app/ {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    try_files $uri $uri/ /mobile-app/index.html;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
}

location = /mobile-app-download-redirect.html {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    return 302 https://app.eliteew.ru/mobile-app/;
}

# --- Hashed static (immutable) ---
location ^~ /assets/ {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable" always;
    access_log off;
}

location ~* \.(js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|map|wasm)$ {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable" always;
    access_log off;
}

# Public prefix trees from shared media layer (not duplicated in release/<deploy_id>/).
location ^~ /o-proekte/ {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    root /srv/eliteew/cloud-spa/media;
    try_files $uri $uri/ =404;
}

location ^~ /audio/ {
    root /srv/eliteew/cloud-spa/media;
    try_files $uri =404;
    access_log off;
}

location ^~ /ewa/ {
    root /srv/eliteew/cloud-spa/media;
    try_files $uri =404;
    access_log off;
}

location ^~ /desktop-wallpapers/ {
    root /srv/eliteew/cloud-spa/media;
    try_files $uri =404;
    access_log off;
}

location ^~ /avatars/ {
    root /srv/eliteew/cloud-spa/media;
    try_files $uri =404;
    access_log off;
}

location ^~ /site-studio-template-assets/ {
    root /srv/eliteew/cloud-spa/media;
    try_files $uri =404;
    access_log off;
}

location ^~ /music-evolution/ {
    root /srv/eliteew/cloud-spa/media;
    try_files $uri =404;
    access_log off;
}

location ^~ /fonts/ {
    root /srv/eliteew/cloud-spa/media;
    try_files $uri =404;
    access_log off;
}

location /health {
    access_log off;
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    add_header Content-Type text/plain;
    return 200 "healthy\n";
}

# SPA fallback (hash routes only; missing assets must 404 above).
location / {
    include /etc/nginx/eliteew/cloud-spa/snippets/eliteew-security-headers-base.conf;
    include /etc/nginx/eliteew/cloud-spa/csp.conf;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    try_files $uri $uri/ /index.html;
}
