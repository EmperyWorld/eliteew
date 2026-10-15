# EliteEW Trusted Substrate — x86_64 base (merged with fragments by buildroot-build.sh)
# W3 HOSTCC builds Buildroot's from-source toolchain + packages (see docs/ROOTFS-FROM-SOURCE.md).

BR2_x86_64=y
BR2_ARCH_IS_64=y
BR2_ENDIAN="LITTLE"
BR2_GCC_TARGET_ABI="64"
BR2_GCC_TARGET_CPU="x86-64"
BR2_TOOLCHAIN_BUILDROOT_GLIBC=y
BR2_KERNEL_HEADERS_6_12=y
BR2_GCC_VERSION_14_X=y
BR2_TOOLCHAIN_BUILDROOT_CXX=y

BR2_TARGET_GENERIC_HOSTNAME="eliteew-ts"
BR2_TARGET_GENERIC_ISSUE="EliteEW Trusted Substrate"
BR2_TARGET_GENERIC_GETTY_PORT="tty1"
BR2_SYSTEM_DHCP="eth0"
BR2_INIT_SYSTEMD=y
BR2_PACKAGE_SYSTEMD=y
BR2_PACKAGE_SYSTEMD_ANALYZE=y
# libseccomp selects systemd meson -Dseccomp=enabled on the next image rebuild.
BR2_PACKAGE_LIBSECCOMP=y
BR2_PACKAGE_BUSYBOX=y

BR2_LINUX_KERNEL=y
BR2_LINUX_KERNEL_USE_DEFCONFIG=y
BR2_LINUX_KERNEL_DEFCONFIG="x86_64"
BR2_LINUX_KERNEL_CONFIG_FRAGMENT_FILES="$(BR2_EXTERNAL_ELITEEW_TS_PATH)/board/eliteew-ts/linux-console.fragment $(BR2_EXTERNAL_ELITEEW_TS_PATH)/board/eliteew-ts/linux-gpu-audio.fragment $(BR2_EXTERNAL_ELITEEW_TS_PATH)/board/eliteew-ts/linux-wifi.fragment $(BR2_EXTERNAL_ELITEEW_TS_PATH)/board/eliteew-ts/linux-security.fragment $(BR2_EXTERNAL_ELITEEW_TS_PATH)/board/eliteew-ts/linux-wireguard.fragment"
BR2_LINUX_KERNEL_INSTALL_TARGET=y

BR2_TARGET_ROOTFS_EXT2=y
BR2_TARGET_ROOTFS_EXT2_4=y
# WebKitGTK + Mesa + LLVM/radeonsi + amdgpu firmware need headroom beyond 8G.
BR2_TARGET_ROOTFS_EXT2_SIZE="12G"
BR2_TARGET_ROOTFS_TAR=y
BR2_TARGET_ROOTFS_TAR_GZIP=y

# Toolchain / overlay paths are injected by scripts/buildroot-build.sh
