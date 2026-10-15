/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * One-shot session restore notice when companion output surface reloads from sessionStorage.
 *
 * Invariants:
 * - Notice fires at most once per browser tab session per principal.
 *
 * Related:
 * - companionOutputSurfaceState.ts
 * - CompanionOutputSurface.tsx
 */

import type { CompanionOutputSurfaceState } from '@/features/ewa/companionOutputSurface/types';

const RESTORE_NOTICE_PREFIX =
	'eliteew.ewaCompanion.surfaceRestoreNotice.v1::session::';

function sessionNoticeKey(principalId: string): string {
	return `${RESTORE_NOTICE_PREFIX}${principalId.trim()}`;
}

function readPayloadTitle(
	payload: Record<string, unknown> | undefined
): string {
	if (!payload) return '';
	const title = payload.title;
	return typeof title === 'string' && title.trim() ? title.trim() : '';
}

export function consumeCompanionSurfaceRestoreNotice(args: {
	principalId: string;
	state: CompanionOutputSurfaceState;
}): { mode: CompanionOutputSurfaceState['mode']; title: string } | null {
	if (typeof window === 'undefined' || !args.principalId.trim()) return null;
	if (args.state.mode === 'chat') return null;
	const key = sessionNoticeKey(args.principalId);
	try {
		if (window.sessionStorage.getItem(key) === '1') return null;
		window.sessionStorage.setItem(key, '1');
	} catch {
		return null;
	}
	const title = readPayloadTitle(args.state.payload);
	return { mode: args.state.mode, title };
}
