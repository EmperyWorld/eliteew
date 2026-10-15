/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Wave P chrome sync timing (no 750ms triple poll).
 *
 * Related:
 * - features/ebrowser/ebrowserChromeSync.ts
 * - documentation/reference/solution-readiness/2026-09-10-ebrowser-chrome-perf-wave-p.md
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	EBROWSER_BOUNDS_DEBOUNCE_MS,
	EBROWSER_CHROME_BURST_POLL_MS,
	EBROWSER_CHROME_HIDDEN_POLL_MS,
	EBROWSER_CHROME_IDLE_POLL_MS,
	ebrowserBoundsEqual,
	ebrowserChromePollIntervalMs,
	ebrowserDownloadsFingerprint,
	ebrowserTabsFingerprint,
} from './ebrowserChromeSync';
import { parseEBrowserChromeSnapshot } from './ebrowserNative';

describe('ebrowserChromeSync', () => {
	it('keeps idle poll far above legacy 750ms', () => {
		expect(EBROWSER_CHROME_IDLE_POLL_MS).toBeGreaterThanOrEqual(2000);
		expect(EBROWSER_CHROME_HIDDEN_POLL_MS).toBeGreaterThan(
			EBROWSER_CHROME_IDLE_POLL_MS
		);
		expect(EBROWSER_CHROME_BURST_POLL_MS).toBeLessThan(
			EBROWSER_CHROME_IDLE_POLL_MS
		);
		expect(EBROWSER_BOUNDS_DEBOUNCE_MS).toBeGreaterThan(0);
	});

	it('picks burst vs idle vs hidden intervals', () => {
		expect(
			ebrowserChromePollIntervalMs({
				hidden: true,
				burstUntilMs: Date.now() + 10_000,
				nowMs: Date.now(),
			})
		).toBe(EBROWSER_CHROME_HIDDEN_POLL_MS);
		expect(
			ebrowserChromePollIntervalMs({
				hidden: false,
				burstUntilMs: Date.now() + 10_000,
				nowMs: Date.now(),
			})
		).toBe(EBROWSER_CHROME_BURST_POLL_MS);
		expect(
			ebrowserChromePollIntervalMs({
				hidden: false,
				burstUntilMs: 0,
				nowMs: Date.now(),
			})
		).toBe(EBROWSER_CHROME_IDLE_POLL_MS);
	});

	it('equality helpers bail out equal chrome fingerprints', () => {
		expect(
			ebrowserBoundsEqual(
				{ x: 1, y: 2, width: 3, height: 4 },
				{ x: 1, y: 2, width: 3, height: 4 }
			)
		).toBe(true);
		expect(
			ebrowserBoundsEqual(
				{ x: 1, y: 2, width: 3, height: 4 },
				{ x: 1, y: 2, width: 3, height: 5 }
			)
		).toBe(false);
		expect(
			ebrowserDownloadsFingerprint([
				{ id: 1, phase: 'library', progress: 1, contentId: 'c' },
			])
		).toBe(
			ebrowserDownloadsFingerprint([
				{ id: 1, phase: 'library', progress: 1, contentId: 'c' },
			])
		);
		expect(
			ebrowserTabsFingerprint([{ id: 1, active: true, href: 'https://a' }], 3)
		).toBe(
			ebrowserTabsFingerprint([{ id: 1, active: true, href: 'https://a' }], 3)
		);
	});

	it('parses chrome snapshot wire shape', () => {
		const snap = parseEBrowserChromeSnapshot({
			ok: true,
			location: {
				ok: true,
				href: 'https://example.test/',
				page_title: 'Example',
				can_go_back: true,
				can_go_forward: false,
			},
			tabs: [{ id: 1, active: true, href: 'https://example.test/' }],
			max_tabs: 3,
			downloads: [
				{
					id: 9,
					name: 'a.bin',
					phase: 'progress',
					progress: 0.5,
					bytes_received: 10,
				},
			],
		});
		expect(snap?.location?.url).toBe('https://example.test/');
		expect(snap?.location?.pageTitle).toBe('Example');
		expect(snap?.tabs).toHaveLength(1);
		expect(snap?.downloads[0]?.bytesReceived).toBe(10);
	});

	it('EBrowserApp no longer uses 750ms setInterval chrome poll', () => {
		const src = readFileSync(
			resolve(__dirname, '../../pages/Desktop/apps/EBrowserApp.tsx'),
			'utf8'
		);
		expect(src).not.toMatch(/setInterval\([^)]*,\s*750\s*\)/);
		expect(src).toContain('getNativeEBrowserChromeSnapshot');
		expect(src).toContain('listenNativeEBrowserChrome');
		expect(src).toContain('ebrowserChromePollIntervalMs');
	});
});
