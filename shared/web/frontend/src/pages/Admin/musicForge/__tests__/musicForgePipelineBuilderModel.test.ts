/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock parse helpers for MusicForge Pipeline Builder (atomization of model module).
 *
 * Invariants:
 * - parseModes sorts by sort_order and drops empty mode_key.
 *
 * Related:
 * - `pages/Admin/musicForge/musicForgePipelineBuilderModel.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	modeListLabel,
	parseModes,
	parseStages,
} from '../musicForgePipelineBuilderModel';

describe('musicForgePipelineBuilderModel', () => {
	it('parseModes sorts and filters', () => {
		const modes = parseModes({
			b: {
				mode_key: 'b',
				label_ru: 'Б',
				label_en: 'B',
				sort_order: 2,
				enabled: true,
				is_default: false,
				lane_key: 'sft_xl',
			},
			a: {
				mode_key: 'a',
				label_ru: 'А',
				label_en: 'A',
				sort_order: 1,
				enabled: true,
				is_default: true,
				lane_key: 'sft_xl',
			},
			empty: { mode_key: '', sort_order: 0 },
		});
		expect(modes.map((m) => m.mode_key)).toEqual(['a', 'b']);
		const first = modes[0];
		expect(first).toBeDefined();
		if (!first) throw new Error('expected mode');
		expect(modeListLabel(first, 'def')).toContain('def');
	});

	it('parseStages sorts for a mode', () => {
		const stages = parseStages(
			{
				sft_xl: [
					{
						stage_key: 'z',
						stage_type: 'audio_comfy',
						title_ru: 'Z',
						sort_order: 2,
						enabled: true,
						settings: {},
					},
					{
						stage_key: 'a',
						stage_type: 'llm_generate',
						title_ru: 'A',
						sort_order: 1,
						enabled: true,
						settings: { prompt_kind: 'lyrics' },
					},
				],
			},
			'sft_xl'
		);
		expect(stages.map((s) => s.stage_key)).toEqual(['a', 'z']);
	});
});
