/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for GAF Chat guided tour (GT-6).
 *
 * Related:
 * - pages/Desktop/components/GAFChat/GAFChatApp.tsx, public/audio/gaf-chat-guide/
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const GAF_CHAT_GUIDE_ROOT_ID = 'gaf-chat-guide-root';
export const GAF_CHAT_GUIDE_AUDIO_LS_KEY = 'gaf-chat-guide-audio-enabled';
export const GAF_CHAT_GUIDE_TOUR_FOLDER = 'gaf-chat-guide';

export const GAF_CHAT_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{ id: 'toolbar', highlightSelector: '[data-gaf-guide="toolbar"]' },
	{ id: 'new-chat', highlightSelector: '[data-gaf-guide="new-chat"]' },
	{ id: 'sidebar', highlightSelector: '[data-gaf-guide="sidebar"]' },
	{ id: 'thread', highlightSelector: '[data-gaf-guide="thread"]' },
	{ id: 'composer', highlightSelector: '[data-gaf-guide="composer"]' },
	{ id: 'outro', highlightSelector: null },
] as const;

export function gafChatGuideWavUrl(stepId: string): string {
	return guideTourWavUrl(GAF_CHAT_GUIDE_TOUR_FOLDER, stepId);
}
