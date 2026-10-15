/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize users.preferences.video_calls.call_target for Связи → Телефон UI.
 *
 * Invariants:
 * - Unknown values collapse to both (server default).
 *
 * Related:
 * - MobileHubCallTargetPanel.tsx, documentation/product/INTERNAL-VIDEO-CALLS.md
 */

import type { VideoCallTarget } from '@/types/profile';

export const VIDEO_CALL_TARGETS: VideoCallTarget[] = [
	'both',
	'desktop_only',
	'mobile_only',
];

export function normalizeCallTarget(raw: unknown): VideoCallTarget {
	const value = String(raw ?? '')
		.trim()
		.toLowerCase();
	if (value === 'desktop_only' || value === 'mobile_only' || value === 'both') {
		return value;
	}
	return 'both';
}
