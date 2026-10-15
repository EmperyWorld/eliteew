/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSO replace confirm bridge registration tests.
 *
 * Related:
 * - services/auth/ssoSessionReplaceConfirmBridge.ts
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	invokeSessionReplacePromptHandler,
	registerSessionReplacePromptHandler,
	unregisterSessionReplacePromptHandler,
} from '../ssoSessionReplaceConfirmBridge';

describe('ssoSessionReplaceConfirmBridge', () => {
	afterEach(() => {
		unregisterSessionReplacePromptHandler();
		vi.restoreAllMocks();
	});

	it('uses registered handler when present', async () => {
		const handler = vi.fn().mockResolvedValue(true);
		registerSessionReplacePromptHandler(handler);
		await expect(invokeSessionReplacePromptHandler()).resolves.toBe(true);
		expect(handler).toHaveBeenCalledTimes(1);
	});
});
