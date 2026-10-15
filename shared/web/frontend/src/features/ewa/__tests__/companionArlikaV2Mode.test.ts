/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for **arlika_v2** sigil toggle eligibility (baseline gates + hostile v1 block).
 */
import { describe, expect, it } from 'vitest';
import {
	ARLIKA_V2_UNLOCKED_BASELINE_KEY,
	arlikaV2SigilToggleTarget,
	canToggleArlikaV2ModeViaSigil,
	isArlikaV2ModeEligible,
} from '@/features/ewa/companionArlikaV2Mode';

describe('companionArlikaV2Mode', () => {
	it('blocks toggle on hostile arlika v1', () => {
		expect(
			canToggleArlikaV2ModeViaSigil({
				seed_persona_id: 'arlika',
				baseline: { [ARLIKA_V2_UNLOCKED_BASELINE_KEY]: true },
			})
		).toBe(false);
	});

	it('allows toggle when arlika v2 unlocked in baseline', () => {
		expect(
			isArlikaV2ModeEligible({
				baseline: { [ARLIKA_V2_UNLOCKED_BASELINE_KEY]: true },
			})
		).toBe(true);
		expect(
			canToggleArlikaV2ModeViaSigil({
				seed_persona_id: 'mela',
				baseline: { [ARLIKA_V2_UNLOCKED_BASELINE_KEY]: true },
			})
		).toBe(true);
	});

	it('allows toggle back from arlika_v2 even without unlock flag', () => {
		expect(
			canToggleArlikaV2ModeViaSigil({
				seed_persona_id: 'arlika_v2',
				baseline: {},
			})
		).toBe(true);
		expect(arlikaV2SigilToggleTarget({ seed_persona_id: 'arlika_v2' })).toBe(
			'companion'
		);
	});

	it('targets arlika_v2 from companion seed when eligible', () => {
		expect(arlikaV2SigilToggleTarget({ seed_persona_id: 'mela' })).toBe(
			'arlika_v2'
		);
	});
});
