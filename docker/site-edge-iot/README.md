# Fedora IoT Site-Edge (Ignition)

OS flash / first-boot for the **LAN Celeron Edge-Node** that later runs Site-Edge Carrier containers.

**Canon:** `documentation/platform/SITE-EDGE-CARRIER.md` §Part 3 (+ §map in this repo’s `docker/README.md`).

## Cross-link (one product, three trees)

| Tree | Role |
|------|------|
| **`docker/site-edge-iot/`** (this dir) | Fedora IoT Butane/Ignition + local provision/verify wrappers |
| **`docker/builders/site-edge-carrier/`** | Immutable `nginx-unprivileged` Site-Image Dockerfile |
| **`docker/scripts/site-edge-*.sh`** | Operator CLIs: carrier deploy, IoT provision, IoT verify |

## Files here

| Path | Role |
|------|------|
| `edge-node.bu` | Butane source (author) |
| `config.ign` | Example Ignition (placeholder SSH — regenerate via provision) |
| `network.env.example` / `ssh_authorized_keys.example` | Flash inputs |
| `files/` / `systemd/` | Embedded unit/content fragments |
| `provision_edge_node.sh` / `verify-edge-node.sh` | Thin local wrappers |

## Prefer (from repo root)

```bash
bash docker/scripts/site-edge-iot-provision.sh …
bash docker/scripts/site-edge-iot-verify.sh --host <edge-ip>
bash docker/scripts/site-edge-carrier-deploy.sh --slug <site> --content-dir <dist> --yes
```
