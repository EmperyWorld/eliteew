# Host nginx — LAN/offline monolith (`conf.d`)

Single-file **host** nginx for offline / LAN `*.eliteew.ru` TLS termination.
Not mounted into containers — copy onto the host.

**Canon:** `documentation/platform/docker-re_doc/DOCKER-DIR-STRUCTURE.md` §conf.d  
**Pair:** modular edge configs live in `docker/host_conf/` (mkcert ↔ LE twins). Prefer **one** layout per host — do not maintain both blindly.

| File | Role |
|------|------|
| `offline-empery.conf` | Monolithic server blocks (HTTP→HTTPS, app/auth/meet/sites) |

```bash
sudo cp docker/conf.d/offline-empery.conf /etc/nginx/conf.d/
sudo nginx -t && sudo systemctl reload nginx
```

Place `fullchain.pem` / `privkey.pem` at the paths declared in the conf (see comments in-file).
