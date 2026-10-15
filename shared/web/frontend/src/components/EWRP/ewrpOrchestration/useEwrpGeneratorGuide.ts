/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guided tour state and step preparation for EWRP generator workspace tabs.
 *
 * Invariants:
 * - `prepareGuideStep` switches `mainTab` per `EWRP_GUIDE_TAB_BY_STEP` only.
 *
 * Related:
 * - `useEwrpGeneratorCompose.tsx`, `ewrpGuideConstants.ts`
 */

import { useCallback, useState } from 'react';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { EWRP_GUIDE_TAB_BY_STEP } from '../ewrpGuideConstants';

export type UseEwrpGeneratorGuideParams = {
	setMainTab: React.Dispatch<
		React.SetStateAction<'generate' | 'presentations'>
	>;
};

export function useEwrpGeneratorGuide({
	setMainTab,
}: UseEwrpGeneratorGuideParams) {
	const [guideOpen, setGuideOpen] = useState(false);
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);

	const prepareGuideStep = useCallback(
		(stepId: string) => {
			const tab = EWRP_GUIDE_TAB_BY_STEP[stepId];
			if (tab) setMainTab(tab);
		},
		[setMainTab]
	);

	return {
		guideOpen,
		setGuideOpen,
		prepareGuideStep,
	};
}

export function ewrpGuideSpotlightLayoutKey(
	mainTab: 'generate' | 'presentations',
	guideOpen: boolean
): string {
	return `${mainTab}-${guideOpen}`;
}
