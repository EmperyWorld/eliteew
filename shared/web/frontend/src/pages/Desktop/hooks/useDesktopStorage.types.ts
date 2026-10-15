/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public types for `useDesktopStorage` (config persist options + hook return).
 *
 * Invariants:
 * - Shape must stay stable for DesktopWorkspace / settings cluster type importers.
 *
 * Related:
 * - ./useDesktopStorage.ts
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
 */

import type {
	DesktopStorageConfigSaveErrorCode,
	DesktopStorageSyncErrorCode,
} from '../utils/desktopStorageSyncError';
import type { DesktopLoadFailureInfo } from '../utils/desktopUi';
import type { UserFolderIconId } from '../constants/folderIcons';
import type { DesktopConfig, DesktopItem } from '../types/desktop.types';
import {
	DESKTOP_FLOATING_WIDGET_POSITION_SEED,
	WALLPAPERS,
} from '../constants';

export type DesktopConfigPersistOptions = {
	/**
	 * If false, merge into local desktop config state only — no PATCH to the API.
	 * Default true (when omitted).
	 */
	persistRemote?: boolean;
};

export interface UseDesktopStorageReturn {
	config: DesktopConfig | null;
	updateConfig: (
		updates: Partial<DesktopConfig>,
		options?: DesktopConfigPersistOptions
	) => Promise<void>;
	applyDesktopConfigSnapshotLocal: (snapshot: DesktopConfig) => void;
	isConfigSaving: boolean;
	configSaveError: DesktopStorageConfigSaveErrorCode | null;
	applyPersistedConfigPatch: (
		payload: Record<string, unknown>
	) => Promise<void>;

	items: DesktopItem[];
	updateItemPosition: (
		itemId: string,
		position: { x: number; y: number }
	) => Promise<void>;
	createFolder: (
		name: string,
		options?: { parentId?: string; folderIconId?: UserFolderIconId }
	) => Promise<DesktopItem>;
	updateFolderIcon: (
		itemId: string,
		folderIconId: UserFolderIconId
	) => Promise<void>;
	createMarkdownFile: (options?: {
		parentId?: string;
	}) => Promise<{ contentId: string; item: DesktopItem } | null>;
	deleteItem: (itemId: string) => Promise<void>;
	togglePinItem: (itemId: string) => Promise<void>;
	replaceItems: (next: DesktopItem[]) => void;

	isLoading: boolean;
	isItemsHydrating: boolean;
	isSyncing: boolean;
	error: DesktopStorageSyncErrorCode | null;
	isOnline: boolean;
	tabConflictDetected: boolean;
	clearTabConflict: () => void;

	refresh: () => Promise<void>;
	syncToServer: (overrideItems?: DesktopItem[]) => Promise<void>;

	loadFailure: DesktopLoadFailureInfo | null;
	isLoadingStalled: boolean;
	clearLoadFailure: () => void;
}

export const DEFAULT_DESKTOP_STORAGE_CONFIG: DesktopConfig = {
	user_id: '',
	wallpaper: WALLPAPERS[0]?.style || '',
	icon_size: 'medium',
	show_widget: false,
	widget_position: { ...DESKTOP_FLOATING_WIDGET_POSITION_SEED },
	theme: 'dark',
	liveWallpaper: false,
	snap_to_grid: true,
	grid_step: 'medium',
	widgets_panel_position: 'top-right',
	compact_widgets: false,
	show_widgets_panel: false,
};

export const DESKTOP_STORAGE_SYNC_DEBOUNCE_MS = 600;
