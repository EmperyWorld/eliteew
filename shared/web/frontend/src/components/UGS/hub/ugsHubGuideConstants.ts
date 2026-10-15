/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for UGS Hub guided tour (GT-2).
 *
 * Related:
 * - components/UGSHub.tsx, public/audio/ugs-hub-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';
import type { UgsHubActiveTab } from './types';

export const UGS_HUB_GUIDE_ROOT_ID = 'ugs-hub-guide-root';
export const UGS_HUB_GUIDE_AUDIO_LS_KEY = 'ugs-hub-guide-audio-enabled';
export const UGS_HUB_GUIDE_TOUR_FOLDER = 'ugs-hub-guide';

export const UGS_HUB_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{ id: 'header', highlightSelector: '[data-ugs-hub-guide="header"]' },
	{ id: 'stats', highlightSelector: '[data-ugs-hub-guide="stats"]' },
	{ id: 'tab-rail', highlightSelector: '[data-ugs-hub-guide="tab-rail"]' },
	{
		id: 'quick-launch',
		highlightSelector: '[data-ugs-hub-guide="quick-launch"]',
	},
	{ id: 'filters', highlightSelector: '[data-ugs-hub-guide="filters"]' },
	{ id: 'task-list', highlightSelector: '[data-ugs-hub-guide="task-list"]' },
	{ id: 'outro', highlightSelector: null },
] as const;

export const UGS_HUB_GUIDE_TAB_BY_STEP: Partial<
	Record<(typeof UGS_HUB_GUIDE_STEP_DEFS)[number]['id'], UgsHubActiveTab>
> = {
	intro: 'overview',
	header: 'overview',
	stats: 'overview',
	'tab-rail': 'overview',
	'quick-launch': 'overview',
	filters: 'active',
	'task-list': 'active',
};

export function ugsHubGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(UGS_HUB_GUIDE_TOUR_FOLDER, stepId);
}
