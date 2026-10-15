/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for Video Call guided tour (GT-9c).
 *
 * Related:
 * - VideoCallApp.tsx, public/audio/video-call-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const VIDEO_CALL_GUIDE_ROOT_ID = 'video-call-guide-root';
export const VIDEO_CALL_GUIDE_AUDIO_LS_KEY = 'video-call-guide-audio-enabled';
export const VIDEO_CALL_GUIDE_TOUR_FOLDER = 'video-call-guide';

export const VIDEO_CALL_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{ id: 'toolbar', highlightSelector: '[data-vc-guide="toolbar"]' },
	{ id: 'call-stage', highlightSelector: '[data-vc-guide="call-stage"]' },
	{ id: 'outro', highlightSelector: null },
] as const;

export function videoCallGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(VIDEO_CALL_GUIDE_TOUR_FOLDER, stepId);
}
