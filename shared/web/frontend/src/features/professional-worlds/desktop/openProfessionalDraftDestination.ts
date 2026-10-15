/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Open Desktop destinations for Professional Worlds cross-app draft capsules persisted on the API link row (`external_ref`).
 *
 * Invariants:
 * - Persistence uses `sessionStorage` so lazy-mounted apps may hydrate from `professionalWorldsCrossAppDraftKey` on next tick.
 * - Does not invoke publish/send APIs — only launches apps with draft context.
 *
 * Related:
 * - shared/api/services/professional_worlds/cross_app_draft_adapters.py
 * - src/pages/Desktop/utils/desktopDeepLink.ts
 */

import { requestOpenDesktopApp } from '@/pages/Desktop/utils/desktopDeepLink';

const STORAGE_SCOPE = 'eliteew.professionalWorlds.crossAppDraft.v1';

export type SupportedProfessionalDraftDestination =
	| 'ewrp'
	| 'site-studio'
	| 'gaf-chat'
	| 'ewdesk'
	| 'unified_content';

/** Capsule persisted under `professionalWorldsDraftLinks` — matches server `ProfessionalCrossAppDraftLink.external_ref`. */
export type ProfessionalDraftOpenPayload = {
	readonly destination?: SupportedProfessionalDraftDestination;
	readonly unified_content_ids?: readonly string[];
	readonly deep_link?: {
		readonly app_component?: string;
		readonly artifact_id?: string;
	};
};

function safeStorageKey(
	kind: SupportedProfessionalDraftDestination,
	suffix: string
): string {
	return `${STORAGE_SCOPE}.${kind}.${suffix}`;
}

/**
 * Persist JSON capsule and dispatch `desktop-open-app` targeting the canonical component for `draft_kind`.
 */
export function openProfessionalDraftDestination(
	link: {
		readonly id?: string;
		readonly draft_kind: string;
		readonly external_ref?: ProfessionalDraftOpenPayload &
			Record<string, unknown>;
	} | null
): boolean {
	if (typeof window === 'undefined') return false;
	if (!link) return false;
	const ref =
		link.external_ref ??
		({} as ProfessionalDraftOpenPayload & Record<string, unknown>);
	const dk = link.draft_kind;
	const capsule = typeof ref === 'object' ? ref : {};
	const crossAppLinkId = link.id?.trim() || undefined;
	const dl = capsule.deep_link;
	const appFromAdapter =
		dl?.app_component && typeof dl.app_component === 'string'
			? dl.app_component
			: '';

	if (dk === 'ewrp' || appFromAdapter === 'EWRP') {
		const suffix = crypto.randomUUID();
		const key = safeStorageKey('ewrp', suffix);
		sessionStorage.setItem(
			key,
			JSON.stringify({
				...capsule,
				...(crossAppLinkId ? { cross_app_link_id: crossAppLinkId } : {}),
				link_id_hint: dk,
			})
		);
		requestOpenDesktopApp({
			appComponent: 'EWRP',
			professionalWorldsCrossAppDraftKey: key,
		});
		return true;
	}
	if (dk === 'site-studio' || appFromAdapter === 'UserSiteStudio') {
		const suffix = crypto.randomUUID();
		const key = safeStorageKey('site-studio', suffix);
		sessionStorage.setItem(
			key,
			JSON.stringify({
				...capsule,
				...(crossAppLinkId ? { cross_app_link_id: crossAppLinkId } : {}),
				link_id_hint: dk,
			})
		);
		requestOpenDesktopApp({
			appComponent: 'UserSiteStudio',
			professionalWorldsCrossAppDraftKey: key,
		});
		return true;
	}
	if (dk === 'gaf-chat' || appFromAdapter === 'GAFChatApp') {
		const suffix = crypto.randomUUID();
		const key = safeStorageKey('gaf-chat', suffix);
		sessionStorage.setItem(
			key,
			JSON.stringify({
				...capsule,
				...(crossAppLinkId ? { cross_app_link_id: crossAppLinkId } : {}),
				link_id_hint: dk,
			})
		);
		requestOpenDesktopApp({
			appComponent: 'GAFChatApp',
			professionalWorldsCrossAppDraftKey: key,
		});
		return true;
	}
	if (dk === 'ewdesk' || appFromAdapter === 'EWDeskApp') {
		const suffix = crypto.randomUUID();
		const key = safeStorageKey('ewdesk', suffix);
		sessionStorage.setItem(
			key,
			JSON.stringify({
				...capsule,
				...(crossAppLinkId ? { cross_app_link_id: crossAppLinkId } : {}),
				link_id_hint: dk,
			})
		);
		requestOpenDesktopApp({
			appComponent: 'EWDeskApp',
			professionalWorldsCrossAppDraftKey: key,
		});
		return true;
	}
	const ucl =
		ref.unified_content_link &&
		typeof ref.unified_content_link === 'object' &&
		ref.unified_content_link !== null
			? (ref.unified_content_link as { unified_content_ids?: string[] })
			: null;
	const ids = [
		...(capsule.unified_content_ids ?? ucl?.unified_content_ids ?? []),
	].filter(Boolean);
	const firstId = ids[0];
	if (dk === 'unified_content' || capsule.destination === 'unified_content') {
		if (!firstId) {
			return false;
		}
		requestOpenDesktopApp({
			appComponent: 'ContentManagerPro',
			contentManagerFocusUnifiedContentId: firstId,
			professionalWorldsUnifiedIds: ids,
		});
		return true;
	}
	return false;
}
