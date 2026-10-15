/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for EWA companion HTTP client path constants (no network).
 *
 * Invariants:
 * - Paths stay aligned with EliteEW `api/ewa_platform/gateways/routers/companion_profile.py` mounts under `/api/v1/ewa`.
 *
 * Related:
 * - src/services/ewa/ewaCompanionProfileApi.ts
 * - shared/api/ewa_platform/gateways/routers/companion_profile.py
 */
import { describe, expect, it } from 'vitest';
import {
	EWA_COMPANION_AGENTIC_AUTONOMY_PREF_KEY,
	EWA_COMPANION_PROFILE_PATH,
	mergeEwaCompanionAutoAcceptTasksPref,
	normalizeCompanionProfileOut,
	readEwaCompanionAutoAcceptTasksPref,
} from '../ewaCompanionProfileApi';

describe('EWA companion profile client contract', () => {
	it('uses hand-written paths aligned with ewa_companion router', () => {
		expect(EWA_COMPANION_PROFILE_PATH).toBe('/ewa/companion-profile');
	});

	it('reads and merges agentic auto-accept tumbler pref (default off)', () => {
		expect(readEwaCompanionAutoAcceptTasksPref(undefined)).toBe(false);
		expect(readEwaCompanionAutoAcceptTasksPref({})).toBe(false);
		expect(
			readEwaCompanionAutoAcceptTasksPref({
				[EWA_COMPANION_AGENTIC_AUTONOMY_PREF_KEY]: {
					auto_accept_tasks: true,
				},
			})
		).toBe(true);
		const merged = mergeEwaCompanionAutoAcceptTasksPref({ keep_me: 1 }, true);
		expect(merged.keep_me).toBe(1);
		expect(merged[EWA_COMPANION_AGENTIC_AUTONOMY_PREF_KEY]).toEqual({
			auto_accept_tasks: true,
		});
	});

	it('normalizeCompanionProfileOut ensures required nested preference blobs', () => {
		const normalized = normalizeCompanionProfileOut({
			principal_id: 'p-1',
			schema_version: '1',
			seed_persona_id: 'mela',
			companion_revision: 2,
			updated_at: null,
			voice_enabled: false,
			reactive_chrome_enabled: true,
			character_state: {
				mood: { valence: 0, energy: 0, tension: 0, confidence: 0 },
				bond: { trust: 0, familiarity: 0, repair_need: 0 },
				interaction_style: {
					answer_length: 0,
					initiative: 0,
					reassurance: 0,
				},
			},
		});
		expect(normalized.baseline).toEqual({});
		expect(normalized.learned_preferences).toEqual({});
		expect(normalized.style_parameters).toEqual({});
		expect(normalized.memory_display).toEqual([]);
	});
});
