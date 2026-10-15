/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Constants and step anchors for first-visit desktop welcome spotlight tour.
 *
 * Invariants:
 * - Root is `#desktop-main` (taskbar and canvas share the same spotlight root).
 * - Separate product flow from per-app guided tours (`GuideTourLaunchButton`).
 *
 * Related:
 * - DesktopWelcomeScreen.tsx, useDesktopWelcomeGuideSteps.ts
 * - `DESKTOP_WELCOME_GUIDE_AUDIO_*` + `public/audio/desktop-welcome-guide/narrations.ru.json`
 */

import type { GuideStepDef } from '@/components/guided-tour/useBuiltGuideSteps';
import { guideTourWavUrl } from '@/components/guided-tour/guideTourWavUrl';

export const DESKTOP_WELCOME_GUIDE_ROOT_ID = 'desktop-main';
export const DESKTOP_WELCOME_GUIDE_AUDIO_LS_KEY =
	'desktop-welcome-guide-audio-enabled';
export const DESKTOP_WELCOME_GUIDE_TOUR_FOLDER = 'desktop-welcome-guide';

/** Step ids with shipped WAV under `public/audio/desktop-welcome-guide/ru/`. */
export const DESKTOP_WELCOME_GUIDE_AUDIO_STEP_IDS: ReadonlySet<string> =
	new Set([
		'intro',
		'workspace',
		'widgets-panel',
		'favorites-widget',
		'icons',
		'taskbar',
		'start',
		'virtual-desktops',
		'windows',
		'sync-status',
		'shortcuts',
		'outro',
	]);

/** @deprecated Wave 7 shipped — kept empty for stable imports. Regen TTS: `bash docker/scripts/generate-guide-audio-stack9.sh desktop-welcome-guide`. */
export const DESKTOP_WELCOME_GUIDE_AUDIO_PENDING_STEP_IDS: readonly string[] =
	[];

export const DESKTOP_WELCOME_GUIDE_STEP_DEFS: readonly GuideStepDef[] = [
	{ id: 'intro', highlightSelector: null },
	{
		id: 'workspace',
		highlightSelector: '[data-desktop-welcome-guide="workspace"]',
		demoAction: 'rightClick',
	},
	{
		id: 'widgets-panel',
		highlightSelector: '[data-desktop-welcome-guide="widgets-panel"]',
		demoAction: 'click',
	},
	{
		id: 'favorites-widget',
		highlightSelector: '[data-desktop-welcome-guide="favorites-widget"]',
		demoAction: 'click',
	},
	{
		id: 'icons',
		highlightSelector:
			'[data-desktop-welcome-guide="icons"], [data-desktop-icon]',
		demoAction: 'doubleClick',
	},
	{
		id: 'taskbar',
		highlightSelector: '[data-desktop-welcome-guide="taskbar"]',
		demoAction: 'click',
	},
	{
		id: 'start',
		highlightSelector: '[data-start-menu-toggle="true"]',
		demoAction: 'click',
	},
	{
		id: 'virtual-desktops',
		highlightSelector: '[data-desktop-welcome-guide="virtual-desktops"]',
		demoAction: 'click',
	},
	{
		id: 'windows',
		highlightSelector: '[data-desktop-welcome-guide="windows"]',
		demoAction: 'click',
	},
	{
		id: 'sync-status',
		highlightSelector: '[data-desktop-welcome-guide="sync-status"]',
		demoAction: 'click',
	},
	{
		id: 'shortcuts',
		highlightSelector: '[data-desktop-welcome-guide="shortcuts"]',
		demoAction: 'click',
	},
	{ id: 'outro', highlightSelector: null },
] as const;

export function desktopWelcomeGuideWavUrl(stepId: string): string {
	if (!DESKTOP_WELCOME_GUIDE_AUDIO_STEP_IDS.has(stepId)) {
		return '';
	}
	return guideTourWavUrl(DESKTOP_WELCOME_GUIDE_TOUR_FOLDER, stepId);
}
