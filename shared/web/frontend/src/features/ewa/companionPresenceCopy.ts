/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pick **persona- and mood-aware** micro-copy for the companion chat header (role line, «рядом» / «думает», optional mood
 * chip) from i18n arrays under `ewaCompanion.personaHeader.*`. Mood scalars choose the emotional band, while
 * `rotationSalt` keeps visible thoughts from freezing on a single phrase. The mood chip uses short
 * `personaMood.*` labels only — never long `ambient` lines (those stay out of the compact UI chip).
 *
 * Invariants:
 * - Tolerates missing i18n arrays — falls back to catalog role line and legacy `presenceOnline` / `presenceThinking`.
 * - Pure aside from `t()`; safe for SSR-free desktop bundle.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/i18n/locales/{ru,en}/marketing.json (`personaHeader`, `personaMood`)
 */
import type { EwaPersonaId } from '@/features/ewa/ewaPersonaCatalog';
import type { CompanionMoodBlock } from '@/features/ewa/companionPresence/companionMoodPalette';
import type { TFunction } from 'i18next';

function fnv1a32(input: string): number {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function readStringArray(
	t: TFunction,
	personaId: EwaPersonaId,
	slot: 'roles' | 'here' | 'thinking' | 'ambient'
): string[] {
	const raw = t(`ewaCompanion.personaHeader.${personaId}.${slot}`, {
		returnObjects: true,
	});
	return Array.isArray(raw) && raw.every((x) => typeof x === 'string')
		? (raw as string[]).filter((s) => s.trim().length > 0)
		: [];
}

export type CompanionHeaderCopy = {
	roleLine: string;
	presenceMicro: string;
};

/**
 * @param rotationSalt — when **`mood`** is absent: e.g. `companion_revision + tick` for idle variety.
 */
export function pickCompanionHeaderCopy(
	t: TFunction,
	personaId: EwaPersonaId,
	mood: CompanionMoodBlock | null,
	presence: 'online' | 'thinking',
	rotationSalt: number,
	fallbackRoleLine: string
): CompanionHeaderCopy {
	const roles = readStringArray(t, personaId, 'roles');
	const here = readStringArray(t, personaId, 'here');
	const thinking = readStringArray(t, personaId, 'thinking');

	const moodBand = (() => {
		if (!mood) return 0;
		const tension =
			typeof mood.tension === 'number' && Number.isFinite(mood.tension)
				? mood.tension
				: 0.1;
		const valence =
			typeof mood.valence === 'number' && Number.isFinite(mood.valence)
				? mood.valence
				: 0;
		if (tension >= 0.35) return 3;
		if (valence >= 0.35) return 1;
		if (valence <= -0.35) return 2;
		return 0;
	})();

	const hasMoodScalars =
		Boolean(mood) &&
		(['valence', 'energy', 'tension', 'confidence'] as const).some(
			(k) => typeof mood?.[k] === 'number' && Number.isFinite(mood[k] as number)
		);

	const hashInput =
		hasMoodScalars && mood
			? `${personaId}:mb=${moodBand}:pr=${presence}:r=${rotationSalt}:t=${typeof mood.tension === 'number' ? mood.tension : 'x'}:v=${typeof mood.valence === 'number' ? mood.valence : 'x'}:e=${typeof mood.energy === 'number' ? mood.energy : 'x'}:c=${typeof mood.confidence === 'number' ? mood.confidence : 'x'}`
			: `${personaId}:${rotationSalt}:${moodBand}:${presence}`;

	const h = fnv1a32(hashInput);

	const rolePool = roles.length > 0 ? roles : [fallbackRoleLine];
	const roleLine = rolePool[h % rolePool.length] ?? fallbackRoleLine;

	const fallbackHere = t('ewaCompanion.presenceOnline');
	const fallbackThink = t('ewaCompanion.presenceThinking');

	if (presence === 'thinking') {
		const pool = thinking.length > 0 ? thinking : [fallbackThink];
		return {
			roleLine,
			presenceMicro: pool[h % pool.length] ?? fallbackThink,
		};
	}

	const pool = here.length > 0 ? here : [fallbackHere];
	return {
		roleLine,
		presenceMicro: pool[h % pool.length] ?? fallbackHere,
	};
}

/** Mood chip: short personaMood label only (never long personaHeader.ambient lines). */
export function pickCompanionMoodChipLabel(
	t: TFunction,
	personaId: EwaPersonaId,
	displayMood: CompanionMoodBlock | null,
	_rotationSalt: number,
	continuityTint?: string | null
): string | null {
	const readPersonaMood = (
		suffix: 'tensionHigh' | 'warm' | 'quiet' | 'steady'
	): string => {
		const key = `ewaCompanion.personaMood.${personaId}.${suffix}` as const;
		const specific = t(key);
		if (specific && specific !== key) return specific;
		return t(`ewaCompanion.personaMood.fallback.${suffix}`);
	};

	// Continuity micro-tint wins chip copy when present (W5c).
	const tint = (continuityTint || '').trim().toLowerCase();
	if (tint && tint !== 'neutral') {
		if (tint === 'tense' || tint === 'focus')
			return readPersonaMood('tensionHigh');
		if (tint === 'grief') return readPersonaMood('quiet');
		if (
			tint === 'warm' ||
			tint === 'focused_warm' ||
			tint === 'playful' ||
			tint === 'ironic_soft'
		) {
			return readPersonaMood('warm');
		}
		return readPersonaMood('steady');
	}

	if (displayMood) {
		const tension =
			typeof displayMood.tension === 'number' &&
			Number.isFinite(displayMood.tension)
				? displayMood.tension
				: 0.1;
		const valence =
			typeof displayMood.valence === 'number' &&
			Number.isFinite(displayMood.valence)
				? displayMood.valence
				: 0;

		if (tension >= 0.35) return readPersonaMood('tensionHigh');
		if (valence >= 0.35) return readPersonaMood('warm');
		if (valence <= -0.35) return readPersonaMood('quiet');
		return readPersonaMood('steady');
	}

	return readPersonaMood('steady');
}
