import { afterEach, describe, expect, it, vi } from 'vitest';

const personalizeImport = vi.hoisted(() => vi.fn(async () => ({})));
const iconsImport = vi.hoisted(() => vi.fn(async () => ({})));
const chromeImport = vi.hoisted(() => vi.fn(async () => ({})));
const widgetsImport = vi.hoisted(() => vi.fn(async () => ({})));
const shellImport = vi.hoisted(() => vi.fn(async () => ({})));
const performanceImport = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock('../DesktopSettingsPersonalizeTab', () => personalizeImport());
vi.mock('../DesktopSettingsIconsTab', () => iconsImport());
vi.mock('../DesktopSettingsChromeTab', () => chromeImport());
vi.mock('../DesktopSettingsWidgetsTab', () => widgetsImport());
vi.mock('../DesktopSettingsShellTab', () => shellImport());
vi.mock('../DesktopSettingsPerformanceTab', () => performanceImport());

import {
	buildDesktopSettingsTabPrefetchOrder,
	cancelDesktopSettingsTabChunkPrefetch,
	prefetchDesktopSettingsTabChunks,
	resetDesktopSettingsTabChunkPrefetchForTests,
} from '../prefetchDesktopSettingsTabChunks';

describe('prefetchDesktopSettingsTabChunks', () => {
	afterEach(() => {
		resetDesktopSettingsTabChunkPrefetchForTests();
		vi.restoreAllMocks();
	});

	it('prefetches inactive tab chunks on idle', async () => {
		if (!window.requestIdleCallback) {
			window.requestIdleCallback = ((cb: IdleRequestCallback) => {
				cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
				return 1;
			}) as typeof window.requestIdleCallback;
		}
		vi.spyOn(window, 'requestIdleCallback').mockImplementation(
			(cb: IdleRequestCallback) => {
				cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
				return 1;
			}
		);

		prefetchDesktopSettingsTabChunks('personalize');

		await vi.waitFor(() => {
			expect(iconsImport).toHaveBeenCalledTimes(1);
			expect(chromeImport).toHaveBeenCalledTimes(1);
			expect(widgetsImport).toHaveBeenCalledTimes(1);
			expect(shellImport).toHaveBeenCalledTimes(1);
			expect(performanceImport).toHaveBeenCalledTimes(1);
		});
		expect(personalizeImport).not.toHaveBeenCalled();
	});

	it('prefetches neighbor tabs before distant tabs (order)', () => {
		expect(buildDesktopSettingsTabPrefetchOrder('chrome')).toEqual([
			'icons',
			'widgets',
			'personalize',
			'shell',
			'performance',
		]);
		expect(buildDesktopSettingsTabPrefetchOrder('shell')).toEqual([
			'widgets',
			'performance',
			'chrome',
			'icons',
			'personalize',
		]);
	});

	it('cancel aborts scheduled idle prefetch', () => {
		resetDesktopSettingsTabChunkPrefetchForTests();
		iconsImport.mockClear();
		let idleCb: IdleRequestCallback | undefined;
		if (!window.cancelIdleCallback) {
			window.cancelIdleCallback = vi.fn();
		}
		if (!window.requestIdleCallback) {
			window.requestIdleCallback = vi.fn();
		}
		vi.spyOn(window, 'requestIdleCallback').mockImplementation((cb) => {
			idleCb = cb;
			return 99;
		});
		const cancelIdle = vi.spyOn(window, 'cancelIdleCallback');

		prefetchDesktopSettingsTabChunks('personalize');
		cancelDesktopSettingsTabChunkPrefetch();

		expect(cancelIdle).toHaveBeenCalledWith(99);
		expect(idleCb).toBeDefined();
		if (idleCb) {
			idleCb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
		}
		expect(iconsImport).not.toHaveBeenCalled();
	});
});
