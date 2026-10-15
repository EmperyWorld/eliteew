/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Short shell spotlight tour for POEMMA desktop app (GT-11b); deep onboarding stays in PoemmaGuidePage.
 *
 * Related:
 * - PoemmaApp.tsx, public/audio/poemma-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const POEMMA_GUIDE_ROOT_ID = 'poemma-guide-root';
export const POEMMA_GUIDE_AUDIO_LS_KEY = 'poemma-guide-audio-enabled';
export const POEMMA_GUIDE_TOUR_FOLDER = 'poemma-guide';

export const POEMMA_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{
		id: 'top-bar',
		highlightSelector: '[data-poemma-guide="top-bar"]',
	},
	{ id: 'nav', highlightSelector: '[data-poemma-guide="nav"]' },
	{ id: 'workspace', highlightSelector: '[data-poemma-guide="workspace"]' },
	{
		id: 'decision-guide',
		highlightSelector: '[data-poemma-guide="decision-guide"]',
	},
	{ id: 'outro', highlightSelector: null },
] as const;

export function poemmaGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(POEMMA_GUIDE_TOUR_FOLDER, stepId);
}
