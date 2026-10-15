# EliteEW meet.eliteew.ru — HTTP locations (include inside server { }).
#
# Before include set upstream, e.g.:
#   set $meet_jitsi_upstream http://127.0.0.1:13402;   # Yandex tunnel → punisher Jitsi web
#   set $meet_jitsi_upstream http://127.0.0.1:34002;   # LAN / offline direct stack11
#
# UI shell: only with ?jwt= from API or trusted embed (app / meet referer / WebView UA).
# config.js + static + colibri/xmpp: open at nginx; Prosody still requires API JWT for rooms.

location = /config.js {
    proxy_pass $meet_jitsi_upstream;
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

location ~ ^/(libs|css|static|images|fonts|lang|sounds)/ {
    proxy_pass $meet_jitsi_upstream;
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

location ~ ^/(xmpp-websocket|http-bind|colibri-ws) {
    proxy_pass $meet_jitsi_upstream;
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

location / {
    set $meet_gate_deny 1;
    if ($arg_jwt != "") {
        set $meet_gate_deny 0;
    }
    if ($http_referer ~* "^https://app\.empery\.world/") {
        set $meet_gate_deny 0;
    }
    if ($http_referer ~* "[?&]jwt=") {
        set $meet_gate_deny 0;
    }
    if ($http_origin = "https://meet.eliteew.ru") {
        set $meet_gate_deny 0;
    }
    if ($http_origin = "https://app.eliteew.ru") {
        set $meet_gate_deny 0;
    }
    if ($http_user_agent ~* "EmperyWorldAndroidWebView") {
        set $meet_gate_deny 0;
    }
    if ($remote_addr = "127.0.0.1") {
        set $meet_gate_deny 0;
    }
    if ($meet_gate_deny = 1) {
        return 403;
    }

    proxy_pass $meet_jitsi_upstream;
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
