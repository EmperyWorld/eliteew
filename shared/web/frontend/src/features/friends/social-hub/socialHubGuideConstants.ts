/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for Social Hub guided tour (GT-7).
 *
 * Related:
 * - features/friends/social-hub/SocialHubShell.tsx, public/audio/social-hub-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';
import type { SocialHubSection } from './socialHubNavigation';

export const SOCIAL_HUB_GUIDE_ROOT_ID = 'social-hub-guide-root';
export const SOCIAL_HUB_GUIDE_AUDIO_LS_KEY = 'social-hub-guide-audio-enabled';
export const SOCIAL_HUB_GUIDE_TOUR_FOLDER = 'social-hub-guide';

export const SOCIAL_HUB_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{ id: 'header', highlightSelector: '[data-sh-guide="sidebar"]' },
	{ id: 'sidebar', highlightSelector: '[data-sh-guide="sidebar"]' },
	{ id: 'workspace', highlightSelector: '[data-sh-guide="workspace"]' },
	{ id: 'people', highlightSelector: '[data-sh-guide="workspace"]' },
	{ id: 'privacy', highlightSelector: '[data-sh-guide="workspace"]' },
	{ id: 'outro', highlightSelector: null },
] as const;

export const SOCIAL_HUB_GUIDE_SECTION_BY_STEP: Partial<
	Record<(typeof SOCIAL_HUB_GUIDE_STEP_DEFS)[number]['id'], SocialHubSection>
> = {
	intro: 'home',
	header: 'home',
	sidebar: 'home',
	workspace: 'home',
	people: 'people',
	privacy: 'privacy',
};

export function socialHubGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(SOCIAL_HUB_GUIDE_TOUR_FOLDER, stepId);
}
