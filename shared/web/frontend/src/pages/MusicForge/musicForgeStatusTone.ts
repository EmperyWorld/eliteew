/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Header status surface tones for MusicForge run lifecycle states.
 *
 * Related:
 * - MusicForgeApp.tsx
 */

import type { MusicForgeRun } from '@/services/musicForge/musicForgeApi';

export function musicForgeHeaderStatusTone(
	run: MusicForgeRun | null,
	cancelPending: boolean
): string {
	if (cancelPending) {
		return 'border-amber-400/30 bg-amber-500/10';
	}
	if (!run) {
		return 'border-white/10 bg-black/20';
	}
	switch (run.status) {
		case 'completed':
			return 'border-emerald-400/30 bg-emerald-500/10';
		case 'failed':
			return 'border-rose-400/30 bg-rose-500/10';
		case 'cancelled':
			return 'border-amber-400/30 bg-amber-500/10';
		case 'queued':
		case 'running':
			return 'border-fuchsia-400/30 bg-fuchsia-500/10';
		default:
			return 'border-white/10 bg-black/20';
	}
}

export function musicForgeHeaderStatusTextTone(
	run: MusicForgeRun | null,
	cancelPending: boolean
): string {
	if (cancelPending) return 'text-amber-50';
	if (!run) return 'text-white';
	switch (run.status) {
		case 'completed':
			return 'text-emerald-50';
		case 'failed':
			return 'text-rose-50';
		case 'cancelled':
			return 'text-amber-50';
		case 'queued':
		case 'running':
			return 'text-fuchsia-50';
		default:
			return 'text-white';
	}
}
