/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import { computeCompanionBondFill } from '@/features/ewa/companionBondFill';

describe('computeCompanionBondFill', () => {
	it('keeps a short stub for brand-new friends', () => {
		const v = computeCompanionBondFill({
			companionRevision: 1,
			learnedPreferences: {},
		});
		expect(v).toBeGreaterThanOrEqual(0.06);
		expect(v).toBeLessThan(0.2);
	});

	it('does not saturate at moderate revision when memory is sparse', () => {
		const v = computeCompanionBondFill({
			companionRevision: 45,
			learnedPreferences: {
				companion_memory_v1: [
					{ content: 'Имя: po&T', importance: 0.9 },
					{ content: 'Любит кофе', importance: 0.7 },
				],
				ewa_companion_trust_v1: { score: 5 },
			},
		});
		expect(v).toBeGreaterThan(0.25);
		expect(v).toBeLessThan(0.75);
	});

	it('approaches full arc with rich memory, high trust, and long history', () => {
		const memories = Array.from({ length: 28 }, (_, i) => ({
			content: `fact ${i}`,
			importance: 0.8,
		}));
		const v = computeCompanionBondFill({
			companionRevision: 200,
			learnedPreferences: {
				companion_memory_v1: memories,
				ewa_companion_trust_v1: { score: 9 },
			},
		});
		expect(v).toBeGreaterThan(0.85);
	});
});
