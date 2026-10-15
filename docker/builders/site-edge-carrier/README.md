# Site-Edge Carrier builder (static Site-Image)

Immutable `nginx-unprivileged` alpine image with baked HTML/JS/assets.

**Canon:** `documentation/platform/SITE-EDGE-CARRIER.md`

## Cross-link

| Tree | Role |
|------|------|
| **`docker/builders/site-edge-carrier/`** (this dir) | Dockerfile + content stage for Site-Image |
| **`docker/scripts/site-edge-carrier-deploy.sh`** | Build → transfer → `podman run` on Edge |
| **`docker/site-edge-iot/`** | Fedora IoT flash (OS) for the same Edge-Node |
| **`docker/scripts/site-edge-iot-provision.sh`** / **`site-edge-iot-verify.sh`** | Flash + verify CLIs |

```bash
# Stage content, then build (or use deploy script):
rsync -a --delete /path/to/site/dist/ docker/builders/site-edge-carrier/content/
podman build --format docker -t local/site-edge/demo:latest docker/builders/site-edge-carrier

# Full Build → Transfer → Deploy:
bash docker/scripts/site-edge-carrier-deploy.sh \
  --slug demo \
  --content-dir /path/to/site/dist \
  --yes
```

Edge OS flash (Fedora IoT): `docker/site-edge-iot/` + `docker/scripts/site-edge-iot-provision.sh`.
