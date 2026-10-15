/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for UGS Dashboard guided tour (GT-5).
 *
 * Related:
 * - components/UGSDashboard.tsx, public/audio/ugs-dashboard-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const UGS_DASHBOARD_GUIDE_ROOT_ID = 'ugs-dashboard-guide-root';
export const UGS_DASHBOARD_GUIDE_AUDIO_LS_KEY =
	'ugs-dashboard-guide-audio-enabled';
export const UGS_DASHBOARD_GUIDE_TOUR_FOLDER = 'ugs-dashboard-guide';

export const UGS_DASHBOARD_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{ id: 'header', highlightSelector: '[data-ugs-dashboard-guide="header"]' },
	{ id: 'stats', highlightSelector: '[data-ugs-dashboard-guide="stats"]' },
	{
		id: 'providers',
		highlightSelector: '[data-ugs-dashboard-guide="providers"]',
	},
	{ id: 'tasks', highlightSelector: '[data-ugs-dashboard-guide="tasks"]' },
	{
		id: 'shortcuts',
		highlightSelector: '[data-ugs-dashboard-guide="shortcuts"]',
	},
	{ id: 'outro', highlightSelector: null },
] as const;

export function ugsDashboardGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(UGS_DASHBOARD_GUIDE_TOUR_FOLDER, stepId);
}
