/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSO replace confirmation coordinator tests for shared HTTP/Socket gate.
 *
 * Related:
 * - services/auth/ssoSessionReplaceConfirm.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getSocketSsoReplaceConfirmFlag,
	hasActiveSessionReplaceConfirmation,
	markSessionReplaceConfirmedWindow,
	resetSessionReplaceConfirmationStateForTests,
	resolveSessionReplaceConfirmation,
	SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS,
} from '../ssoSessionReplaceConfirm';
import { registerSessionReplacePromptHandler } from '../ssoSessionReplaceConfirmBridge';

const CONFIRMED_UNTIL_KEY = 'eliteew.auth.sessionReplaceConfirmedUntil.v1';

describe('ssoSessionReplaceConfirm', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	afterEach(() => {
		resetSessionReplaceConfirmationStateForTests();
		vi.restoreAllMocks();
	});

	it('reuses active confirmation window without prompting again', async () => {
		markSessionReplaceConfirmedWindow();
		const handler = vi.fn().mockResolvedValue(true);
		registerSessionReplacePromptHandler(handler);
		await expect(resolveSessionReplaceConfirmation()).resolves.toBe(true);
		expect(handler).not.toHaveBeenCalled();
		expect(getSocketSsoReplaceConfirmFlag()).toBe(1);
	});

	it('persists confirmation window across OAuth full-page redirects', () => {
		markSessionReplaceConfirmedWindow();
		const storedUntil = Number(sessionStorage.getItem(CONFIRMED_UNTIL_KEY));
		expect(Number.isFinite(storedUntil)).toBe(true);
		expect(storedUntil).toBeGreaterThan(Date.now());
	});

	it('accepts custom OAuth TTL for login redirect survival', () => {
		const before = Date.now();
		markSessionReplaceConfirmedWindow(SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS);
		const storedUntil = Number(sessionStorage.getItem(CONFIRMED_UNTIL_KEY));
		expect(storedUntil).toBeGreaterThanOrEqual(
			before + SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS - 50
		);
		expect(storedUntil).toBeLessThanOrEqual(
			before + SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS + 50
		);
		expect(hasActiveSessionReplaceConfirmation()).toBe(true);
	});
});
