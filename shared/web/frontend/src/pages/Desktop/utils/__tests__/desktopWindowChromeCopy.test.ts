/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for desktop window shell user-facing copy helpers (plan 02/20 R01, R04).
 */

import { describe, expect, it, vi } from 'vitest';
import type { WindowState } from '../../types/desktop.types';
import {
	buildDesktopWindowErrorMessage,
	buildDesktopWindowLoadingMessage,
	buildDesktopWindowMinSizeHint,
	buildDesktopWindowStillOpeningHint,
	buildDesktopWindowStillOpeningMessage,
	resolveDesktopWindowFriendlyAppName,
} from '../desktopWindowChromeCopy';

const t = vi.fn((key: string, opts?: Record<string, unknown>) => {
	if (key === 'windowChrome.loading') {
		return `Opening ${opts?.appName}…`;
	}
	if (key === 'windowChrome.stillOpening') {
		return `Still opening ${opts?.appName}…`;
	}
	if (key === 'windowChrome.stillOpeningHint') {
		return 'Taking longer than usual.';
	}
	if (key === 'windowChrome.loadFailed') {
		return `Could not open ${opts?.appName}`;
	}
	if (key === 'windowChrome.minSizeHint') {
		return `Min ${opts?.minWidth}×${opts?.minHeight}`;
	}
	return key;
}) as unknown as import('i18next').TFunction<'desktopUi'>;

function seedWindow(overrides: Partial<WindowState> = {}): WindowState {
	return {
		id: 'w1',
		title: 'Catalog Title',
		type: 'app',
		position: { x: 0, y: 0 },
		size: { width: 640, height: 480 },
		isMinimized: false,
		isMaximized: false,
		zIndex: 1,
		path: [],
		appComponent: 'DocEditorV2',
		...overrides,
	};
}

describe('desktopWindowChromeCopy', () => {
	it('uses display title, not raw appComponent, for friendly name', () => {
		const win = seedWindow();
		expect(resolveDesktopWindowFriendlyAppName(win)).toBe('Catalog Title');
		expect(resolveDesktopWindowFriendlyAppName(win)).not.toContain('DocEditor');
	});

	it('builds loading and error messages from friendly name', () => {
		const win = seedWindow({ title: 'Documents' });
		expect(buildDesktopWindowLoadingMessage(t, win)).toBe('Opening Documents…');
		expect(buildDesktopWindowErrorMessage(t, win)).toBe(
			'Could not open Documents'
		);
	});

	it('builds still-opening stall copy from friendly name', () => {
		const win = seedWindow({ title: 'Documents' });
		expect(buildDesktopWindowStillOpeningMessage(t, win)).toBe(
			'Still opening Documents…'
		);
		expect(buildDesktopWindowStillOpeningHint(t)).toBe(
			'Taking longer than usual.'
		);
	});

	it('builds min-size hint with dimensions', () => {
		expect(buildDesktopWindowMinSizeHint(t, 720, 480)).toBe('Min 720×480');
	});
});
