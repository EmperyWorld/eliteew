/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for Professional Worlds guided tour (GT-9a).
 *
 * Related:
 * - ProfessionalWorldsApp.tsx, public/audio/professional-worlds-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';
import type { ProfessionalWorldsActiveView } from './ProfessionalWorldsWorkspaceContext';

export const PROFESSIONAL_WORLDS_GUIDE_ROOT_ID =
	'professional-worlds-guide-root';
export const PROFESSIONAL_WORLDS_GUIDE_AUDIO_LS_KEY =
	'professional-worlds-guide-audio-enabled';
export const PROFESSIONAL_WORLDS_GUIDE_TOUR_FOLDER =
	'professional-worlds-guide';

export const PROFESSIONAL_WORLDS_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{ id: 'header', highlightSelector: '[data-pw-guide="header"]' },
	{ id: 'sidebar', highlightSelector: '[data-pw-guide="sidebar"]' },
	{ id: 'workspace', highlightSelector: '[data-pw-guide="workspace"]' },
	{ id: 'ai-rail', highlightSelector: '[data-pw-guide="ai-rail"]' },
	{ id: 'vertical', highlightSelector: '[data-pw-guide="vertical"]' },
	{ id: 'outro', highlightSelector: null },
] as const;

export const PROFESSIONAL_WORLDS_GUIDE_VIEW_BY_STEP: Partial<
	Record<
		(typeof PROFESSIONAL_WORLDS_GUIDE_STEP_DEFS)[number]['id'],
		ProfessionalWorldsActiveView
	>
> = {
	intro: 'overview',
	header: 'overview',
	sidebar: 'overview',
	workspace: 'overview',
	'ai-rail': 'overview',
	vertical: 'overview',
};

export function professionalWorldsGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(PROFESSIONAL_WORLDS_GUIDE_TOUR_FOLDER, stepId);
}
