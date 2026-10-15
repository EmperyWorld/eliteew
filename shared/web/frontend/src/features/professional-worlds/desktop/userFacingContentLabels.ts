/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map Unified Content metadata to user-facing labels in Professional Worlds runtime UI.
 *
 * Invariants:
 * - Unknown types and statuses fall back to neutral copy, never raw enum strings in primary UI.
 *
 * Related:
 * - UnifiedContentPickerBridge.tsx
 * - i18n/locales/.../professionalWorlds.json (`shared.contentTypes`, `shared.processingStatuses`)
 */

import type { TFunction } from 'i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

function normalizeToken(value: string | null | undefined): string {
	return String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
}

export function userFacingContentTypeLabel(
	t: TFunction,
	contentType: string | null | undefined
): string {
	const key = normalizeToken(contentType);
	if (!key) {
		return t('shared.contentTypes.unknown', { ns: PROFESSIONAL_WORLDS_NS });
	}
	return t(`shared.contentTypes.${key}`, {
		ns: PROFESSIONAL_WORLDS_NS,
		defaultValue: t('shared.contentTypes.unknown', {
			ns: PROFESSIONAL_WORLDS_NS,
		}),
	});
}

export function userFacingProcessingStatusLabel(
	t: TFunction,
	status: string | null | undefined
): string {
	const key = normalizeToken(status);
	if (!key) {
		return '';
	}
	return t(`shared.processingStatuses.${key}`, {
		ns: PROFESSIONAL_WORLDS_NS,
		defaultValue: t('shared.processingStatuses.unknown', {
			ns: PROFESSIONAL_WORLDS_NS,
		}),
	});
}

export function userFacingDealTypeLabel(
	t: TFunction,
	dealType: string | null | undefined
): string {
	const key = normalizeToken(dealType);
	if (!key) {
		return '—';
	}
	return t(`properties.dealTypes.${key}`, {
		ns: PROFESSIONAL_WORLDS_NS,
		defaultValue: dealType ?? '—',
	});
}

export function userFacingPropertyTypeLabel(
	t: TFunction,
	propertyType: string | null | undefined
): string {
	const key = normalizeToken(propertyType);
	if (!key) {
		return '—';
	}
	return t(`properties.propertyTypes.${key}`, {
		ns: PROFESSIONAL_WORLDS_NS,
		defaultValue: propertyType?.replace(/_/g, ' ') ?? '—',
	});
}

export function userFacingListingStatusLabel(
	t: TFunction,
	status: string | null | undefined
): string {
	const key = normalizeToken(status);
	if (!key) {
		return '—';
	}
	return t(`properties.listingStatuses.${key}`, {
		ns: PROFESSIONAL_WORLDS_NS,
		defaultValue: status ?? '—',
	});
}
