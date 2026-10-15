################################################################################
#
# gnome-keyring (EliteEW Trusted Substrate — BR2_EXTERNAL)
#
################################################################################

GNOME_KEYRING_VERSION_MAJOR = 50
GNOME_KEYRING_VERSION = $(GNOME_KEYRING_VERSION_MAJOR).0
GNOME_KEYRING_SITE = https://download.gnome.org/sources/gnome-keyring/$(GNOME_KEYRING_VERSION_MAJOR)
GNOME_KEYRING_SOURCE = gnome-keyring-$(GNOME_KEYRING_VERSION).tar.xz
GNOME_KEYRING_LICENSE = GPL-2.0+
GNOME_KEYRING_LICENSE_FILES = COPYING COPYING.LIB

GNOME_KEYRING_DEPENDENCIES = \
	host-pkgconf \
	dbus \
	gcr \
	libcap-ng \
	libgcrypt \
	libglib2 \
	p11-kit

# Appliance path: no PAM login unlock (eliteew-ts-secrets-up --login),
# no systemd user socket, no ssh-agent — secrets component only.
GNOME_KEYRING_CONF_OPTS = \
	-Dlibcap-ng=enabled \
	-Dssh-agent=false \
	-Dselinux=disabled \
	-Dsystemd=disabled \
	-Dpam=false \
	-Ddebug-mode=false \
	-Dmanpage=false

$(eval $(meson-package))
