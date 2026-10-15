/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared helpers for UGS Hub result previews (audio caption track placeholder).
 *
 * Invariants:
 * - User-visible VTT cue text comes from `ugsHub.result.vttFallbackCue`.
 *
 * Related:
 * - UgsHubUnifiedContentPreviews.tsx, UgsHubResultContent.tsx
 */

import type { TFunction } from 'i18next';

/** Minimal WebVTT data URL for `<audio>` a11y when no real transcript exists */
export const buildUgsHubAudioPlaceholderCaptionsVtt = (
	t: TFunction<'ugsHub'>
): string =>
	`data:text/vtt;charset=utf-8,${encodeURIComponent(
		`WEBVTT\n\n00:00:00.000 --> 99:59:59.000\n${t('result.vttFallbackCue')}\n`
	)}`;
