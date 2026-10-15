import { describe, expect, it, vi } from 'vitest';
import { persistedWindowStateFixture } from '../../__fixtures__/desktopTestHelpers';
import type { DesktopItem } from '../../types/desktop.types';
import type { DesktopWindowLayoutPreset } from '../../types/desktopExpansion.types';
import {
	applyDesktopWindowLayoutPresetWindows,
	shouldPromptDesktopWindowLayoutPresetApply,
} from '../applyDesktopWindowLayoutPresetWindows';

const catalogItem: DesktopItem = {
	id: 'app-1',
	name: 'Notes',
	type: 'app',
	appComponent: 'NotesApp',
	position: { x: 0, y: 0 },
};

const preset: DesktopWindowLayoutPreset = {
	id: 'preset-1',
	name: 'Editor layout',
	windows: [
		persistedWindowStateFixture({
			appComponent: 'NotesApp',
			position: { x: 40, y: 40 },
			size: { width: 800, height: 600 },
		}),
	],
};

describe('applyDesktopWindowLayoutPresetWindows', () => {
	it('opens preset windows in add mode without closing', () => {
		const openWindow = vi.fn();
		const closeWindow = vi.fn();

		const result = applyDesktopWindowLayoutPresetWindows({
			preset,
			catalog: [catalogItem],
			openWindow,
			mode: 'add',
			closeWindow,
			currentDesktopWindowIds: ['w-existing'],
		});

		expect(closeWindow).not.toHaveBeenCalled();
		expect(openWindow).toHaveBeenCalledTimes(1);
		expect(openWindow).toHaveBeenCalledWith(
			catalogItem,
			expect.objectContaining({ forceNew: true })
		);
		expect(result.openedCount).toBe(1);
		expect(result.skippedCount).toBe(0);
	});

	it('closes current desktop windows in replace mode before opening', () => {
		const openWindow = vi.fn();
		const closeWindow = vi.fn();

		applyDesktopWindowLayoutPresetWindows({
			preset,
			catalog: [catalogItem],
			openWindow,
			mode: 'replace',
			closeWindow,
			currentDesktopWindowIds: ['w-a', 'w-b'],
		});

		expect(closeWindow).toHaveBeenCalledTimes(2);
		expect(closeWindow).toHaveBeenNthCalledWith(1, 'w-a');
		expect(closeWindow).toHaveBeenNthCalledWith(2, 'w-b');
		expect(openWindow).toHaveBeenCalledTimes(1);
	});

	it('counts skipped entries when catalog cannot resolve an item', () => {
		const openWindow = vi.fn();

		const result = applyDesktopWindowLayoutPresetWindows({
			preset: {
				...preset,
				windows: [
					persistedWindowStateFixture({
						appComponent: 'MissingApp',
						position: { x: 0, y: 0 },
					}),
				],
			},
			catalog: [catalogItem],
			openWindow,
			mode: 'add',
		});

		expect(openWindow).not.toHaveBeenCalled();
		expect(result.openedCount).toBe(0);
		expect(result.skippedCount).toBe(1);
	});

	it('empty windows array opens nothing (edge)', () => {
		const openWindow = vi.fn();
		const result = applyDesktopWindowLayoutPresetWindows({
			preset: { ...preset, windows: [] },
			catalog: [catalogItem],
			openWindow,
			mode: 'add',
		});
		expect(openWindow).not.toHaveBeenCalled();
		expect(result).toEqual({ openedCount: 0, skippedCount: 0 });
	});

	it('empty catalog skips all preset windows (edge)', () => {
		const openWindow = vi.fn();
		const result = applyDesktopWindowLayoutPresetWindows({
			preset,
			catalog: [],
			openWindow,
			mode: 'add',
		});
		expect(openWindow).not.toHaveBeenCalled();
		expect(result.openedCount).toBe(0);
		expect(result.skippedCount).toBe(1);
	});

	it('nullish appComponent and folderId counts as skipped (malformed row)', () => {
		const openWindow = vi.fn();
		const result = applyDesktopWindowLayoutPresetWindows({
			preset: {
				...preset,
				windows: [persistedWindowStateFixture({ position: { x: 0, y: 0 } })],
			},
			catalog: [catalogItem],
			openWindow,
			mode: 'add',
		});
		expect(openWindow).not.toHaveBeenCalled();
		expect(result.skippedCount).toBe(1);
	});

	it('replace mode without closeWindow throws (negative contract)', () => {
		expect(() =>
			applyDesktopWindowLayoutPresetWindows({
				preset,
				catalog: [catalogItem],
				openWindow: vi.fn(),
				mode: 'replace',
			})
		).toThrow(/replace mode requires closeWindow/);
	});
});

describe('shouldPromptDesktopWindowLayoutPresetApply', () => {
	it('prompts when at least one window is open on the desktop', () => {
		expect(shouldPromptDesktopWindowLayoutPresetApply(0)).toBe(false);
		expect(shouldPromptDesktopWindowLayoutPresetApply(1)).toBe(true);
	});

	it('treats negative count as no prompt (edge)', () => {
		expect(shouldPromptDesktopWindowLayoutPresetApply(-1)).toBe(false);
	});
});
