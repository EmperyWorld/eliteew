/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for Customer Cabinet guided tour (GT-10e).
 *
 * Related:
 * - CustomerCabinetPage.tsx, public/audio/customer-cabinet-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const CUSTOMER_CABINET_GUIDE_ROOT_ID = 'customer-cabinet-guide-root';
export const CUSTOMER_CABINET_GUIDE_AUDIO_LS_KEY =
	'customer-cabinet-guide-audio-enabled';
export const CUSTOMER_CABINET_GUIDE_TOUR_FOLDER = 'customer-cabinet-guide';

export const CUSTOMER_CABINET_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{ id: 'header', highlightSelector: '[data-customer-cabinet-guide="header"]' },
	{ id: 'search', highlightSelector: '[data-customer-cabinet-guide="search"]' },
	{
		id: 'company-tree',
		highlightSelector: '[data-customer-cabinet-guide="company-tree"]',
	},
	{
		id: 'project-row',
		highlightSelector: '[data-customer-cabinet-guide="project-row"]',
	},
	{
		id: 'workspace',
		highlightSelector: '[data-customer-cabinet-guide="workspace"]',
	},
	{
		id: 'refresh',
		highlightSelector: '[data-customer-cabinet-guide="refresh"]',
	},
	{ id: 'outro', highlightSelector: null },
] as const;

export function customerCabinetGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(CUSTOMER_CABINET_GUIDE_TOUR_FOLDER, stepId);
}
