import { describe, expect, it } from 'vitest';
import { DEFAULT_APPS } from '../../constants';
import {
	DESKTOP_APP_WINDOW_MIN_SIZES,
	DESKTOP_WINDOW_MIN_SIZE_DEFAULTS,
	DESKTOP_WINDOW_MIN_SIZE_TIERS,
	getDesktopWindowMinSize,
	getDesktopWindowMinSizeForAppComponent,
	isGafDesktopWindow,
	resolveDesktopAppWindowMinSize,
} from '../desktopWindowMinSizeRegistry';
import type { WindowState } from '../../types/desktop.types';

function baseWindow(overrides: Partial<WindowState> = {}): WindowState {
	return {
		id: 'w1',
		title: 'Test',
		type: 'app',
		position: { x: 0, y: 0 },
		size: { width: 800, height: 600 },
		zIndex: 1,
		isMinimized: false,
		isMaximized: false,
		path: [],
		...overrides,
	};
}

describe('desktopWindowMinSizeRegistry', () => {
	it('returns larger bounds for GAF chat by component', () => {
		const w = baseWindow({ appComponent: 'GAFChatApp' });
		expect(getDesktopWindowMinSize(w)).toEqual(
			DESKTOP_WINDOW_MIN_SIZE_TIERS.chat
		);
	});

	it('detects GAF by title alias when component missing', () => {
		const w = baseWindow({ title: 'GAF Chat', appComponent: undefined });
		expect(isGafDesktopWindow(w)).toBe(true);
		expect(getDesktopWindowMinSize(w).minWidth).toBe(
			DESKTOP_WINDOW_MIN_SIZE_TIERS.chat.minWidth
		);
	});

	it('uses folder defaults for folder windows', () => {
		const w = baseWindow({ type: 'folder', folderId: 'f1' });
		expect(getDesktopWindowMinSize(w)).toEqual(
			DESKTOP_WINDOW_MIN_SIZE_DEFAULTS.folder
		);
	});

	it('uses workspace tier for MarketingCabinet', () => {
		const w = baseWindow({ appComponent: 'MarketingCabinet' });
		expect(getDesktopWindowMinSize(w)).toEqual(
			DESKTOP_WINDOW_MIN_SIZE_TIERS.workspace
		);
	});

	it('uses editor tier for DocEditorV2', () => {
		const w = baseWindow({ appComponent: 'DocEditorV2' });
		expect(getDesktopWindowMinSize(w)).toEqual(
			DESKTOP_WINDOW_MIN_SIZE_TIERS.editor
		);
	});

	it('uses feed tier for shell settings', () => {
		const w = baseWindow({ appComponent: 'DesktopShellSettings' });
		expect(getDesktopWindowMinSize(w)).toEqual(
			DESKTOP_WINDOW_MIN_SIZE_TIERS.feed
		);
	});

	it('uses compact tier for dashboard favorites', () => {
		const w = baseWindow({ appComponent: 'DesktopDashboardFavoritesApp' });
		expect(getDesktopWindowMinSize(w)).toEqual(
			DESKTOP_WINDOW_MIN_SIZE_TIERS.compact
		);
	});

	it('getDesktopWindowMinSizeForAppComponent matches full state for same component', () => {
		const w = baseWindow({ appComponent: 'MarketingCabinet' });
		expect(getDesktopWindowMinSizeForAppComponent('MarketingCabinet')).toEqual(
			getDesktopWindowMinSize(w)
		);
	});

	it('getDesktopWindowMinSizeForAppComponent returns null for empty id', () => {
		expect(getDesktopWindowMinSizeForAppComponent('')).toBeNull();
		expect(getDesktopWindowMinSizeForAppComponent(undefined)).toBeNull();
	});

	it('falls back to generic app minimum for unknown components', () => {
		const w = baseWindow({ appComponent: 'UnknownWidget' });
		expect(getDesktopWindowMinSize(w)).toEqual(
			DESKTOP_WINDOW_MIN_SIZE_DEFAULTS.app
		);
		expect(resolveDesktopAppWindowMinSize('UnknownWidget')).toEqual(
			DESKTOP_WINDOW_MIN_SIZE_DEFAULTS.app
		);
	});

	it('covers every default desktop app component explicitly', () => {
		const defaultComponents = DEFAULT_APPS.filter((item) => item.type === 'app')
			.map((item) => item.appComponent)
			.filter((c): c is string => typeof c === 'string' && c.length > 0);

		for (const appComponent of defaultComponents) {
			expect(
				DESKTOP_APP_WINDOW_MIN_SIZES[appComponent],
				`missing min-size for ${appComponent}`
			).toBeDefined();
			expect(getDesktopWindowMinSizeForAppComponent(appComponent)).toEqual(
				DESKTOP_APP_WINDOW_MIN_SIZES[appComponent]
			);
		}
	});

	it('maps legacy social aliases to social tier', () => {
		expect(
			getDesktopWindowMinSize(baseWindow({ appComponent: 'FriendsApp' }))
		).toEqual(DESKTOP_WINDOW_MIN_SIZE_TIERS.social);
		expect(
			getDesktopWindowMinSize(baseWindow({ appComponent: 'UserProfile' }))
		).toEqual(DESKTOP_WINDOW_MIN_SIZE_TIERS.social);
	});

	it('uses presentation tier for EWRP and Presentations', () => {
		for (const appComponent of [
			'EWRP',
			'Presentations',
			'PresentationsArchive',
		]) {
			expect(getDesktopWindowMinSize(baseWindow({ appComponent }))).toEqual(
				DESKTOP_WINDOW_MIN_SIZE_TIERS.presentation
			);
		}
	});
});
