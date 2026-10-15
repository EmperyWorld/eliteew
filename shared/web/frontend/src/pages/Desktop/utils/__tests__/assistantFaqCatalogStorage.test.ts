/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Handbook FAQ catalog localStorage cache (K17).
 *
 * Related:
 * - pages/Desktop/utils/assistantFaqCatalogStorage.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AssistantFaqEntry } from '../../services/productDesktopApi';
import {
	ASSISTANT_FAQ_CATALOG_STORAGE_KEY,
	clearAssistantFaqCatalog,
	readAssistantFaqCatalog,
	readAssistantFaqCatalogSavedAt,
	writeAssistantFaqCatalog,
} from '../assistantFaqCatalogStorage';

const sample: AssistantFaqEntry[] = [
	{
		id: '11111111-1111-1111-1111-111111111111',
		question: 'Как открыть магазин?',
		answer: 'Через меню «Пуск».',
		sort_order: 1,
	},
];

describe('assistantFaqCatalogStorage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('round-trips FAQ catalog via localStorage', () => {
		writeAssistantFaqCatalog(sample);
		expect(readAssistantFaqCatalog()).toEqual(sample);
		expect(readAssistantFaqCatalogSavedAt()).toMatch(/^\d{4}-/);
	});

	it('clears cache when writing empty array', () => {
		writeAssistantFaqCatalog(sample);
		writeAssistantFaqCatalog([]);
		expect(localStorage.getItem(ASSISTANT_FAQ_CATALOG_STORAGE_KEY)).toBeNull();
		expect(readAssistantFaqCatalog()).toBeNull();
	});

	it('filters malformed entries on read', () => {
		localStorage.setItem(
			ASSISTANT_FAQ_CATALOG_STORAGE_KEY,
			JSON.stringify({
				saved_at: '2026-08-13T00:00:00.000Z',
				entries: [
					sample[0],
					{ id: 'bad', question: 1, answer: 'x', sort_order: 0 },
					'not-an-object',
				],
			})
		);
		expect(readAssistantFaqCatalog()).toEqual([sample[0]]);
	});

	it('clearAssistantFaqCatalog removes key', () => {
		writeAssistantFaqCatalog(sample);
		clearAssistantFaqCatalog();
		expect(readAssistantFaqCatalog()).toBeNull();
	});
});
