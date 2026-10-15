/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for Project About presentation guided tour (GT-10f).
 *
 * Related:
 * - ProjectAboutApp.tsx, public/audio/project-about-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const PROJECT_ABOUT_GUIDE_ROOT_ID = 'project-about-guide-root';
export const PROJECT_ABOUT_GUIDE_AUDIO_LS_KEY =
	'project-about-guide-audio-enabled';
export const PROJECT_ABOUT_GUIDE_TOUR_FOLDER = 'project-about-guide';

export const PROJECT_ABOUT_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{
		id: 'shell-header',
		highlightSelector: '[data-project-about-guide="shell-header"]',
	},
	{
		id: 'presentation',
		highlightSelector: '[data-project-about-guide="presentation"]',
	},
	{
		id: 'navigation',
		highlightSelector: '[data-project-about-guide="navigation"]',
	},
	{ id: 'outro', highlightSelector: null },
] as const;

export function projectAboutGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(PROJECT_ABOUT_GUIDE_TOUR_FOLDER, stepId);
}
