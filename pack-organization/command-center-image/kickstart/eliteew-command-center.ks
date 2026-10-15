# EliteEW command-center — Fedora Server 44 unattended kickstart
# WARNING: clearpart --all wipes the install disk. New CC SSD only.
# Payload on media: /run/install/repo/eliteew-cc-payload/ (mkksiso --add)
# Canon: documentation/platform/COMMAND-CENTER-GOLDEN-IMAGE.md

#version=F42

cdrom
repo --name=fedora --mirrorlist=https://mirrors.fedoraproject.org/metalink?repo=fedora-$releasever&arch=$basearch
repo --name=updates --mirrorlist=https://mirrors.fedoraproject.org/metalink?repo=updates-released-f$releasever&arch=$basearch

text
skipx
lang en_US.UTF-8
keyboard us
timezone Europe/Moscow --utc
network --bootproto=dhcp --device=link --activate --hostname=empery.world
firewall --enabled --service=ssh
selinux --enforcing
services --enabled=sshd,NetworkManager,chronyd

zerombr
clearpart --all --initlabel
autopart --type=lvm --encrypted

reboot

rootpw --lock
user --name=owned --groups=wheel --gecos="EliteEW Command Center" --password=eliteew-cc-change-me --plaintext

%packages
@core
@hardware-support
podman
buildah
skopeo
containernetworking-plugins
git
git-lfs
make
gcc
gcc-c++
kernel-devel
python3
python3-pip
chrony
firewalld
cockpit
rsync
curl
wget
jq
tar
gzip
unzip
zstd
bash-completion
htop
tuned
openssl
openssh-clients
# Dev gates (monorepo preflight)
shellcheck
ripgrep
fd-find
# NVIDIA: akmod built on first boot (5060 Ti); not on Server DVD.
%end

%post --nochroot --erroronfail --log=/mnt/sysimage/root/eliteew-cc-post.log
set -euo pipefail

SYSROOT=/mnt/sysimage
[[ -d "${SYSROOT}" ]] || { echo "missing ${SYSROOT}" >&2; exit 1; }

PAYLOAD=""
for cand in \
  /run/install/repo/eliteew-cc-payload \
  /mnt/install/repo/eliteew-cc-payload \
  /run/install/sources/mount-0000-cdrom/eliteew-cc-payload; do
  if [[ -f "${cand}/PAYLOAD_MARKER.txt" ]]; then
    PAYLOAD="${cand}"
    break
  fi
done
if [[ -z "${PAYLOAD}" ]]; then
  shopt -s nullglob
  for cand in /run/install/sources/mount-*/eliteew-cc-payload; do
    if [[ -f "${cand}/PAYLOAD_MARKER.txt" ]]; then
      PAYLOAD="${cand}"
      break
    fi
  done
fi
[[ -n "${PAYLOAD}" ]] || { echo "eliteew-cc-payload missing on media" >&2; exit 1; }

echo "Using payload: ${PAYLOAD}"

install -d -m 0755 "${SYSROOT}/opt/eliteew-cc"
install -d -m 0755 "${SYSROOT}/usr/local/bin"
install -d -m 0755 "${SYSROOT}/etc/eliteew"
install -d -m 0755 "${SYSROOT}/etc/systemd/system"

if [[ -f "${PAYLOAD}/opt-eliteew-cc/README-FIRST.txt" ]]; then
  install -m 0644 "${PAYLOAD}/opt-eliteew-cc/README-FIRST.txt" \
    "${SYSROOT}/opt/eliteew-cc/README-FIRST.txt"
fi
if [[ -f "${PAYLOAD}/usr-local-bin/eliteew-cc-firstboot" ]]; then
  install -m 0755 "${PAYLOAD}/usr-local-bin/eliteew-cc-firstboot" \
    "${SYSROOT}/usr/local/bin/eliteew-cc-firstboot"
fi
if [[ -f "${PAYLOAD}/systemd/eliteew-cc-firstboot.service" ]]; then
  install -m 0644 "${PAYLOAD}/systemd/eliteew-cc-firstboot.service" \
    "${SYSROOT}/etc/systemd/system/eliteew-cc-firstboot.service"
fi
if [[ -f "${PAYLOAD}/opt-eliteew-cc/harden-command-center-host.sh" ]]; then
  install -m 0755 "${PAYLOAD}/opt-eliteew-cc/harden-command-center-host.sh" \
    "${SYSROOT}/opt/eliteew-cc/harden-command-center-host.sh"
fi
if [[ -f "${PAYLOAD}/etc-eliteew/command-center-image.json" ]]; then
  install -m 0644 "${PAYLOAD}/etc-eliteew/command-center-image.json" \
    "${SYSROOT}/etc/eliteew/command-center-image.json"
fi

# SSH key for owned (optional, baked at ISO build time)
if [[ -f "${PAYLOAD}/home-owned-ssh/authorized_keys" ]]; then
  install -d -m 0700 "${SYSROOT}/home/owned/.ssh"
  install -m 0600 "${PAYLOAD}/home-owned-ssh/authorized_keys" \
    "${SYSROOT}/home/owned/.ssh/authorized_keys"
  chroot "${SYSROOT}" chown -R owned:owned /home/owned/.ssh
fi

# Btrfs subvolume for podman storage (when root is btrfs)
if chroot "${SYSROOT}" btrfs subvolume list / 2>/dev/null | rg -q 'path $'; then
  chroot "${SYSROOT}" mkdir -p /var/lib/containers
  if ! chroot "${SYSROOT}" btrfs subvolume show /var/lib/containers 2>/dev/null; then
    chroot "${SYSROOT}" btrfs subvolume create /var/lib/containers 2>/dev/null || true
  fi
fi

chroot "${SYSROOT}" systemctl enable eliteew-cc-firstboot.service
chroot "${SYSROOT}" systemctl enable cockpit.socket
chroot "${SYSROOT}" loginctl enable-linger owned 2>/dev/null || true

# Prod autostart must stay off on command-center
chroot "${SYSROOT}" mkdir -p /etc/systemd/system
cat >"${SYSROOT}/etc/systemd/system/eliteew-cc-no-prod-autostart.conf" <<'EOF'
# Marker: command-center must not run prod-core podman autostart.
# Clone monorepo before running harden from git.
EOF

echo "eliteew-cc %post --nochroot OK"
%end

%post --erroronfail --log=/root/eliteew-cc-chroot-post.log
set -euo pipefail
# Ensure owned can use podman rootless
getent group wheel >/dev/null
usermod -aG wheel owned 2>/dev/null || true
echo "eliteew-cc chroot %post OK"
%end
