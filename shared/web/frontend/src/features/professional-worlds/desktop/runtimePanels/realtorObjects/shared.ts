/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared constants and helpers for realtor objects runtime panels (Wave 2b split).
 *
 * Invariants:
 * - `LISTING_MEDIA_SECTION_ID` is stable for workspace focus deep-links.
 *
 * Related:
 * - RealtorObjectsWorkspaceShell.tsx
 */

import type { useTranslation } from 'react-i18next';

export const LISTING_MEDIA_SECTION_ID = 'pw-listing-media-section';

export function formatUploadStatus(
	t: ReturnType<typeof useTranslation>['t'],
	status: string
): string {
	const normalized = status.trim() || 'idle';
	return t(`properties.uploadStatuses.${normalized}`, {
		defaultValue: normalized.replace(/[_-]+/g, ' '),
	});
}
