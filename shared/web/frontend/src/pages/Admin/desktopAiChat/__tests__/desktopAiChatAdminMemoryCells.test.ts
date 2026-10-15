/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	mergeMemoryCellsForm,
	readMemoryCellsForm,
} from '../desktopAiChatAdminMemoryCells';

describe('desktopAiChatAdminMemoryCells', () => {
	it('reads defaults with clamps', () => {
		const form = readMemoryCellsForm({
			memory_cells_enabled: false,
			memory_cells_max_per_user: 99,
			memory_cells_min_score: 1.5,
		});
		expect(form.enabled).toBe(false);
		expect(form.maxPerUser).toBe(5);
		expect(form.minScore).toBe(1);
	});

	it('merges only memory_cells_* keys over base', () => {
		const next = mergeMemoryCellsForm(
			{ feature_enabled: true, memory_cells_enabled: true },
			{
				enabled: false,
				maxPerUser: 2,
				maxMessages: 100,
				maxChunks: 64,
				retrievalTopK: 4,
				minScore: 0.3,
			}
		);
		expect(next.feature_enabled).toBe(true);
		expect(next.memory_cells_enabled).toBe(false);
		expect(next.memory_cells_max_per_user).toBe(2);
		expect(next.memory_cells_retrieval_top_k).toBe(4);
	});
});
