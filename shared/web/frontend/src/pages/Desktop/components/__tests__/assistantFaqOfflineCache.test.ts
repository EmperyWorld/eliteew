/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for K17 FAQ fetch-with-offline-cache queryFn helper.
 *
 * Related:
 * - pages/Desktop/components/assistantQueryOptions.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantFaqEntry } from '../../services/productDesktopApi';
import {
	ASSISTANT_FAQ_CATALOG_STORAGE_KEY,
	readAssistantFaqCatalog,
} from '../../utils/assistantFaqCatalogStorage';

const sample: AssistantFaqEntry[] = [
	{
		id: '22222222-2222-2222-2222-222222222222',
		question: 'Q',
		answer: 'A',
		sort_order: 0,
	},
];

vi.mock('../../services/productDesktopApi', async () => {
	const actual = await vi.importActual<
		typeof import('../../services/productDesktopApi')
	>('../../services/productDesktopApi');
	return {
		...actual,
		fetchAssistantFaq: vi.fn(),
	};
});

import { fetchAssistantFaq } from '../../services/productDesktopApi';
import { fetchAssistantFaqWithOfflineCache } from '../assistantQueryOptions';

describe('fetchAssistantFaqWithOfflineCache', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.mocked(fetchAssistantFaq).mockReset();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('persists catalog on successful fetch', async () => {
		vi.mocked(fetchAssistantFaq).mockResolvedValue(sample);
		await expect(fetchAssistantFaqWithOfflineCache()).resolves.toEqual(sample);
		expect(readAssistantFaqCatalog()).toEqual(sample);
	});

	it('returns cache when fetch fails', async () => {
		localStorage.setItem(
			ASSISTANT_FAQ_CATALOG_STORAGE_KEY,
			JSON.stringify({
				saved_at: '2026-08-13T00:00:00.000Z',
				entries: sample,
			})
		);
		vi.mocked(fetchAssistantFaq).mockRejectedValue(new Error('offline'));
		await expect(fetchAssistantFaqWithOfflineCache()).resolves.toEqual(sample);
	});

	it('rethrows when fetch fails and cache is empty', async () => {
		vi.mocked(fetchAssistantFaq).mockRejectedValue(new Error('offline'));
		await expect(fetchAssistantFaqWithOfflineCache()).rejects.toThrow(
			'offline'
		);
	});
});
