# Host assets and machine operations

This tree contains host-side workflows, runtime data locations and policy inputs. The product API/SPA live under [shared](../shared/README.md); Android and organization entrances have their own packs. Host placement and running processes are maintained in [topology state](../documentation/platform/PRODUCTION-TOPOLOGY-STATE.md).

- [comfyui/](comfyui/) contains workflow inputs and supporting generation tools. These files are distinct from the ComfyUI service process.
- `generated_files/` and `runtime/` are local/runtime data locations used by stack0 and Site Studio binds. They may not exist in a fresh checkout and are not source packages.
- [kernel-offline/](kernel-offline/) owns the mount-policy input consumed by the [shared offline-policy package](../shared/packages/kernel-offline-policy/README.md).
- [ops/](ops/) contains NVIDIA fan control, Xauthority setup, boot reset-reason logging and systemd units. The installers mutate machine configuration and can require root/SSH access; inspect the selected installer and target before an authorized host change.

[Deploy-tree synchronization](../docker/scripts/sync-prod-core-deploy-tree.sh) and [stack0 compose](../docker/stack/stack0_b.yml) determine transferred/bound paths. Baked and dev-bind overrides affect packaging. No host installer, sync or GPU control command was executed during the documentation audit.

[Pack layout](../documentation/platform/ELITEEW-PACK-LAYOUT.md) defines ownership. The retired `EliteEW/` alias is not a source-tree entry point; the developer virtual environment is rooted at the monorepository `.venv` when configured locally.
