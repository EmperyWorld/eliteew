/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Assembles DesktopModalsLayer props for the workspace shell (wallpaper, new folder,
 * command palette, clipboard). P12: palette is actions-only — no displayItems catalog.
 *
 * Related:
 * - components/DesktopModalsLayer.tsx
 * - components/CommandPalette.tsx
 */

import { useMemo } from 'react';
import type { DesktopModalsLayerProps } from '../components/DesktopModalsLayer';
import type { UserFolderIconId } from '../constants/folderIcons';
import type { DesktopWindowStyle } from '@/types/profile';

export function useDesktopWorkspaceShellModalsProps(params: {
	showWP: boolean;
	setShowWP: (v: boolean) => void;
	wallpaper: string;
	wallpaperHistory: string[] | undefined;
	handleWallpaperChange: (value: string) => void;
	handleRemoveUserWallpaper: (style: string) => void;
	openWallpaperFromDesktopSettings: () => void;
	showNF: boolean;
	setShowNF: (v: boolean) => void;
	onCloseNewFolder?: () => void;
	handleCreateFolder: (
		name: string,
		iconId: UserFolderIconId
	) => void | Promise<void>;
	desktopWindowStyle: DesktopWindowStyle;
	showCommandPalette: boolean;
	setShowCommandPalette: (v: boolean) => void;
	handleCommandPaletteAction: (action: string) => void;
	showClipboard: boolean;
	setShowClipboard: (v: boolean) => void;
}): DesktopModalsLayerProps {
	const {
		showWP,
		setShowWP,
		wallpaper,
		wallpaperHistory,
		handleWallpaperChange,
		handleRemoveUserWallpaper,
		openWallpaperFromDesktopSettings,
		showNF,
		setShowNF,
		onCloseNewFolder,
		handleCreateFolder,
		desktopWindowStyle,
		showCommandPalette,
		setShowCommandPalette,
		handleCommandPaletteAction,
		showClipboard,
		setShowClipboard,
	} = params;

	return useMemo(
		() => ({
			showWallpaper: showWP,
			onCloseWallpaper: () => setShowWP(false),
			wallpaper,
			wallpaperHistory,
			onWallpaperChange: handleWallpaperChange,
			onRemoveUserWallpaper: handleRemoveUserWallpaper,
			onOpenWallpaperPicker: () => {
				openWallpaperFromDesktopSettings();
			},
			showNewFolder: showNF,
			onCloseNewFolder: onCloseNewFolder ?? (() => setShowNF(false)),
			onCreateFolder: handleCreateFolder,
			desktopWindowStyle,
			showCommandPalette,
			onCloseCommandPalette: () => setShowCommandPalette(false),
			onCommandAction: handleCommandPaletteAction,
			showClipboard,
			onCloseClipboard: () => setShowClipboard(false),
		}),
		[
			showWP,
			setShowWP,
			wallpaper,
			wallpaperHistory,
			handleWallpaperChange,
			handleRemoveUserWallpaper,
			openWallpaperFromDesktopSettings,
			showNF,
			setShowNF,
			onCloseNewFolder,
			handleCreateFolder,
			desktopWindowStyle,
			showCommandPalette,
			setShowCommandPalette,
			handleCommandPaletteAction,
			showClipboard,
			setShowClipboard,
		]
	);
}
