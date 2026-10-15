/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared consumer-side parser for Professional Worlds cross-app draft capsules persisted in sessionStorage.
 * It maps realtor draft payloads into destination app seed values without sending or publishing anything.
 *
 * Invariants:
 * - Reading a draft key consumes it once (`sessionStorage.removeItem`) so stale capsules are not replayed.
 * - Helpers never call network APIs or trigger publication/send side effects.
 *
 * Related:
 * - openProfessionalDraftDestination.ts
 * - shared/api/services/professional_worlds/cross_app_draft_adapters.py
 */

import { readCrossAppLinkId } from './reportProfessionalCrossAppDraftLifecycle';

export type ProfessionalWorldsDraftDestination =
	| 'ewrp'
	| 'site_studio'
	| 'gaf_chat'
	| 'ewdesk'
	| 'unified_content';

export type ProfessionalWorldsDraftCapsule = {
	destination?: ProfessionalWorldsDraftDestination | string;
	property?: {
		property_id?: string;
		title_hint?: string;
		city?: string | null;
	};
	presentation?: {
		title?: string;
		outline_markdown?: string;
	};
	page_sections?: unknown[];
	message_body_draft?: string;
	suggestion_markdown?: string;
	media_unified_content_ids?: string[];
	attachment_unified_content_ids?: string[];
	unified_content_link?: {
		unified_content_ids?: string[];
	};
};

export type ProfessionalWorldsGafDraft = {
	seed: string;
	crossAppLinkId?: string;
	attachment?: {
		contentId: string;
		fileName: string;
		size: number | null;
		mimeType: string | null;
	};
};

export type ProfessionalWorldsSiteStudioDraft = {
	siteTitle: string;
	siteTopic: string;
	brief: string;
	crossAppLinkId?: string;
};

export type ProfessionalWorldsEwDeskSuggestion = {
	title: string;
	markdown: string;
	crossAppLinkId?: string;
};

function trimString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function readObject(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function readStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map(trimString).filter(Boolean);
}

function normalizeCapsule(raw: unknown): ProfessionalWorldsDraftCapsule | null {
	const obj = readObject(raw);
	if (!obj) return null;
	const property = readObject(obj.property);
	const presentation = readObject(obj.presentation);
	const unifiedContentLink = readObject(obj.unified_content_link);
	return {
		destination: trimString(obj.destination),
		...(property
			? {
					property: {
						property_id: trimString(property.property_id),
						title_hint: trimString(property.title_hint),
						city: trimString(property.city) || null,
					},
				}
			: {}),
		...(presentation
			? {
					presentation: {
						title: trimString(presentation.title),
						outline_markdown: trimString(presentation.outline_markdown),
					},
				}
			: {}),
		page_sections: Array.isArray(obj.page_sections) ? obj.page_sections : [],
		message_body_draft: trimString(obj.message_body_draft),
		suggestion_markdown: trimString(obj.suggestion_markdown),
		media_unified_content_ids: readStringList(obj.media_unified_content_ids),
		attachment_unified_content_ids: readStringList(
			obj.attachment_unified_content_ids
		),
		...(unifiedContentLink
			? {
					unified_content_link: {
						unified_content_ids: readStringList(
							unifiedContentLink.unified_content_ids
						),
					},
				}
			: {}),
	};
}

export function consumeProfessionalWorldsCrossAppDraft(
	storageKey: string | undefined | null
): ProfessionalWorldsDraftCapsule | null {
	if (typeof window === 'undefined') return null;
	const key = trimString(storageKey);
	if (!key) return null;
	try {
		const raw = sessionStorage.getItem(key);
		sessionStorage.removeItem(key);
		if (!raw) return null;
		return normalizeCapsule(JSON.parse(raw));
	} catch {
		return null;
	}
}

function firstUnifiedContentId(
	capsule: ProfessionalWorldsDraftCapsule
): string {
	return (
		capsule.attachment_unified_content_ids?.[0] ??
		capsule.media_unified_content_ids?.[0] ??
		capsule.unified_content_link?.unified_content_ids?.[0] ??
		''
	);
}

function propertyTitle(capsule: ProfessionalWorldsDraftCapsule): string {
	return (
		capsule.property?.title_hint ||
		capsule.presentation?.title ||
		'Professional Worlds draft'
	);
}

export function professionalWorldsDraftToGaf(
	capsule: ProfessionalWorldsDraftCapsule | null
): ProfessionalWorldsGafDraft | null {
	if (!capsule) return null;
	const seed =
		trimString(capsule.message_body_draft) ||
		trimString(capsule.suggestion_markdown) ||
		trimString(capsule.presentation?.outline_markdown);
	if (!seed) return null;
	const contentId = firstUnifiedContentId(capsule);
	const crossAppLinkId = readCrossAppLinkId(capsule) ?? undefined;
	return {
		seed,
		...(crossAppLinkId ? { crossAppLinkId } : {}),
		...(contentId
			? {
					attachment: {
						contentId,
						fileName: `${propertyTitle(capsule)}.md`,
						size: null,
						mimeType: 'text/markdown',
					},
				}
			: {}),
	};
}

export function professionalWorldsDraftToSiteStudio(
	capsule: ProfessionalWorldsDraftCapsule | null
): ProfessionalWorldsSiteStudioDraft | null {
	if (!capsule) return null;
	const title = propertyTitle(capsule);
	const city = capsule.property?.city ?? '';
	const sections = (capsule.page_sections ?? [])
		.map((section) =>
			typeof section === 'string' ? section : JSON.stringify(section, null, 2)
		)
		.filter(Boolean);
	const outline = trimString(capsule.presentation?.outline_markdown);
	const briefParts = [
		`Источник: Professional Worlds / realtor.`,
		city ? `Город: ${city}` : '',
		outline,
		sections.length ? `Page sections:\n${sections.join('\n\n')}` : '',
	].filter(Boolean);
	const crossAppLinkId = readCrossAppLinkId(capsule) ?? undefined;
	return {
		siteTitle: title,
		siteTopic: `Лендинг объекта: ${title}`,
		brief: briefParts.join('\n\n'),
		...(crossAppLinkId ? { crossAppLinkId } : {}),
	};
}

export function professionalWorldsDraftToEwDesk(
	capsule: ProfessionalWorldsDraftCapsule | null
): ProfessionalWorldsEwDeskSuggestion | null {
	if (!capsule) return null;
	const markdown =
		trimString(capsule.suggestion_markdown) ||
		trimString(capsule.message_body_draft) ||
		trimString(capsule.presentation?.outline_markdown);
	if (!markdown) return null;
	const crossAppLinkId = readCrossAppLinkId(capsule) ?? undefined;
	return {
		title: propertyTitle(capsule),
		markdown,
		...(crossAppLinkId ? { crossAppLinkId } : {}),
	};
}
