/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read-and-clear Professional Worlds cross-app draft capsules from `sessionStorage` and map them to EWRP form fields.
 *
 * Invariants:
 * - Consumes the storage key once (read + remove); invalid JSON yields `null`.
 * - Does not auto-start generation — only prefills the create form.
 *
 * Related:
 * - `features/professional-worlds/desktop/openProfessionalDraftDestination.ts`
 * - `api/services/professional_worlds/cross_app_draft_adapters.py`
 */

import { EWRP_EXTRA_CONTEXT_MAX } from './EwrpGeneratorChunks';

/** Mapped form values for {@link EWRPGeneratorMain} after PW draft hydration. */
export type EwrpProfessionalWorldsDraftHydration = {
	readonly topic: string;
	readonly title: string;
	readonly extraContext: string;
	readonly sourceUnifiedContentId?: string;
	readonly crossAppLinkId?: string;
};

function trimOrEmpty(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function readStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => (typeof item === 'string' ? item.trim() : ''))
		.filter(Boolean);
}

function buildExtraContextFromCapsule(raw: Record<string, unknown>): string {
	const presentation =
		raw.presentation && typeof raw.presentation === 'object'
			? (raw.presentation as Record<string, unknown>)
			: null;
	const property =
		raw.property && typeof raw.property === 'object'
			? (raw.property as Record<string, unknown>)
			: null;

	const parts: string[] = [];
	const outline = trimOrEmpty(presentation?.outline_markdown);
	if (outline) parts.push(outline);

	const city = trimOrEmpty(property?.city);
	const titleHint = trimOrEmpty(property?.title_hint);
	if (city && titleHint) {
		parts.push(`Город: ${city}`);
	} else if (city) {
		parts.push(`Город: ${city}`);
	}

	const joined = parts.join('\n\n').trim();
	if (joined.length <= EWRP_EXTRA_CONTEXT_MAX) return joined;
	return joined.slice(0, EWRP_EXTRA_CONTEXT_MAX);
}

/**
 * Parse a PW EWRP draft capsule (see `build_ewrp_draft_adapter` on the API).
 */
export function parseEwrpProfessionalWorldsDraftCapsule(
	raw: unknown
): EwrpProfessionalWorldsDraftHydration | null {
	if (!raw || typeof raw !== 'object') return null;
	const capsule = raw as Record<string, unknown>;
	if (trimOrEmpty(capsule.destination) !== 'ewrp') return null;

	const presentation =
		capsule.presentation && typeof capsule.presentation === 'object'
			? (capsule.presentation as Record<string, unknown>)
			: null;
	const property =
		capsule.property && typeof capsule.property === 'object'
			? (capsule.property as Record<string, unknown>)
			: null;

	const presentationTitle = trimOrEmpty(presentation?.title);
	const titleHint = trimOrEmpty(property?.title_hint);
	const topic = titleHint || presentationTitle;
	if (!topic) return null;

	const mediaIds = readStringList(capsule.media_unified_content_ids);
	const extraContext = buildExtraContextFromCapsule(capsule);
	const crossAppLinkId = trimOrEmpty(capsule.cross_app_link_id) || undefined;

	return {
		topic,
		title: presentationTitle || topic,
		extraContext,
		...(mediaIds[0] ? { sourceUnifiedContentId: mediaIds[0] } : {}),
		...(crossAppLinkId ? { crossAppLinkId } : {}),
	};
}

/**
 * Read PW draft from `sessionStorage`, remove the key, return mapped form values.
 */
export function consumeEwrpProfessionalWorldsDraft(
	storageKey: string | undefined
): EwrpProfessionalWorldsDraftHydration | null {
	if (typeof window === 'undefined') return null;
	const key = trimOrEmpty(storageKey);
	if (!key) return null;
	try {
		const raw = sessionStorage.getItem(key);
		sessionStorage.removeItem(key);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		return parseEwrpProfessionalWorldsDraftCapsule(parsed);
	} catch {
		return null;
	}
}
