/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for turn-plan human labels (plan 15 R06).
 */

import { describe, expect, it, vi } from 'vitest';

import {
	resolveTurnPlanToolLabel,
	sanitizeTurnPlanHint,
} from '@/features/ewa/companionTurnPlanUi';

describe('companionTurnPlanUi', () => {
	const t = vi.fn(
		(key: string) => key
	) as unknown as import('i18next').TFunction<'marketing'>;

	it('sanitizeTurnPlanHint strips orchestrator jargon', () => {
		expect(
			sanitizeTurnPlanHint('Next: `music_generation_xl_base` via run_id')
		).not.toMatch(/run_id|music_generation_xl_base/i);
	});

	it('resolveTurnPlanToolLabel never returns raw snake_case id', () => {
		const label = resolveTurnPlanToolLabel(t, 'music_generation');
		expect(label).not.toMatch(/^music_generation$/);
		expect(label.length).toBeGreaterThan(0);
	});
});
