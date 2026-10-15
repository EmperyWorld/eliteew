/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for KIRS client site handoff guided tour (GT-11d).
 *
 * Related:
 * - KirsClientSitePage.tsx, public/audio/kirs-client-site-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const KIRS_CLIENT_SITE_GUIDE_ROOT_ID = 'kirs-client-site-guide-root';
export const KIRS_CLIENT_SITE_GUIDE_AUDIO_LS_KEY =
	'kirs-client-site-guide-audio-enabled';
export const KIRS_CLIENT_SITE_GUIDE_TOUR_FOLDER = 'kirs-client-site-guide';

export const KIRS_CLIENT_SITE_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{
		id: 'header',
		highlightSelector: '[data-kirs-client-site-guide="header"]',
	},
	{
		id: 'project-list',
		highlightSelector: '[data-kirs-client-site-guide="project-list"]',
	},
	{
		id: 'view-tabs',
		highlightSelector: '[data-kirs-client-site-guide="view-tabs"]',
	},
	{
		id: 'next-step',
		highlightSelector: '[data-kirs-client-site-guide="next-step"]',
	},
	{
		id: 'readiness',
		highlightSelector: '[data-kirs-client-site-guide="readiness"]',
	},
	{
		id: 'storefront',
		highlightSelector: '[data-kirs-client-site-guide="storefront"]',
	},
	{
		id: 'approval',
		highlightSelector: '[data-kirs-client-site-guide="approval"]',
	},
	{ id: 'outro', highlightSelector: null },
] as const;

export function kirsClientSiteGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(KIRS_CLIENT_SITE_GUIDE_TOUR_FOLDER, stepId);
}
