/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for EWA companion profile quick action preset API helpers.
 *
 * Invariants:
 * - No network calls; verifies paths and request bodies only.
 *
 * Related:
 * - src/services/ewa/ewaCompanionProfileApi.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
	patch: vi.fn(),
	delete: vi.fn(),
}));

vi.mock('@/services/api/client', () => ({
	apiClient: {
		get: hoisted.get,
		post: hoisted.post,
		patch: hoisted.patch,
		delete: hoisted.delete,
	},
}));

vi.mock('@/pages/MarketingCabinet/marketingCabinetApi/config', () => ({
	API_OPTIONS: { baseURL: '/api/v1' },
}));

import {
	createEwaCompanionQuickPreset,
	deleteEwaCompanionQuickPreset,
	listEwaCompanionQuickPresets,
	patchEwaCompanionQuickPreset,
} from '../ewaCompanionProfileApi';

describe('EWA companion quick preset API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		hoisted.get.mockResolvedValue({ data: [] });
		hoisted.post.mockResolvedValue({ data: { id: 'p1' } });
		hoisted.patch.mockResolvedValue({ data: { id: 'p1' } });
		hoisted.delete.mockResolvedValue({ data: { ok: true } });
	});

	it('lists quick presets under companion profile route', async () => {
		await listEwaCompanionQuickPresets();
		expect(hoisted.get).toHaveBeenCalledWith(
			'/ewa/companion-profile/quick-actions',
			expect.objectContaining({
				baseURL: '/api/v1',
				params: expect.objectContaining({ _: expect.any(Number) }),
				headers: expect.objectContaining({
					'Cache-Control': 'no-cache',
				}),
			})
		);
	});

	it('creates, patches and deletes quick presets', async () => {
		await createEwaCompanionQuickPreset({
			label: 'Docs only',
			prompt_text: 'Покажи документы без аудио',
			sort_order: 0,
		});
		expect(hoisted.post).toHaveBeenCalledWith(
			'/ewa/companion-profile/quick-actions',
			{
				label: 'Docs only',
				prompt_text: 'Покажи документы без аудио',
				sort_order: 0,
			},
			expect.any(Object)
		);

		await patchEwaCompanionQuickPreset('preset/1', { label: 'Docs' });
		expect(hoisted.patch).toHaveBeenCalledWith(
			'/ewa/companion-profile/quick-actions/preset%2F1',
			{ label: 'Docs' },
			expect.any(Object)
		);

		await deleteEwaCompanionQuickPreset('preset/1');
		expect(hoisted.delete).toHaveBeenCalledWith(
			'/ewa/companion-profile/quick-actions/preset%2F1',
			expect.any(Object)
		);
	});
});
