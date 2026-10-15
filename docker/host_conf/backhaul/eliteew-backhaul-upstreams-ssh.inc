# EliteEW backhaul RESERVE — SSH -R listeners on edge loopback.
# Installed on edge as /etc/nginx/conf.d/eliteew-backhaul-upstreams.inc
upstream eliteew_app_upstream {
    server 127.0.0.1:29001;
    keepalive 32;
}
upstream eliteew_api_upstream {
    server 127.0.0.1:29000;
    keepalive 8;
}
upstream eliteew_sites_upstream {
    server 127.0.0.1:29000;
    keepalive 16;
}
upstream eliteew_landing_upstream {
    server 127.0.0.1:29002;
    keepalive 8;
}
upstream eliteew_auth_upstream {
    server 127.0.0.1:36000;
    keepalive 16;
}
upstream eliteew_meet_upstream {
    server 127.0.0.1:13402;
    keepalive 16;
}
# EmpiierOS capsule OTA — SSH reserve loopback (needs matching -R :29181); WG is primary.
upstream eliteew_empiieros_ota_upstream {
    server 127.0.0.1:29181;
    keepalive 8;
}
# power/dewa upstreams removed — soft-retired; edge vhosts return 410.
# Mobile OTA remains prod-core :29180 (not an edge hostname).
