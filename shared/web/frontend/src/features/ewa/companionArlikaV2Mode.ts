/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client helpers for friendly **arlika_v2** chat-mode toggle (sigil click ↔ server switch).
 *
 * Invariants:
 * - Eligibility mirrors ``try_apply_arlika_v2_chat_mode_switch`` baseline gates on the API.
 * - Hostile **arlika** v1 never exposes toggle (calm revert first).
 *
 * Related:
 * - api/ewa_platform/companion/sidecar/arlika_v2_chat_switch.py
 * - src/services/ewa/ewaCompanionProfileApi.ts
 */
import {
	normalizeEwaPersonaId,
	type EwaPersonaId,
} from '@/features/ewa/ewaPersonaCatalog';
import type { EwaCompanionProfileOut } from '@/services/ewa/ewaCompanionProfileApi';

export const ARLIKA_V2_UNLOCKED_BASELINE_KEY =
	'ewa_companion_arlika_v2_unlocked_v1' as const;
export const NEXT_ARLIKA_TRANSFORM_V2_BASELINE_KEY =
	'ewa_companion_next_arlika_transform_is_v2_v1' as const;

function truthyBaselineFlag(raw: unknown): boolean {
	if (raw === true) return true;
	if (typeof raw === 'string') {
		const s = raw.trim().toLowerCase();
		return s === '1' || s === 'true' || s === 'yes' || s === 'on';
	}
	return false;
}

export function readArlikaV2Unlocked(
	baseline: Record<string, unknown> | null | undefined
): boolean {
	if (!baseline || typeof baseline !== 'object') return false;
	return truthyBaselineFlag(baseline[ARLIKA_V2_UNLOCKED_BASELINE_KEY]);
}

export function readNextArlikaTransformIsV2(
	baseline: Record<string, unknown> | null | undefined
): boolean {
	if (!baseline || typeof baseline !== 'object') return false;
	return truthyBaselineFlag(baseline[NEXT_ARLIKA_TRANSFORM_V2_BASELINE_KEY]);
}

/** True when baseline allows entering **arlika_v2** via chat or sigil toggle. */
export function isArlikaV2ModeEligible(
	profile: Pick<EwaCompanionProfileOut, 'baseline'>
): boolean {
	return (
		readArlikaV2Unlocked(profile.baseline) ||
		readNextArlikaTransformIsV2(profile.baseline)
	);
}

export function resolveCompanionPersonaId(
	seedPersonaId: string | null | undefined
): EwaPersonaId {
	return normalizeEwaPersonaId(seedPersonaId ?? '') ?? 'parent';
}

/** Sigil click toggles EWA ↔ **arlika_v2** when eligible or already in v2. */
export function canToggleArlikaV2ModeViaSigil(
	profile: Pick<EwaCompanionProfileOut, 'seed_persona_id' | 'baseline'>
): boolean {
	const personaId = resolveCompanionPersonaId(profile.seed_persona_id);
	if (personaId === 'arlika') return false;
	if (personaId === 'arlika_v2') return true;
	return isArlikaV2ModeEligible(profile);
}

export type ArlikaV2SigilToggleTarget = 'arlika_v2' | 'companion';

export function arlikaV2SigilToggleTarget(
	profile: Pick<EwaCompanionProfileOut, 'seed_persona_id'>
): ArlikaV2SigilToggleTarget {
	const personaId = resolveCompanionPersonaId(profile.seed_persona_id);
	return personaId === 'arlika_v2' ? 'companion' : 'arlika_v2';
}
