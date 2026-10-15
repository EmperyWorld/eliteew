EliteEW command-center golden image (192.168.1.136)

1. Change the initial account password immediately: passwd owned. Obtain bootstrap credentials through the authorized installation process; do not publish them in documentation.
2. First boot runs: eliteew-cc-firstboot.service (NVIDIA akmod, tuned, harden)
3. Reboot once if akmods built a new kernel module for RTX 5060 Ti
4. Clone monorepo to <repo>
5. Run: bash .vscode/preflight-check.sh
6. Optional full harden from git:
   sudo bash docker/scripts/command-center/harden-command-center-host.sh
7. Smoke: bash docker/scripts/eliteew-command-center.sh smoke

Do NOT enable prod-core podman autostart on this host.
ComfyUI after migration: gpu141 :31003 (not this machine).

Image metadata: /etc/eliteew/command-center-image.json
