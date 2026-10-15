/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for KIRS curation operator console guided tour (GT-11c).
 *
 * Related:
 * - KirsPage.tsx, public/audio/kirs-curation-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const KIRS_CURATION_GUIDE_ROOT_ID = 'kirs-curation-guide-root';
export const KIRS_CURATION_GUIDE_AUDIO_LS_KEY =
	'kirs-curation-guide-audio-enabled';
export const KIRS_CURATION_GUIDE_TOUR_FOLDER = 'kirs-curation-guide';

export const KIRS_CURATION_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{
		id: 'header',
		highlightSelector: '[data-kirs-curation-guide="header"]',
	},
	{
		id: 'project-list',
		highlightSelector: '[data-kirs-curation-guide="project-list"]',
	},
	{
		id: 'panel-tabs',
		highlightSelector: '[data-kirs-curation-guide="panel-tabs"]',
	},
	{
		id: 'runtime-status',
		highlightSelector: '[data-kirs-curation-guide="runtime-status"]',
	},
	{
		id: 'runtime-actions',
		highlightSelector: '[data-kirs-curation-guide="runtime-actions"]',
	},
	{
		id: 'client-handoff',
		highlightSelector: '[data-kirs-curation-guide="client-handoff"]',
	},
	{
		id: 'domains',
		highlightSelector: '[data-kirs-curation-guide="domains"]',
	},
	{ id: 'outro', highlightSelector: null },
] as const;

export function kirsCurationGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(KIRS_CURATION_GUIDE_TOUR_FOLDER, stepId);
}
