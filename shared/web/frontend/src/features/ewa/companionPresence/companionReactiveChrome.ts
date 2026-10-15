/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Work-load intensity for companion reactive chrome — chat pending stream and durable operations.
 *
 * Invariants:
 * - Pure functions; intensity is 0..1 for CSS `--companion-work-intensity`.
 *
 * Related:
 * - src/features/ewa/companionPresence/companionMoodPalette.ts
 * - api/ewa_platform/companion/ux/reactive_chrome.py
 */
import type { CompanionStreamPhase } from '@/features/ewa/companionPresence/CompanionSigil';

function clamp(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

export type CompanionWorkIntensityInput = {
	pending: boolean;
	streamPhase: CompanionStreamPhase;
	activeOperationCount: number;
};

/** 0 = idle palette; 1 = full work/mood heat (operations + streaming). */
export function computeCompanionWorkIntensity(
	input: CompanionWorkIntensityInput
): number {
	let intensity = 0;

	if (input.pending) {
		if (input.streamPhase === 'streaming') intensity = 0.62;
		else if (input.streamPhase === 'waiting') intensity = 0.48;
		else intensity = 0.36;
	}

	if (input.activeOperationCount > 0) {
		const opsBoost = 0.42 + Math.min(input.activeOperationCount, 4) * 0.16;
		intensity = Math.max(intensity, opsBoost);
	}

	return clamp(intensity, 0, 1);
}

export const COMPANION_WORK_CHROME_ACTIVE_THRESHOLD = 0.1;

export function isCompanionWorkChromeActive(intensity: number): boolean {
	return intensity >= COMPANION_WORK_CHROME_ACTIVE_THRESHOLD;
}

/** Foreground EWA with no chat/ops work — pause ambient sigil loops (GPU budget). */
export function isCompanionPresenceAtRest(input: {
	isDesktopWindowActive: boolean;
	pending: boolean;
	streamPhase: CompanionStreamPhase;
	workChromeActive: boolean;
}): boolean {
	return (
		input.isDesktopWindowActive &&
		!input.pending &&
		input.streamPhase === 'idle' &&
		!input.workChromeActive
	);
}
