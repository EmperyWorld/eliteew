/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for Tauri desktopNative OIDC bootstrap + K3 eliteewOpenApp pending open.
 *
 * Related:
 * - setupDesktopNativeOidcProfile.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	PENDING_DESKTOP_OPEN_KEY,
	peekPendingDesktopOpen,
} from '@/pages/Desktop/utils/pendingDesktopOpen';
import {
	captureDesktopNativeOpenAppIntentFromUrl,
	DESKTOP_CLIENT_QUERY,
	DESKTOP_NATIVE_FLAG_KEY,
	DESKTOP_OPEN_APP_QUERY,
} from '../setupDesktopNativeOidcProfile';

describe('desktopNative OIDC bootstrap constants', () => {
	it('uses stable query and storage keys', () => {
		expect(DESKTOP_CLIENT_QUERY).toBe('eliteewDesktopClient');
		expect(DESKTOP_OPEN_APP_QUERY).toBe('eliteewOpenApp');
		expect(DESKTOP_NATIVE_FLAG_KEY).toBe('eliteew.desktopNativeClient.v1');
	});
});

describe('captureDesktopNativeOpenAppIntentFromUrl (K3)', () => {
	beforeEach(() => {
		sessionStorage.clear();
		window.history.replaceState(
			null,
			'',
			'/?eliteewDesktopClient=1&eliteewOpenApp=ClipboardManager'
		);
	});

	afterEach(() => {
		sessionStorage.clear();
		vi.restoreAllMocks();
	});

	it('queues pending app open and strips eliteewOpenApp from URL', () => {
		const captured = captureDesktopNativeOpenAppIntentFromUrl();
		expect(captured).toBe('ClipboardManager');
		expect(peekPendingDesktopOpen()).toEqual({
			kind: 'app',
			appComponent: 'ClipboardManager',
		});
		expect(sessionStorage.getItem(PENDING_DESKTOP_OPEN_KEY)).toBeTruthy();
		expect(window.location.search).not.toContain('eliteewOpenApp');
		expect(window.location.search).toContain('eliteewDesktopClient=1');
	});

	it('rejects unsafe appComponent values', () => {
		window.history.replaceState(null, '', '/?eliteewOpenApp=../evil<script>');
		expect(captureDesktopNativeOpenAppIntentFromUrl()).toBeNull();
		expect(peekPendingDesktopOpen()).toBeNull();
	});

	it('rejects mounts not in spa_deep_link allowlist (K4)', () => {
		window.history.replaceState(
			null,
			'',
			'/?eliteewDesktopClient=1&eliteewOpenApp=ProjectAboutApp'
		);
		expect(captureDesktopNativeOpenAppIntentFromUrl()).toBeNull();
		expect(peekPendingDesktopOpen()).toBeNull();
		expect(window.location.search).not.toContain('eliteewOpenApp');
	});
});
