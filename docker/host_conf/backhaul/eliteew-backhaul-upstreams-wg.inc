# EliteEW backhaul PRIMARY — WireGuard mesh 10.77.77.2 (prod-core proxies).
# Installed on edge as /etc/nginx/conf.d/eliteew-backhaul-upstreams.inc
upstream eliteew_app_upstream {
    server 10.77.77.2:29001;
    keepalive 32;
}
upstream eliteew_api_upstream {
    server 10.77.77.2:29000;
    keepalive 8;
}
upstream eliteew_sites_upstream {
    server 10.77.77.2:29000;
    keepalive 16;
}
upstream eliteew_landing_upstream {
    server 10.77.77.2:29002;
    keepalive 8;
}
upstream eliteew_auth_upstream {
    server 10.77.77.2:36000;
    keepalive 16;
}
upstream eliteew_meet_upstream {
    server 10.77.77.2:13402;
    keepalive 16;
}
# EmpiierOS capsule OTA — prod-core stack-empiieros-ota (RO+tmpfs), not Mobile :29180.
upstream eliteew_empiieros_ota_upstream {
    server 10.77.77.2:29181;
    keepalive 8;
}
# power/dewa upstreams removed — soft-retired; edge vhosts return 410.
# Mobile OTA remains prod-core :29180 (not an edge hostname).
