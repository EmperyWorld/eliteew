#!/bin/bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: RPM %post — refresh freedesktop + KDE icon/desktop caches for brand icons.
# Invariants:
# - Best-effort; must not fail the package transaction.
# Related:
# - packaging/linux/desktop-template.desktop
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §Icons
# ---
set -eu
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
	gtk-update-icon-cache -f -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi
if command -v update-desktop-database >/dev/null 2>&1; then
	update-desktop-database -q /usr/share/applications >/dev/null 2>&1 || true
fi
# KDE Plasma (seat reports Icon=desktop-client not picking hicolor until sycoca refresh).
if command -v kbuildsycoca6 >/dev/null 2>&1; then
	kbuildsycoca6 --noincremental >/dev/null 2>&1 || true
elif command -v kbuildsycoca5 >/dev/null 2>&1; then
	kbuildsycoca5 --noincremental >/dev/null 2>&1 || true
fi
# Touch installed icons so file mtime advances (helps stubborn GNOME/KDE icon caches).
if [[ -d /usr/share/icons/hicolor ]]; then
	find /usr/share/icons/hicolor -type f -name 'desktop-client.png' -exec touch {} + >/dev/null 2>&1 || true
fi
if command -v xdg-icon-resource >/dev/null 2>&1; then
	xdg-icon-resource forceupdate >/dev/null 2>&1 || true
fi
