/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for GAF Chat user-facing error mapper.
 *
 * Related:
 * - gafChatMapUserError.ts
 */
import { createGafChatTFunction } from '../../../__fixtures__/desktopTestHelpers';
import { APIError } from '@/services/api/client';
import { describe, expect, it } from 'vitest';
import { mapGafChatUserError } from '../gafChatMapUserError';

describe('mapGafChatUserError', () => {
	const t = createGafChatTFunction();

	it('maps 429 to send rate limit copy', () => {
		expect(mapGafChatUserError(new APIError('Too many', 429), t, 'send')).toBe(
			'i18n:toastSendRateLimited'
		);
	});

	it('maps auth errors to chatsLoadErrorAuth', () => {
		expect(mapGafChatUserError(new APIError('', 401), t, 'chats')).toBe(
			'i18n:chatsLoadErrorAuth'
		);
	});

	it('maps network errors to generic chats load copy', () => {
		expect(
			mapGafChatUserError(new APIError('Network Error', 0), t, 'messages')
		).toBe('i18n:chatsLoadErrorGeneric');
	});

	it('uses context fallback when message is empty', () => {
		expect(mapGafChatUserError(new APIError('', 500), t, 'e2ee')).toBe(
			'i18n:e2eeToastActionFailed'
		);
	});
});
