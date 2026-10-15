/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Professional Worlds cross-app draft link lifecycle labels and recovery hints.
 *
 * Invariants:
 * - No network I/O; maps server `lifecycle_state` / staleness flags to UI tone only.
 *
 * Related:
 * - CrossAppDraftLinksPanel.tsx
 * - shared/api/services/professional_worlds/cross_app_draft_constants.py
 */

import type { ProfessionalCrossAppDraftLink } from './types';

export type CrossAppDraftLifecycleTone =
	| 'neutral'
	| 'active'
	| 'warning'
	| 'muted';

export function crossAppDraftLifecycleTone(
	lifecycleState: string
): CrossAppDraftLifecycleTone {
	switch (lifecycleState) {
		case 'opened':
		case 'updated':
		case 'published':
			return 'active';
		case 'stale':
			return 'warning';
		case 'cancelled':
			return 'muted';
		default:
			return 'neutral';
	}
}

export function crossAppDraftNeedsRecovery(
	link: Pick<
		ProfessionalCrossAppDraftLink,
		'is_stale' | 'lifecycle_state' | 'stale_reason'
	>
): boolean {
	if (link.is_stale) return true;
	if (
		link.lifecycle_state === 'stale' ||
		link.lifecycle_state === 'cancelled'
	) {
		return true;
	}
	return Boolean(link.stale_reason?.trim());
}

export function crossAppDraftLifecycleI18nKey(lifecycleState: string): string {
	const normalized = lifecycleState.trim() || 'created';
	const known = [
		'created',
		'opened',
		'updated',
		'published',
		'cancelled',
		'stale',
	] as const;
	if ((known as readonly string[]).includes(normalized)) {
		return `crossAppDrafts.lifecycle.${normalized}`;
	}
	return 'crossAppDrafts.lifecycle.unknown';
}

export function crossAppDraftKindI18nKey(draftKind: string): string {
	const map: Record<string, string> = {
		ewrp: 'crossAppDrafts.destinations.ewrp',
		'site-studio': 'crossAppDrafts.destinations.siteStudio',
		'gaf-chat': 'crossAppDrafts.destinations.gafChat',
		ewdesk: 'crossAppDrafts.destinations.ewdesk',
		unified_content: 'crossAppDrafts.destinations.unifiedContent',
	};
	return map[draftKind.trim()] ?? 'crossAppDrafts.destinations.unknown';
}

export function mergeCrossAppDraftLink(
	links: readonly ProfessionalCrossAppDraftLink[],
	updated: ProfessionalCrossAppDraftLink
): ProfessionalCrossAppDraftLink[] {
	const idx = links.findIndex((item) => item.id === updated.id);
	if (idx < 0) return [updated, ...links];
	const next = [...links];
	next[idx] = updated;
	return next;
}

export function resolveCrossAppDraftArtifactTitle(
	link: Pick<ProfessionalCrossAppDraftLink, 'artifact_id' | 'draft_kind'>,
	artifacts: ReadonlyArray<{ id: string; title: string }>
): string | null {
	if (!link.artifact_id) return null;
	const artifact = artifacts.find((item) => item.id === link.artifact_id);
	return artifact?.title?.trim() || null;
}

export function resolveCrossAppDraftPropertyId(
	link: Pick<ProfessionalCrossAppDraftLink, 'external_ref'>
): string | null {
	const externalRef = link.external_ref;
	if (!externalRef || typeof externalRef !== 'object') return null;
	const propertyBlock = externalRef.property;
	if (!propertyBlock || typeof propertyBlock !== 'object') return null;
	const propertyId = (propertyBlock as { property_id?: unknown }).property_id;
	return typeof propertyId === 'string' && propertyId.trim()
		? propertyId.trim()
		: null;
}

export function resolveCrossAppDraftStaleCheckPropertyId(
	selectedPropertyId: string | null | undefined
): string | undefined {
	const normalized = selectedPropertyId?.trim();
	return normalized || undefined;
}

const KNOWN_STALE_REASON_I18N: Record<string, string> = {
	'Property facts changed after draft creation':
		'crossAppDrafts.staleReasonPropertyChanged',
};

export function resolveCrossAppDraftStaleHintKey(
	link: Pick<
		ProfessionalCrossAppDraftLink,
		'is_stale' | 'lifecycle_state' | 'stale_reason' | 'stale_hint'
	>
): string | null {
	if (link.stale_hint?.trim()) return null;
	const reason = link.stale_reason?.trim();
	if (reason && KNOWN_STALE_REASON_I18N[reason]) {
		return KNOWN_STALE_REASON_I18N[reason];
	}
	if (link.is_stale || link.lifecycle_state === 'stale') {
		return 'crossAppDrafts.staleHintFallback';
	}
	if (link.lifecycle_state === 'cancelled') {
		return 'crossAppDrafts.cancelledHint';
	}
	return null;
}

export function resolveCrossAppDraftStaleHint(
	link: Pick<
		ProfessionalCrossAppDraftLink,
		'is_stale' | 'lifecycle_state' | 'stale_reason' | 'stale_hint'
	>,
	translate: (key: string) => string
): string | null {
	if (link.stale_hint?.trim()) return link.stale_hint.trim();
	const key = resolveCrossAppDraftStaleHintKey(link);
	return key ? translate(key) : null;
}

export type CrossAppDraftRecreateHandoffRequest = {
	artifactId: string;
	draftKind: string;
	propertyId?: string | null;
};

export function crossAppDraftHandoffSuccessI18nKey(
	draftKind: string,
	opened: boolean
): string {
	const kind = draftKind.trim();
	if (opened) {
		const openedMap: Record<string, string> = {
			ewrp: 'integrationHandoff.openedDestinationEwrp',
			'site-studio': 'integrationHandoff.openedDestinationSiteStudio',
			'gaf-chat': 'integrationHandoff.openedDestinationGafChat',
			ewdesk: 'integrationHandoff.openedDestinationEwDesk',
		};
		return openedMap[kind] ?? 'integrationHandoff.openedDestination';
	}
	return 'integrationHandoff.draftSaved';
}

export function countStaleCrossAppDraftLinks(
	links: ReadonlyArray<
		Pick<
			ProfessionalCrossAppDraftLink,
			'is_stale' | 'lifecycle_state' | 'stale_reason'
		>
	>
): number {
	return links.filter((link) => crossAppDraftNeedsRecovery(link)).length;
}

export const OPTIMISTIC_CROSS_APP_DRAFT_PREFIX = 'optimistic:';

export function isOptimisticCrossAppDraftLink(
	link: Pick<ProfessionalCrossAppDraftLink, 'id'>
): boolean {
	return link.id.startsWith(OPTIMISTIC_CROSS_APP_DRAFT_PREFIX);
}

export function createOptimisticCrossAppDraftLink(input: {
	draftKind: string;
	artifactId?: string | null;
	userId: string;
	verticalSlug: string;
}): ProfessionalCrossAppDraftLink {
	const now = new Date().toISOString();
	return {
		id: `${OPTIMISTIC_CROSS_APP_DRAFT_PREFIX}${Date.now()}`,
		user_id: input.userId,
		vertical_slug: input.verticalSlug,
		draft_kind: input.draftKind,
		artifact_id: input.artifactId ?? null,
		lifecycle_state: 'created',
		is_stale: false,
		stale_reason: null,
		stale_hint: null,
		external_ref: {},
		created_at: now,
		updated_at: now,
	};
}
