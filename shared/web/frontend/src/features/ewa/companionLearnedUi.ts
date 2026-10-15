/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers to read **`companion_character_v1.mood`**, merge it with wire **`character_state`**, read the optional
 * **trust meter** baseline (**`ewa_companion_trust_v1`**, 0–10), and top lines from **`companion_memory_v1`** out of
 * `learned_preferences` for the desktop friend chat UI (`EwaCompanionChatPanel`). Strip length cap
 * ``EWA_COMPANION_MEMORY_STRIP_MAX_LINES`` matches API ``COMPANION_MEMORY_DISPLAY_MAX_LINES``.
 *
 * Invariants:
 * - Tolerant of JSON strings or nested objects; never throws.
 * - Rows with source **arlika_idle_amnesia** use optional ``idleAmnesiaLabel`` for the visible strip (i18n).
 *
 * Related:
 * - api/ewa_platform/companion/persona/character.py (`CHARACTER_NS`)
 * - api/ewa_platform/companion/memory/hcm_store.py (`MEMORY_NS`, durable facts in ``companion_memory_v1``)
 * - api/ewa_platform/companion/sidecar/trust_state.py (`ewa_companion_trust_v1`)
 */
import type { CompanionMoodBlock } from '@/features/ewa/companionPresence/companionMoodPalette';
import { normalizeLearnedPreferences } from '@/services/ewa/ewaCompanionChatApi';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';

export const COMPANION_CHARACTER_NS = 'companion_character_v1' as const;
/** Continuity micro-state (W1/W5) — decaying mood_tint, not HCM facts. */
export const COMPANION_CONTINUITY_NS = 'companion_continuity_v1' as const;
/** Mirrors ``TRUST_BASELINE_NS`` in ``api/ewa_platform/companion/sidecar/trust_state.py`` (0–10 meter). */
export const EWA_COMPANION_TRUST_BASELINE_NS =
	'ewa_companion_trust_v1' as const;
export const COMPANION_MEMORY_NS_V1 = 'companion_memory_v1' as const;
/** ``companion_memory_v1`` row source for Arlika idle auto-revert (localized strip in UI). */
export const COMPANION_MEMORY_SOURCE_IDLE_AMNESIA =
	'arlika_idle_amnesia' as const;
/** Matches server ``COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL`` for localized memory strip. */
export const EWA_COMPANION_MEMORY_IDLE_SENTINEL =
	'__ewa_idle_amnesia__' as const;
export const EWA_RUNTIME_CATALOG_PREFS_NS =
	'ewa_runtime_catalog_preferences_v1' as const;

function coerceRecord(raw: unknown): Record<string, unknown> | null {
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		return raw as Record<string, unknown>;
	}
	if (typeof raw === 'string') {
		try {
			const p = JSON.parse(raw) as unknown;
			if (p && typeof p === 'object' && !Array.isArray(p)) {
				return p as Record<string, unknown>;
			}
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_learned_json_coerce',
				'learned preferences JSON coerce failed',
				err
			);
			return null;
		}
	}
	return null;
}

/**
 * Continuity ``mood_tint`` for presence chip (null when missing / neutral).
 * Does not replace character mood scalars for palette blending.
 */
export function extractContinuityTintFromLearned(
	learned: unknown
): string | null {
	const lp = normalizeLearnedPreferences(learned);
	const block = coerceRecord(lp[COMPANION_CONTINUITY_NS]);
	const tint = String(block?.mood_tint || '')
		.trim()
		.toLowerCase();
	if (!tint || tint === 'neutral') return null;
	return tint;
}

/** Best-effort mood block for companion presence palette (`null` if absent). */
export function extractCompanionMoodFromLearned(
	learned: unknown
): CompanionMoodBlock | null {
	const lp = normalizeLearnedPreferences(learned);
	const block = coerceRecord(lp[COMPANION_CHARACTER_NS]);
	const moodRaw = block?.mood;
	if (!moodRaw || typeof moodRaw !== 'object' || Array.isArray(moodRaw)) {
		return null;
	}
	const m = moodRaw as Record<string, unknown>;
	const valence =
		typeof m.valence === 'number' && Number.isFinite(m.valence)
			? m.valence
			: null;
	const energy =
		typeof m.energy === 'number' && Number.isFinite(m.energy) ? m.energy : null;
	const tension =
		typeof m.tension === 'number' && Number.isFinite(m.tension)
			? m.tension
			: null;
	const confidence =
		typeof m.confidence === 'number' && Number.isFinite(m.confidence)
			? m.confidence
			: null;
	if (
		valence === null &&
		energy === null &&
		tension === null &&
		confidence === null
	)
		return null;
	return {
		...(valence !== null ? { valence } : {}),
		...(energy !== null ? { energy } : {}),
		...(tension !== null ? { tension } : {}),
		...(confidence !== null ? { confidence } : {}),
	};
}

/**
 * Merge mood scalars for UI: numeric fields from **`companion_character_v1`** in learned_preferences win when present;
 * otherwise fall back to **`profile.character_state.mood`** from the profile wire.
 */
export function mergeCompanionDisplayMood(
	learnedMood: CompanionMoodBlock | null,
	characterState: Record<string, unknown> | undefined
): CompanionMoodBlock | null {
	const cm =
		characterState &&
		typeof characterState === 'object' &&
		characterState.mood &&
		typeof characterState.mood === 'object' &&
		!Array.isArray(characterState.mood)
			? (characterState.mood as Record<string, unknown>)
			: null;
	const pick = (
		key: 'valence' | 'energy' | 'tension' | 'confidence'
	): number | null => {
		const fromLearned = learnedMood?.[key];
		if (typeof fromLearned === 'number' && Number.isFinite(fromLearned)) {
			return fromLearned;
		}
		const raw = cm?.[key];
		if (typeof raw === 'number' && Number.isFinite(raw)) {
			return raw;
		}
		return null;
	};
	const valence = pick('valence');
	const energy = pick('energy');
	const tension = pick('tension');
	const confidence = pick('confidence');
	if (
		valence === null &&
		energy === null &&
		tension === null &&
		confidence === null
	) {
		return null;
	}
	return {
		...(valence !== null ? { valence } : {}),
		...(energy !== null ? { energy } : {}),
		...(tension !== null ? { tension } : {}),
		...(confidence !== null ? { confidence } : {}),
	};
}

/** Server baseline companion trust meter **0–10** (`ewa_companion_trust_v1.score`), or null if absent. */
export function extractCompanionTrustMeterScore(
	learned: unknown
): number | null {
	const lp = normalizeLearnedPreferences(learned);
	const raw = lp[EWA_COMPANION_TRUST_BASELINE_NS];
	const obj = coerceRecord(raw);
	if (!obj) return null;
	const s = obj.score;
	const n =
		typeof s === 'number' && Number.isFinite(s)
			? s
			: typeof s === 'string'
				? Number.parseInt(s, 10)
				: NaN;
	if (!Number.isFinite(n)) return null;
	return Math.max(0, Math.min(10, Math.round(n)));
}

/** Cap for «Помнит о вас» / `memory_display` — must match `COMPANION_MEMORY_DISPLAY_MAX_LINES` in `memory.py`. */
export const EWA_COMPANION_MEMORY_STRIP_MAX_LINES = 32;

export type CompanionMemoryStripRow = {
	/** Stable DOM key (`content_hash` or synthetic catalog key). */
	key: string;
	/** Localized visible line for the strip. */
	label: string;
	/** ``companion_memory_v1`` row hash when the line is stored memory (not catalog synthesis). */
	contentHash: string | null;
	/** User may forget via ``DELETE …/memory/{content_hash}``. */
	forgettable: boolean;
};

function localizeMemoryStripLine(
	line: string,
	idleAmnesiaLabel?: string
): string {
	const trimmed = line.trim();
	if (
		trimmed === EWA_COMPANION_MEMORY_IDLE_SENTINEL &&
		typeof idleAmnesiaLabel === 'string' &&
		idleAmnesiaLabel.trim()
	) {
		return idleAmnesiaLabel.trim();
	}
	return trimmed;
}

function buildMemoryHashByDisplayKey(
	learned: unknown,
	idleAmnesiaLabel?: string
): Map<string, string> {
	const lp = normalizeLearnedPreferences(learned);
	let list: unknown = lp[COMPANION_MEMORY_NS_V1];
	if (typeof list === 'string') {
		try {
			list = JSON.parse(list) as unknown;
		} catch {
			return new Map();
		}
	}
	const out = new Map<string, string>();
	if (!Array.isArray(list)) return out;
	for (const item of list) {
		if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
		const r = item as Record<string, unknown>;
		const content = typeof r.content === 'string' ? r.content.trim() : '';
		if (!content) continue;
		const hash =
			typeof r.content_hash === 'string'
				? r.content_hash.trim().toLowerCase()
				: '';
		if (!hash) continue;
		const src =
			typeof r.source === 'string' ? r.source.trim().toLowerCase() : '';
		const displayKey =
			src === COMPANION_MEMORY_SOURCE_IDLE_AMNESIA
				? EWA_COMPANION_MEMORY_IDLE_SENTINEL
				: content;
		out.set(displayKey.trim().toLowerCase(), hash);
		const localized = localizeMemoryStripLine(displayKey, idleAmnesiaLabel);
		if (localized) out.set(localized.trim().toLowerCase(), hash);
	}
	return out;
}

/** Strip rows with optional forget hashes — prefers server ``memory_display`` order when provided. */
export function extractCompanionMemoryStripRows(
	learned: unknown,
	maxLines: number,
	idleAmnesiaLabel?: string,
	serverDisplayLines?: readonly string[] | null
): CompanionMemoryStripRow[] {
	const hashByDisplay = buildMemoryHashByDisplayKey(learned, idleAmnesiaLabel);
	const cap = Math.max(0, maxLines);

	const rowFromDisplayLine = (line: string): CompanionMemoryStripRow => {
		const label = localizeMemoryStripLine(line, idleAmnesiaLabel);
		const hash =
			hashByDisplay.get(line.trim().toLowerCase()) ??
			hashByDisplay.get(label.trim().toLowerCase()) ??
			null;
		return {
			key: hash ?? `syn:${label.trim().toLowerCase()}`,
			label,
			contentHash: hash,
			forgettable: Boolean(hash),
		};
	};

	if (
		Array.isArray(serverDisplayLines) &&
		serverDisplayLines.length > 0 &&
		cap > 0
	) {
		const seen = new Set<string>();
		const rows: CompanionMemoryStripRow[] = [];
		for (const line of serverDisplayLines) {
			if (typeof line !== 'string') continue;
			const row = rowFromDisplayLine(line);
			const dedupeKey = row.label.trim().toLowerCase();
			if (!dedupeKey || seen.has(dedupeKey)) continue;
			seen.add(dedupeKey);
			rows.push(row);
			if (rows.length >= cap) break;
		}
		return rows;
	}

	const lines = extractTopCompanionMemoryLines(learned, cap, idleAmnesiaLabel);
	return lines.map((label) => rowFromDisplayLine(label));
}

/** Top memories by **`importance`**, capped for a short UI strip. Optional **`idleAmnesiaLabel`** localizes idle-revert rows. */
export function extractTopCompanionMemoryLines(
	learned: unknown,
	maxLines: number,
	idleAmnesiaLabel?: string
): string[] {
	const lp = normalizeLearnedPreferences(learned);
	let list: unknown = lp[COMPANION_MEMORY_NS_V1];
	if (typeof list === 'string') {
		try {
			list = JSON.parse(list) as unknown;
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_memory_strip_parse',
				'companion_memory_v1 JSON parse failed',
				err
			);
			return [];
		}
	}
	type Row = { content: string; importance: number };
	const rows: Row[] = [];
	if (Array.isArray(list)) {
		for (const item of list) {
			if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
			const r = item as Record<string, unknown>;
			const c = typeof r.content === 'string' ? r.content.trim() : '';
			if (!c) continue;
			const srcRaw =
				typeof r.source === 'string' ? r.source.trim().toLowerCase() : '';
			const display =
				srcRaw === COMPANION_MEMORY_SOURCE_IDLE_AMNESIA &&
				typeof idleAmnesiaLabel === 'string' &&
				idleAmnesiaLabel.trim()
					? idleAmnesiaLabel.trim()
					: c;
			let importance = 0.5;
			if (typeof r.importance === 'number' && Number.isFinite(r.importance)) {
				importance = Math.min(1, Math.max(0, r.importance));
			}
			rows.push({ content: display, importance });
		}
	}
	const prefs = coerceRecord(lp[EWA_RUNTIME_CATALOG_PREFS_NS]);
	if (prefs) {
		const excludeContent = Array.isArray(prefs.exclude_content_types)
			? prefs.exclude_content_types.map(String)
			: [];
		const excludeMime = Array.isArray(prefs.exclude_mime_groups)
			? prefs.exclude_mime_groups.map(String)
			: [];
		const excludeExt = Array.isArray(prefs.extension_exclude)
			? prefs.extension_exclude.map(String)
			: [];
		if (excludeContent.includes('audio') || excludeMime.includes('audio')) {
			rows.push({
				content: 'Предпочитает видеть списки документов и файлов без аудио.',
				importance: 0.86,
			});
		}
		if (excludeExt.length > 0) {
			rows.push({
				content: `Предпочитает исключать из списков файлов расширения: ${[
					...new Set(excludeExt),
				]
					.sort()
					.join(', ')}.`,
				importance: 0.84,
			});
		}
	}
	const seen = new Set<string>();
	rows.sort((a, b) => b.importance - a.importance);
	return rows
		.map((x) => x.content)
		.filter((line) => {
			const key = line.trim().toLowerCase();
			if (!key || seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.slice(0, maxLines);
}
