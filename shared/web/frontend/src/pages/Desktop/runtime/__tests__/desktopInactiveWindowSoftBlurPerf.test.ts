/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for inactive-window soft blur perf sampler and dev bridge.
 *
 * Invariants:
 * - Sampler is read-only and reports shell counts from DOM markers.
 *
 * Related:
 * - `desktopInactiveWindowSoftBlurPerf.ts`
 * ---
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PERF_STORAGE_KEY = 'elite_desktop_inactive_window_soft_blur_perf';
const SOFT_BLUR_STORAGE_KEY = 'elite_desktop_inactive_window_soft_blur';

function ensureLocalStorageForTest(): void {
	if (typeof localStorage !== 'undefined') return;
	const store = new Map<string, string>();
	const mock = {
		get length() {
			return store.size;
		},
		clear: () => store.clear(),
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		key: (index: number) => Array.from(store.keys())[index] ?? null,
	} satisfies Storage;
	Object.defineProperty(globalThis, 'localStorage', {
		value: mock,
		configurable: true,
	});
	if (typeof window !== 'undefined') {
		Object.defineProperty(window, 'localStorage', {
			value: mock,
			configurable: true,
		});
	}
}

function mockRafSampler(sampleMs: number): void {
	let virtualNow = 0;
	vi.spyOn(performance, 'now').mockImplementation(() => virtualNow);
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
		virtualNow += Math.max(16, sampleMs / 2);
		void Promise.resolve().then(() => callback(virtualNow));
		return virtualNow;
	});
}

describe('desktopInactiveWindowSoftBlurPerf', () => {
	beforeEach(() => {
		ensureLocalStorageForTest();
		vi.resetModules();
		localStorage.clear();
		document.body.innerHTML = '';
		delete (window as { __eliteDesktopInactiveSoftBlurPerf?: unknown })
			.__eliteDesktopInactiveSoftBlurPerf;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('collects rAF frame metrics and inactive shell counts', async () => {
		const inactiveShell = document.createElement('div');
		inactiveShell.className = 'desktop-window-inactive-soft-blur';
		const inactiveWindow = document.createElement('div');
		inactiveWindow.setAttribute('data-desktop-window-active', 'false');
		document.body.append(inactiveShell, inactiveWindow);

		mockRafSampler(100);

		const { collectDesktopInactiveWindowSoftBlurPerfSample } = await import(
			'../desktopInactiveWindowSoftBlurPerf'
		);

		const sample = await collectDesktopInactiveWindowSoftBlurPerfSample({
			sampleMs: 100,
		});

		expect(sample.frameCount).toBeGreaterThan(0);
		expect(sample.fps).toBeGreaterThan(0);
		expect(sample.p95FrameMs).toBeGreaterThanOrEqual(0);
		expect(sample.inactiveSoftBlurShellCount).toBe(1);
		expect(sample.inactiveWindowCount).toBe(1);
		expect(sample.softBlurEnabled).toBe(false);
	});

	it('installs dev bridge on window when perf bridge is enabled', async () => {
		localStorage.setItem(PERF_STORAGE_KEY, '1');
		const { installDesktopInactiveWindowSoftBlurPerfDevBridge } = await import(
			'../desktopInactiveWindowSoftBlurPerf'
		);

		installDesktopInactiveWindowSoftBlurPerfDevBridge();

		expect(window.__eliteDesktopInactiveSoftBlurPerf).toBeDefined();
		expect(typeof window.__eliteDesktopInactiveSoftBlurPerf?.collect).toBe(
			'function'
		);
	});

	it('documents smoothness check steps on collect helper', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../desktopInactiveWindowSoftBlurPerf.ts'),
			'utf8'
		);
		expect(src).toContain('Settings → Performance smoothness check');
		expect(src).toContain('collectDesktopInactiveWindowSoftBlurPerfSample');
	});

	it('reports soft blur enabled state from storage', async () => {
		localStorage.setItem(SOFT_BLUR_STORAGE_KEY, '1');
		mockRafSampler(50);
		const { collectDesktopInactiveWindowSoftBlurPerfSample } = await import(
			'../desktopInactiveWindowSoftBlurPerf'
		);
		const sample = await collectDesktopInactiveWindowSoftBlurPerfSample({
			sampleMs: 50,
		});
		expect(sample.softBlurEnabled).toBe(true);
	});

	it('keeps soft-blur feature flag off when storage is empty (default)', async () => {
		expect(localStorage.getItem(SOFT_BLUR_STORAGE_KEY)).toBeNull();
		const { isDesktopInactiveWindowSoftBlurEnabled } = await import(
			'../desktopInactiveWindowBlur'
		);
		expect(isDesktopInactiveWindowSoftBlurEnabled()).toBe(false);
	});

	it('opt-in via setter then explicit off restores disabled (M3)', async () => {
		const {
			isDesktopInactiveWindowSoftBlurEnabled,
			setDesktopInactiveWindowSoftBlurEnabled,
		} = await import('../desktopInactiveWindowBlur');

		setDesktopInactiveWindowSoftBlurEnabled(true);
		expect(isDesktopInactiveWindowSoftBlurEnabled()).toBe(true);

		setDesktopInactiveWindowSoftBlurEnabled(false);
		expect(isDesktopInactiveWindowSoftBlurEnabled()).toBe(false);
	});
});
