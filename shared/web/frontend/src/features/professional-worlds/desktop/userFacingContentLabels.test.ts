/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for Professional Worlds user-facing Unified Content label helpers.
 *
 * Invariants:
 * - Known content types resolve to localized labels; unknown types use neutral fallback.
 *
 * Related:
 * - userFacingContentLabels.ts
 */
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import ruProfessionalWorlds from '@/i18n/locales/ru/professionalWorlds.json';

import {
	userFacingContentTypeLabel,
	userFacingDealTypeLabel,
	userFacingListingStatusLabel,
	userFacingProcessingStatusLabel,
	userFacingPropertyTypeLabel,
} from './userFacingContentLabels';

function mockT(key: string, options?: { defaultValue?: string }): string {
	const segments = key.split('.');
	let cursor: unknown = ruProfessionalWorlds;
	for (const segment of segments) {
		if (!cursor || typeof cursor !== 'object') {
			return options?.defaultValue ?? key;
		}
		cursor = (cursor as Record<string, unknown>)[segment];
	}
	return typeof cursor === 'string' ? cursor : (options?.defaultValue ?? key);
}

const t = mockT as TFunction;

describe('userFacingContentLabels', () => {
	it('maps known content types to localized labels', () => {
		expect(userFacingContentTypeLabel(t, 'image')).toBe(
			ruProfessionalWorlds.shared.contentTypes.image
		);
	});

	it('falls back for unknown content types', () => {
		expect(userFacingContentTypeLabel(t, 'not-a-real-type')).toBe(
			ruProfessionalWorlds.shared.contentTypes.unknown
		);
	});

	it('maps known processing statuses', () => {
		expect(userFacingProcessingStatusLabel(t, 'ready')).toBe(
			ruProfessionalWorlds.shared.processingStatuses.ready
		);
	});

	it('maps listing deal, type, and status enums', () => {
		expect(userFacingDealTypeLabel(t, 'sale')).toBe(
			ruProfessionalWorlds.properties.dealTypes.sale
		);
		expect(userFacingPropertyTypeLabel(t, 'apartment')).toBe(
			ruProfessionalWorlds.properties.propertyTypes.apartment
		);
		expect(userFacingListingStatusLabel(t, 'active')).toBe(
			ruProfessionalWorlds.properties.listingStatuses.active
		);
	});
});
