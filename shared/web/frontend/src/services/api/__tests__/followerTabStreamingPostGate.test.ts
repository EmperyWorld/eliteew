/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EV-01 regression: gated SSE/streaming POST must respect follower-tab passive mode
 * (same gate as axios request interceptor and apiFetchWithAuth).
 *
 * Invariants:
 * - Follower tabs must not reach network for gated mutation/stream POST paths.
 *
 * Related:
 * - services/api/client.ts — axios interceptor + apiFetchWithAuth
 * - ewaCompanionChatStreamApi.ts, productDesktopApi.ts, desktopChatClient.ts
 */

import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamDesktopAiChat } from '../../../features/desktop-ai-chat/api/desktopChatClient';
import { sendAssistantMessageStream } from '../../../pages/Desktop/services/productDesktopApi';
import {
	FOLLOWER_TAB_PASSIVE_MODE,
	setBrowserTabLeaderRole,
	setSingleTabPolicyEnabled,
} from '../../../utils/browserTabLeaderState';
import { streamEwaCompanionChatMessage } from '../../ewa/ewaCompanionChatStreamApi';
import { createAPIClient } from '../client';

vi.mock('../../authSession', () => ({
	default: {
		authenticated: true,
		token: 'test-access-token',
		updateToken: vi.fn().mockResolvedValue(true),
	},
	ensureAccessTokenMinValidity: vi.fn().mockResolvedValue(undefined),
	getAuthHeader: vi.fn(() => ({ Authorization: 'Bearer test-access-token' })),
}));

describe('EV-01 follower tab gate — gated streaming POST', () => {
	beforeEach(() => {
		setSingleTabPolicyEnabled(true);
		setBrowserTabLeaderRole('follower');
	});

	afterEach(() => {
		setBrowserTabLeaderRole('leader');
		setSingleTabPolicyEnabled(true);
		vi.restoreAllMocks();
	});

	describe('axios createAPIClient request interceptor', () => {
		it('blocks gated POST on follower tab before adapter runs', async () => {
			const adapter: AxiosAdapter = vi.fn(
				(config: InternalAxiosRequestConfig) =>
					Promise.resolve({
						data: { ok: true },
						status: 200,
						statusText: 'OK',
						headers: {},
						config,
						request: {},
					})
			);

			const client = createAPIClient({ adapter, baseURL: '/api/v1' });
			await expect(
				client.post('/ewa/companion-chat/stream', { message: 'hi' })
			).rejects.toSatisfy((err: unknown) => {
				if (!(err instanceof Error)) return false;
				return err.message === FOLLOWER_TAB_PASSIVE_MODE;
			});
			expect(adapter).not.toHaveBeenCalled();
		});
	});

	describe('streamEwaCompanionChatMessage', () => {
		it('blocks follower tab before fetch', async () => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch');
			await expect(
				streamEwaCompanionChatMessage({ message: 'hello' }, {})
			).rejects.toThrow(FOLLOWER_TAB_PASSIVE_MODE);
			expect(fetchSpy).not.toHaveBeenCalled();
		});
	});

	describe('sendAssistantMessageStream', () => {
		it('blocks follower tab before fetch', async () => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch');
			const onError = vi.fn();
			await sendAssistantMessageStream('hello', {
				onToken: vi.fn(),
				onDone: vi.fn(),
				onError,
			});
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(onError).toHaveBeenCalledWith(FOLLOWER_TAB_PASSIVE_MODE);
		});
	});

	describe('streamDesktopAiChat', () => {
		it('blocks follower tab before fetch', async () => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch');
			await expect(
				streamDesktopAiChat(
					'chat-1',
					'hello',
					false,
					vi.fn<(delta: string) => void>()
				)
			).rejects.toThrow(FOLLOWER_TAB_PASSIVE_MODE);
			expect(fetchSpy).not.toHaveBeenCalled();
		});
	});
});
