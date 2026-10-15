/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract test for sync companion chat responses carrying an output surface.
 *
 * Invariants:
 * - Sync POST and SSE final payloads both preserve `output_surface` for surface-first UI routing.
 *
 * Related:
 * - ../ewaCompanionChatApi
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
	post: vi.fn(),
}));

vi.mock('@/services/api/client', () => ({
	APIError: class APIError extends Error {},
	apiClient: {
		post: hoisted.post,
	},
}));

vi.mock('@/pages/MarketingCabinet/marketingCabinetApi/config', () => ({
	API_OPTIONS: { baseURL: '/api/v1' },
}));

vi.mock('@/services/authSession', () => ({
	getAuthHeader: () => ({}),
}));

import { postEwaCompanionChatMessage } from '../ewaCompanionChatApi';

describe('postEwaCompanionChatMessage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('preserves output_surface from sync responses', async () => {
		hoisted.post.mockResolvedValue({
			data: {
				reply: 'В каталоге EwaFile 1 файл.',
				companion_revision: 2,
				actions: [],
				output_surface: {
					mode: 'file_list',
					payload: {
						items: [{ unifiedContentId: 'uc-1', title: 'alpha.md' }],
					},
				},
			},
		});

		const response = await postEwaCompanionChatMessage({
			message: 'покажи список файлов',
		});

		expect(hoisted.post).toHaveBeenCalledWith(
			'/ewa/companion-chat/message',
			{ message: 'покажи список файлов' },
			expect.any(Object)
		);
		expect(response.output_surface).toEqual({
			mode: 'file_list',
			payload: {
				items: [{ unifiedContentId: 'uc-1', title: 'alpha.md' }],
			},
		});
	});
});
