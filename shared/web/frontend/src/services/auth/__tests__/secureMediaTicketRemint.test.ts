/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Security and resilience tests for secure media ticket re-mint (no privilege escalation).
 *
 * Related:
 * - services/auth/secureMediaTicketRemint.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../api/client';

const authState = vi.hoisted(() => ({
	authenticated: true,
	token: 'token-a',
}));

const createContentDownloadTicket = vi.hoisted(() => vi.fn());

vi.mock('../../authSession', () => ({
	default: authState,
}));

vi.mock('../../auth/authSessionLock', () => ({
	isAuthSessionLocked: vi.fn(() => false),
}));

vi.mock('../../contentApi', () => ({
	contentApi: {
		createContentDownloadTicket: (...args: unknown[]) =>
			createContentDownloadTicket(...args),
	},
}));

import {
	buildSecureMediaTicketRemintContext,
	canAttemptSecureMediaTicketRemint,
	isContentTicketStreamUrl,
	secureRemintContentInlineStreamUrl,
} from '../secureMediaTicketRemint';

describe('secureMediaTicketRemint', () => {
	beforeEach(() => {
		authState.authenticated = true;
		authState.token = 'token-a';
		createContentDownloadTicket.mockReset();
	});

	it('detects ticket stream URLs', () => {
		expect(
			isContentTicketStreamUrl(
				'/api/v1/content/abc/download-by-ticket?ticket=old'
			)
		).toBe(true);
		expect(isContentTicketStreamUrl('/api/v1/content/abc/download')).toBe(
			false
		);
	});

	it('blocks remint when allowedContentId does not match (malicious pivot)', async () => {
		expect(
			canAttemptSecureMediaTicketRemint({
				contentId: 'other-user-track',
				allowedContentId: 'my-track',
			})
		).toBe(false);

		const result = await secureRemintContentInlineStreamUrl({
			contentId: 'other-user-track',
			allowedContentId: 'my-track',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe('identity_mismatch');
		}
		expect(createContentDownloadTicket).not.toHaveBeenCalled();
	});

	it('returns terminal access_denied when backend rejects remint with 403', async () => {
		createContentDownloadTicket.mockRejectedValueOnce(
			new APIError('Forbidden', 403, 'FORBIDDEN')
		);

		const result = await secureRemintContentInlineStreamUrl({
			contentId: 'track-1',
			allowedContentId: 'track-1',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe('access_denied');
			expect(result.statusCode).toBe(403);
			expect(result.terminal).toBe(true);
		}
		expect(createContentDownloadTicket).toHaveBeenCalledTimes(1);
	});

	it('returns fresh stream URL when backend approves remint after token rotation path', async () => {
		createContentDownloadTicket.mockResolvedValueOnce({
			download_url:
				'/api/v1/content/track-1/download-by-ticket?ticket=fresh-ticket',
		});

		const result = await secureRemintContentInlineStreamUrl({
			contentId: 'track-1',
			allowedContentId: 'track-1',
			version: 'rev-2',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.streamUrl).toContain('ticket=fresh-ticket');
		}
		expect(createContentDownloadTicket).toHaveBeenCalledWith('track-1', {
			disposition: 'inline',
			revision: 'rev-2',
		});
	});

	it('builds remint context from expired ticket URL', () => {
		const ctx = buildSecureMediaTicketRemintContext(
			'/api/v1/content/track-9/download-by-ticket?ticket=expired&v=rev1',
			'track-9'
		);
		expect(ctx).toEqual({
			contentId: 'track-9',
			allowedContentId: 'track-9',
			version: 'rev1',
		});
	});
});
