/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build SpotlightGuideModal label bundle from i18next `t()` with a shared key prefix.
 *
 * Related:
 * - SpotlightGuideModal.tsx
 */

import type { TFunction } from 'i18next';
import type { SpotlightGuideModalLabels } from '@/components/guided-tour/SpotlightGuideModal';

export function guideTourLabelsFromI18n(
	t: TFunction,
	prefix: string
): SpotlightGuideModalLabels {
	return {
		badge: t(`${prefix}.badge`),
		kbdHint: t(`${prefix}.kbdHint`),
		progressAria: (current, total) =>
			t(`${prefix}.progressAria`, { current, total }),
		closeDimAria: t(`${prefix}.closeDimAria`),
		closeAria: t(`${prefix}.closeAria`),
		audioToggleAria: t(`${prefix}.audioToggleAria`),
		audioToggleTitle: t(`${prefix}.audioToggleTitle`),
		back: t(`${prefix}.back`),
		skip: t(`${prefix}.skip`),
		next: t(`${prefix}.next`),
		finish: t(`${prefix}.finish`),
	};
}
