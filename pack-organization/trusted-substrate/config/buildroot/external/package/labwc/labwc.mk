################################################################################
#
# labwc (EliteEW Trusted Substrate — BR2_EXTERNAL)
#
################################################################################

LABWC_VERSION = 0.8.3
LABWC_SITE = https://github.com/labwc/labwc/archive/refs/tags
LABWC_SOURCE = $(LABWC_VERSION).tar.gz
LABWC_LICENSE = GPL-2.0
LABWC_LICENSE_FILES = LICENSE

# Pin matches Buildroot 2025.02.1 wlroots 0.18.x (labwc meson: wlroots-0.18).
# Disable icon/sfdo — libsfdo is not in stock Buildroot 2025.02.1.
LABWC_DEPENDENCIES = \
	host-pkgconf \
	cairo \
	libglib2 \
	libinput \
	libpng \
	libxml2 \
	libxkbcommon \
	pango \
	pixman \
	wayland \
	wayland-protocols \
	wlroots

LABWC_CONF_OPTS = \
	-Dman-pages=disabled \
	-Dicon=disabled \
	-Dnls=disabled

ifeq ($(BR2_PACKAGE_LABWC_XWAYLAND),y)
LABWC_DEPENDENCIES += libxcb xcb-util-wm
LABWC_CONF_OPTS += -Dxwayland=enabled
else
LABWC_CONF_OPTS += -Dxwayland=disabled
endif

$(eval $(meson-package))
