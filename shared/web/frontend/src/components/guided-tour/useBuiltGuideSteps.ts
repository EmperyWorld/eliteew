/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map guided tour step defs to localized title/body via i18next.
 *
 * Related:
 * - SpotlightGuideModal.tsx, guideTourLabelsFromI18n.ts
 */

import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import type { SpotlightGuideStep } from '@/components/guided-tour/SpotlightGuideModal';

export type GuideTourDemoAction = 'click' | 'doubleClick' | 'rightClick';

export type GuideStepDef = {
	id: string;
	highlightSelector: string | null;
	demoAction?: GuideTourDemoAction;
};

export function useBuiltGuideSteps(
	t: TFunction,
	stepsKeyPrefix: string,
	defs: readonly GuideStepDef[]
): SpotlightGuideStep[] {
	return useMemo(
		() =>
			defs.map((def) => {
				const demoCaption = t(`${stepsKeyPrefix}.${def.id}.demoCaption`, {
					defaultValue: '',
				});
				return {
					id: def.id,
					highlightSelector: def.highlightSelector,
					demoAction: def.demoAction,
					demoCaption: demoCaption || undefined,
					title: t(`${stepsKeyPrefix}.${def.id}.title`),
					body: t(`${stepsKeyPrefix}.${def.id}.body`),
				};
			}),
		[t, stepsKeyPrefix, defs]
	);
}
