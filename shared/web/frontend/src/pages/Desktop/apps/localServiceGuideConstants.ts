/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for Local Service iframe desktop app guided tour (GT-12).
 *
 * Related:
 * - LocalServiceIframeApp.tsx, public/audio/local-service-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const LOCAL_SERVICE_GUIDE_ROOT_ID = 'local-service-guide-root';
export const LOCAL_SERVICE_GUIDE_AUDIO_LS_KEY =
	'local-service-guide-audio-enabled';
export const LOCAL_SERVICE_GUIDE_TOUR_FOLDER = 'local-service-guide';

export const LOCAL_SERVICE_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{
		id: 'shell-header',
		highlightSelector: '[data-local-service-guide="shell-header"]',
	},
	{
		id: 'connect',
		highlightSelector: '[data-local-service-guide="connect"]',
	},
	{
		id: 'viewport',
		highlightSelector: '[data-local-service-guide="viewport"]',
	},
	{
		id: 'security',
		highlightSelector: '[data-local-service-guide="security"]',
	},
	{ id: 'outro', highlightSelector: null },
] as const;

export function localServiceGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(LOCAL_SERVICE_GUIDE_TOUR_FOLDER, stepId);
}
