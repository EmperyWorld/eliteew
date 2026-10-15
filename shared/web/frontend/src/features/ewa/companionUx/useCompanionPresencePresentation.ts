/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presence palette, sigil state, bond fill, and rotating header copy for companion chat (U8.3 slice 12).
 *
 * Invariants:
 * - ``presence`` becomes ``thinking`` while a chat turn is pending; stream phase follows SSE token state.
 *
 * Related:
 * - src/features/ewa/companionPresence/companionMoodPalette.ts
 * - src/features/ewa/companionPresenceCopy.ts
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { TFunction } from 'i18next';

import { computeCompanionBondFill } from '@/features/ewa/companionBondFill';
import {
	extractCompanionMoodFromLearned,
	extractCompanionTrustMeterScore,
	extractContinuityTintFromLearned,
	mergeCompanionDisplayMood,
} from '@/features/ewa/companionLearnedUi';
import { buildCompanionPresencePalette } from '@/features/ewa/companionPresence/companionMoodPalette';
import type {
	CompanionPresenceState,
	CompanionStreamPhase,
} from '@/features/ewa/companionPresence/CompanionSigil';
import {
	pickCompanionHeaderCopy,
	pickCompanionMoodChipLabel,
} from '@/features/ewa/companionPresenceCopy';
import {
	getEwaPersonaById,
	isEwaPersonaId,
	DEFAULT_EWA_PERSONA_ID,
} from '@/features/ewa/ewaPersonaCatalog';
import type { EwaCompanionProfileOut } from '@/services/ewa/ewaCompanionProfileApi';

export type UseCompanionPresencePresentationOptions = {
	profile: Pick<
		EwaCompanionProfileOut,
		| 'learned_preferences'
		| 'character_state'
		| 'companion_revision'
		| 'memory_display'
	>;
	personaId: string;
	ru: boolean;
	pending: boolean;
	reducedMotion: boolean;
	streamingText: string;
	isDesktopWindowActive: boolean;
	t: TFunction<'marketing'>;
};

export function useCompanionPresencePresentation({
	profile,
	personaId,
	ru,
	pending,
	reducedMotion,
	streamingText,
	isDesktopWindowActive,
	t,
}: UseCompanionPresencePresentationOptions) {
	const resolvedPersonaId = isEwaPersonaId(personaId)
		? personaId
		: DEFAULT_EWA_PERSONA_ID;
	const persona = getEwaPersonaById(resolvedPersonaId);
	const displayName = ru ? persona.displayNameRu : persona.displayNameEn;
	const catalogRoleFallback = ru ? persona.roleRu : persona.roleEn;
	const arlikaPresence =
		resolvedPersonaId === 'arlika' || resolvedPersonaId === 'arlika_v2';

	const learnedMood = useMemo(
		() => extractCompanionMoodFromLearned(profile.learned_preferences),
		[profile.learned_preferences]
	);

	const continuityTint = useMemo(
		() => extractContinuityTintFromLearned(profile.learned_preferences),
		[profile.learned_preferences]
	);

	const displayMood = useMemo(
		() => mergeCompanionDisplayMood(learnedMood, profile.character_state),
		[learnedMood, profile.character_state]
	);

	const trustMeterScore = useMemo(
		() => extractCompanionTrustMeterScore(profile.learned_preferences),
		[profile.learned_preferences]
	);

	const bondRepairNeed = useMemo((): number | null => {
		const cs = profile.character_state;
		const bond =
			cs?.bond && typeof cs.bond === 'object' && !Array.isArray(cs.bond)
				? (cs.bond as Record<string, unknown>)
				: null;
		const r = bond?.repair_need;
		return typeof r === 'number' && Number.isFinite(r) ? r : null;
	}, [profile.character_state]);

	const paletteStyle = useMemo(
		() =>
			buildCompanionPresencePalette(resolvedPersonaId, displayMood, {
				trustMeterScore,
				repairNeed: bondRepairNeed,
			}) as CSSProperties,
		[resolvedPersonaId, displayMood, trustMeterScore, bondRepairNeed]
	);

	const [headerTick, setHeaderTick] = useState(0);
	useEffect(() => {
		if (!isDesktopWindowActive) return undefined;
		const id = window.setInterval(() => setHeaderTick((x) => x + 1), 42_000);
		return () => window.clearInterval(id);
	}, [isDesktopWindowActive]);

	const headerRotation = profile.companion_revision + headerTick;

	const presence: CompanionPresenceState = useMemo(() => {
		if (pending) return 'thinking';
		if (reducedMotion) return 'online';
		return 'online';
	}, [pending, reducedMotion]);

	const streamPhase: CompanionStreamPhase = useMemo(() => {
		if (!pending) return 'idle';
		return streamingText.trim() ? 'streaming' : 'waiting';
	}, [pending, streamingText]);

	const companionHeaderCopy = useMemo(
		() =>
			pickCompanionHeaderCopy(
				t,
				resolvedPersonaId,
				displayMood,
				presence,
				headerRotation,
				catalogRoleFallback
			),
		[
			t,
			resolvedPersonaId,
			displayMood,
			presence,
			headerRotation,
			catalogRoleFallback,
		]
	);

	const companionMoodChipLabel = useMemo(
		() =>
			pickCompanionMoodChipLabel(
				t,
				resolvedPersonaId,
				displayMood,
				headerRotation,
				continuityTint
			),
		[t, resolvedPersonaId, displayMood, headerRotation, continuityTint]
	);

	const presenceChipLabel = useMemo(
		() =>
			presence === 'thinking'
				? companionHeaderCopy.presenceMicro
				: (companionMoodChipLabel ?? companionHeaderCopy.presenceMicro),
		[presence, companionHeaderCopy.presenceMicro, companionMoodChipLabel]
	);

	const bond = useMemo(
		() =>
			computeCompanionBondFill({
				companionRevision: profile.companion_revision,
				learnedPreferences: profile.learned_preferences,
				memoryDisplay: profile.memory_display,
			}),
		[
			profile.companion_revision,
			profile.learned_preferences,
			profile.memory_display,
		]
	);

	return {
		personaId: resolvedPersonaId,
		arlikaPresence,
		displayName,
		catalogRoleLine: catalogRoleFallback,
		paletteStyle,
		presence,
		streamPhase,
		roleLine: companionHeaderCopy.roleLine,
		presenceChipLabel,
		companionMoodChipLabel,
		bond,
		headerRotation,
	};
}
