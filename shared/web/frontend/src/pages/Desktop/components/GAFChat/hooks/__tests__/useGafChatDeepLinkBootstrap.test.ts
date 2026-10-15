/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for GAF Chat deep-link bootstrap (chatId vs username precedence, one-shot).
 *
 * Invariants:
 * - When both chatId and username are set, chatId wins and username open is not called.
 * - Each initial target applies at most once (stale remount of the same props is a no-op).
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/hooks/useGafChatDeepLinkBootstrap.ts
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGafChatDeepLinkBootstrap } from '../useGafChatDeepLinkBootstrap';

const getOrCreateChatByUsername = vi.fn();
const invalidateQueries = vi.fn(() => Promise.resolve());

vi.mock('@/i18n/config', () => ({}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
	toast: {
		error: vi.fn(),
		info: vi.fn(),
		success: vi.fn(),
		message: vi.fn(),
	},
}));

vi.mock('@tanstack/react-query', () => ({
	useQueryClient: () => ({
		invalidateQueries,
	}),
}));

vi.mock('../../api/gafChatApi', () => ({
	gafChatQueryKeys: {
		chats: ['gaf', 'chats'] as const,
	},
	getOrCreateChatByUsername: (...args: unknown[]) =>
		getOrCreateChatByUsername(...args),
}));

describe('useGafChatDeepLinkBootstrap', () => {
	beforeEach(() => {
		getOrCreateChatByUsername.mockReset();
		invalidateQueries.mockClear();
		getOrCreateChatByUsername.mockResolvedValue({ chat_id: 'from-username' });
	});

	it('selects chatId and skips username open when both are set (dual-flag)', async () => {
		const setSelectedChatId = vi.fn();
		const setPendingAttachments = vi.fn();
		const setInputText = vi.fn();
		const t = ((key: string) => key) as never;

		const { result } = renderHook(() =>
			useGafChatDeepLinkBootstrap({
				t,
				user: { id: 'u1' },
				initialTargetChatId: ' chat-from-id ',
				initialTargetUsername: 'alice',
				selectedChatId: null,
				setSelectedChatId,
				setPendingAttachments,
				setInputText,
				chatsLoading: false,
				chatsError: null,
				chatsLength: 0,
			})
		);

		await waitFor(() => {
			expect(setSelectedChatId).toHaveBeenCalledWith('chat-from-id');
		});

		expect(getOrCreateChatByUsername).not.toHaveBeenCalled();
		expect(result.current.appliedInitialChatIdRef.current).toBe(true);
		expect(result.current.appliedInitialUsernameRef.current).toBe(true);
	});

	it('opens by username once and ignores stale remount of the same username', async () => {
		const setSelectedChatId = vi.fn();
		const setPendingAttachments = vi.fn();
		const setInputText = vi.fn();
		const t = ((key: string) => key) as never;

		const { result, rerender } = renderHook(
			(props: { username?: string }) =>
				useGafChatDeepLinkBootstrap({
					t,
					user: { id: 'u1' },
					initialTargetUsername: props.username,
					selectedChatId: null,
					setSelectedChatId,
					setPendingAttachments,
					setInputText,
					chatsLoading: false,
					chatsError: null,
					chatsLength: 0,
				}),
			{ initialProps: { username: 'bob' } }
		);

		await waitFor(() => {
			expect(getOrCreateChatByUsername).toHaveBeenCalledTimes(1);
		});
		expect(getOrCreateChatByUsername).toHaveBeenCalledWith('bob');

		await waitFor(() => {
			expect(setSelectedChatId).toHaveBeenCalledWith('from-username');
		});

		expect(result.current.appliedInitialUsernameRef.current).toBe(true);

		act(() => {
			rerender({ username: 'bob' });
		});

		expect(getOrCreateChatByUsername).toHaveBeenCalledTimes(1);
	});
});
