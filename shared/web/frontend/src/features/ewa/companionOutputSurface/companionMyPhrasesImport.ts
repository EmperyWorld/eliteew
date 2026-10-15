/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse and validate «Мои фразы» import JSON (U2.9) — symmetric to `companionMyPhrasesExport.ts`.
 *
 * Invariants:
 * - Only `eliteew.companion.my_phrases` v1 files; phrase fields match quick-actions API limits.
 * - Icon overrides must match curated palette (`COMPANION_MY_PHRASE_ICON_OPTIONS`).
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/companionMyPhrasesExport.ts
 */

import {
	COMPANION_MY_PHRASES_EXPORT_FORMAT,
	COMPANION_MY_PHRASES_EXPORT_VERSION,
	type CompanionMyPhrasesExportPhrase,
} from '@/features/ewa/companionOutputSurface/companionMyPhrasesExport';
import { COMPANION_MY_PHRASE_ICON_OPTIONS } from '@/features/ewa/companionOutputSurface/companionMyPhraseIconsStorage';
import type { MyPhraseIconOverride } from '@/features/ewa/companionOutputSurface/companionMyPhraseIconsStorage';
import { COMPANION_QUICK_PRESET_LABEL_MAX } from '@/features/ewa/companionOutputSurface/companionMyPhrasesUi';
import type { EwaIconId } from '@/features/ewa/ewaIcons/ewaIconCatalog';
import type { EwaIconTone } from '@/features/ewa/ewaIcons/EwaIcon';

export const COMPANION_MY_PHRASES_IMPORT_MAX = 50 as const;

const PROMPT_TEXT_MAX = 4000 as const;
const SORT_ORDER_MAX = 10_000 as const;

export type CompanionMyPhrasesImportPhrase = CompanionMyPhrasesExportPhrase;

export type CompanionMyPhrasesImportError =
	| 'invalid_json'
	| 'invalid_format'
	| 'unsupported_version'
	| 'empty'
	| 'too_many'
	| 'invalid_phrase';

export type CompanionMyPhrasesImportParseResult =
	| { ok: true; phrases: CompanionMyPhrasesImportPhrase[] }
	| { ok: false; error: CompanionMyPhrasesImportError };

export function companionMyPhraseImportFingerprint(
	label: string,
	promptText: string
): string {
	return `${label.trim().toLowerCase()}\n${promptText.trim()}`;
}

export function normalizeCompanionMyPhrasesImportIcon(
	raw: unknown
): MyPhraseIconOverride | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
	const row = raw as { icon?: unknown; tone?: unknown };
	const icon = typeof row.icon === 'string' ? row.icon.trim() : '';
	if (!icon) return undefined;
	const exact = COMPANION_MY_PHRASE_ICON_OPTIONS.find(
		(option) =>
			option.icon === icon &&
			(typeof row.tone !== 'string' || option.tone === row.tone.trim())
	);
	if (exact) return exact;
	const byIcon = COMPANION_MY_PHRASE_ICON_OPTIONS.find(
		(option) => option.icon === icon
	);
	if (!byIcon) return undefined;
	const tone =
		typeof row.tone === 'string' && row.tone.trim()
			? (row.tone.trim() as EwaIconTone)
			: byIcon.tone;
	return { icon: icon as EwaIconId, tone };
}

function coerceImportPhrase(
	raw: unknown,
	fallbackSortOrder: number
): CompanionMyPhrasesImportPhrase | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const row = raw as {
		label?: unknown;
		prompt_text?: unknown;
		sort_order?: unknown;
		icon?: unknown;
	};
	const label =
		typeof row.label === 'string'
			? row.label.trim().slice(0, COMPANION_QUICK_PRESET_LABEL_MAX)
			: '';
	const prompt_text =
		typeof row.prompt_text === 'string'
			? row.prompt_text.trim().slice(0, PROMPT_TEXT_MAX)
			: '';
	if (!label || !prompt_text) return null;
	let sort_order = fallbackSortOrder;
	if (typeof row.sort_order === 'number' && Number.isFinite(row.sort_order)) {
		sort_order = Math.min(
			SORT_ORDER_MAX,
			Math.max(0, Math.round(row.sort_order))
		);
	}
	const icon = normalizeCompanionMyPhrasesImportIcon(row.icon);
	const phrase: CompanionMyPhrasesImportPhrase = {
		label,
		prompt_text,
		sort_order,
	};
	if (icon) phrase.icon = icon;
	return phrase;
}

export function parseCompanionMyPhrasesImportJson(
	text: string
): CompanionMyPhrasesImportParseResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text) as unknown;
	} catch {
		return { ok: false, error: 'invalid_json' };
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return { ok: false, error: 'invalid_format' };
	}
	const file = parsed as {
		format?: unknown;
		version?: unknown;
		phrases?: unknown;
	};
	if (file.format !== COMPANION_MY_PHRASES_EXPORT_FORMAT) {
		return { ok: false, error: 'invalid_format' };
	}
	if (file.version !== COMPANION_MY_PHRASES_EXPORT_VERSION) {
		return { ok: false, error: 'unsupported_version' };
	}
	if (!Array.isArray(file.phrases)) {
		return { ok: false, error: 'invalid_format' };
	}
	if (file.phrases.length === 0) {
		return { ok: false, error: 'empty' };
	}
	if (file.phrases.length > COMPANION_MY_PHRASES_IMPORT_MAX) {
		return { ok: false, error: 'too_many' };
	}
	const phrases: CompanionMyPhrasesImportPhrase[] = [];
	for (let index = 0; index < file.phrases.length; index++) {
		const row = coerceImportPhrase(file.phrases[index], (index + 1) * 10);
		if (!row) {
			return { ok: false, error: 'invalid_phrase' };
		}
		phrases.push(row);
	}
	phrases.sort((a, b) => a.sort_order - b.sort_order);
	return { ok: true, phrases };
}

/** Dedupe against existing presets and within the import batch. */
export function filterCompanionMyPhrasesImportCreates(
	phrases: readonly CompanionMyPhrasesImportPhrase[],
	existingFingerprints: ReadonlySet<string>
): { toCreate: CompanionMyPhrasesImportPhrase[]; skipped: number } {
	const seen = new Set(existingFingerprints);
	const toCreate: CompanionMyPhrasesImportPhrase[] = [];
	let skipped = 0;
	for (const phrase of phrases) {
		const fp = companionMyPhraseImportFingerprint(
			phrase.label,
			phrase.prompt_text
		);
		if (seen.has(fp)) {
			skipped += 1;
			continue;
		}
		seen.add(fp);
		toCreate.push(phrase);
	}
	return { toCreate, skipped };
}
