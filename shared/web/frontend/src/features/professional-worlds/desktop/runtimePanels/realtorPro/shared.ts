/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Realtor Pro runtime panel helpers: i18n formatters, async state types, property selection, and listing CRM bridge hook extracted from RealtorProPanels.
 *
 * Invariants:
 * - Operator-facing copy resolves through `professionalWorlds.realtorPro` with English API fallbacks for unknown schema values.
 * - JSX panel chrome (PanelStatus, ListingCrmBridgeActions, Badge, JsonPreview) is shared across split panels.
 *
 * Related:
 * - ../RealtorProPanels.tsx
 * - ../../realtorLogic.ts
 * - documentation/product/PROFESSIONAL-WORLDS.md
 * ---
 */

import { useMemo } from 'react';

import {
	findUniqueDealForPropertyId,
	isProfessionalDealStage,
	resolveTaskCommunicationFocus,
} from '../../realtorLogic';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';

export { resolveTaskCommunicationFocus };
export {
	Badge,
	JsonPreview,
	ListingCrmBridgeActions,
	PanelStatus,
} from './sharedUi';

export type AsyncState<T> = {
	data: T;
	error: string | null;
	loading: boolean;
};

export type RealtorPanelTranslate = (
	key: string,
	options?: Record<string, unknown>
) => string;

export function humanizeRealtorIdentifier(value: string): string {
	return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function formatUnknownRealtorValue(
	t: RealtorPanelTranslate,
	value: string | null | undefined
): string {
	const humanValue = humanizeRealtorIdentifier(value?.trim() || '');
	return humanValue
		? t('realtorPro.formatters.customValue', { value: humanValue })
		: t('realtorPro.formatters.notSpecified');
}

export function translateRealtorValue(
	t: RealtorPanelTranslate,
	key: string,
	fallback: string
): string {
	const value = t(key);
	return value === key ? fallback : value;
}

export function formatDealStageLabel(
	t: RealtorPanelTranslate,
	stage: string | null | undefined
): string {
	if (!stage) {
		return t('realtorPro.deals.stageFromStart');
	}
	if (isProfessionalDealStage(stage)) {
		return t(`deals.stages.${stage}`);
	}
	return translateRealtorValue(
		t,
		`realtorPro.deals.stages.${stage}`,
		formatUnknownRealtorValue(t, stage)
	);
}

export function formatLeadStatusLabel(
	t: RealtorPanelTranslate,
	status: string | null | undefined
): string {
	const normalized = status?.trim() || 'new';
	return translateRealtorValue(
		t,
		`realtorPro.leads.statuses.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

export function formatTaskPriorityLabel(
	t: RealtorPanelTranslate,
	priority: string | null | undefined
): string {
	const normalized = priority?.trim() || 'normal';
	return translateRealtorValue(
		t,
		`realtorPro.tasks.priorities.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

export function formatTaskStatusLabel(
	t: RealtorPanelTranslate,
	status: string | null | undefined
): string {
	const normalized = status?.trim() || 'open';
	return translateRealtorValue(
		t,
		`realtorPro.tasks.statuses.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

export function formatMarketingStatusLabel(
	t: RealtorPanelTranslate,
	status: string | null | undefined
): string {
	const normalized = status?.trim() || 'draft';
	return translateRealtorValue(
		t,
		`realtorPro.marketing.statuses.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

export function formatDocumentTypeLabel(
	t: RealtorPanelTranslate,
	docType: string | null | undefined
): string {
	const normalized = docType?.trim() || 'other';
	return translateRealtorValue(
		t,
		`realtorPro.documents.docTypes.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

export function formatCommunicationTypeLabel(
	t: RealtorPanelTranslate,
	relatedType: string | null | undefined
): string {
	const normalized = relatedType?.trim() || 'note';
	return translateRealtorValue(
		t,
		`realtorPro.communications.relatedTypes.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

export function formatCommunicationChannelLabel(
	t: RealtorPanelTranslate,
	channel: string | null | undefined
): string {
	const normalized = channel?.trim() || 'note';
	return translateRealtorValue(
		t,
		`realtorPro.communications.channels.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

export function formatObjectionKeyLabel(
	t: RealtorPanelTranslate,
	objectionKey: string
): string {
	return translateRealtorValue(
		t,
		`realtorPro.objections.knownKeys.${objectionKey}`,
		formatUnknownRealtorValue(t, objectionKey)
	);
}

export function formatObjectionTagLabel(
	t: RealtorPanelTranslate,
	tag: string
): string {
	return translateRealtorValue(
		t,
		`realtorPro.objections.knownTags.${tag}`,
		formatUnknownRealtorValue(t, tag)
	);
}

export function formatPublicationChannelLabel(
	t: RealtorPanelTranslate,
	channelKey: string
): string {
	return translateRealtorValue(
		t,
		`realtorPro.marketing.publicationChannelNames.${channelKey}`,
		t('realtorPro.marketing.publicationChannelCustom', {
			channel: humanizeRealtorIdentifier(channelKey),
		})
	);
}

export function formatPublicationStatusLabel(
	t: RealtorPanelTranslate,
	status: string
): string {
	return translateRealtorValue(
		t,
		`realtorPro.marketing.publicationStatuses.${status}`,
		formatUnknownRealtorValue(t, status)
	);
}

export function resolvePreferredPropertyId(
	snapshot: RuntimeModulePanelProps['snapshot'],
	selectedPropertyId: string | null | undefined
): string {
	if (
		selectedPropertyId &&
		snapshot.properties.some((property) => property.id === selectedPropertyId)
	) {
		return selectedPropertyId;
	}
	return snapshot.properties[0]?.id ?? '';
}

export function useListingCrmBridge(
	snapshot: RuntimeModulePanelProps['snapshot'],
	propertyId: string
) {
	return useMemo(() => {
		const selectedProperty =
			snapshot.properties.find((property) => property.id === propertyId) ??
			null;
		const uniqueDeal = propertyId
			? findUniqueDealForPropertyId(
					snapshot.deals,
					snapshot.properties,
					propertyId
				)
			: null;
		return { selectedProperty, uniqueDeal };
	}, [propertyId, snapshot.deals, snapshot.properties]);
}
