/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure Step FSM helpers for launcher rail reachability and post-seat routing.
 *
 * Invariants:
 * - Legacy order: home → tunnel → license → shell (ops debug only).
 * - Retail sealed: home ↔ shell only; never route users to tunnel/license editors.
 *
 * Related:
 * - features/home/HomeScreen.tsx
 * - lib/launcher/retailSealed.ts
 */

import { isRetailSealedUi } from './retailSealed';

export type LauncherStep = 'home' | 'tunnel' | 'license' | 'shell';

export const LAUNCHER_STEPS: readonly LauncherStep[] = [
	'home',
	'tunnel',
	'license',
	'shell',
] as const;

/** Retail sealed rail — no Channel/License product steps. */
export const RETAIL_SEALED_STEPS: readonly LauncherStep[] = [
	'home',
	'shell',
] as const;

export const STEP_META: Record<LauncherStep, { label: string; index: number }> =
	{
		home: { label: 'Старт', index: 0 },
		tunnel: { label: 'Канал', index: 1 },
		license: { label: 'Лицензия', index: 2 },
		shell: { label: 'Рабочий стол', index: 3 },
	};

export function launcherStepsForUi(): readonly LauncherStep[] {
	return isRetailSealedUi() ? RETAIL_SEALED_STEPS : LAUNCHER_STEPS;
}

export function isStepReachable(
	current: LauncherStep,
	target: LauncherStep
): boolean {
	if (isRetailSealedUi()) {
		if (target === 'tunnel' || target === 'license') return false;
		const sealedIndex = (s: LauncherStep) =>
			s === 'home' ? 0 : s === 'shell' ? 1 : -1;
		const ci = sealedIndex(current);
		const ti = sealedIndex(target);
		if (ci < 0 || ti < 0) return false;
		return ti <= ci;
	}
	return STEP_META[target].index <= STEP_META[current].index;
}

export type SeatRouteInput = {
	mode: 'offline' | 'cloud' | 'both';
	entitlementOk: boolean;
	hasWgConf: boolean;
	redeemSucceeded: boolean;
	redeemAttempted: boolean;
};

/**
 * Next step after seat/capsule import.
 * Retail sealed: shell on success, home on failure (never tunnel/license editors).
 */
export function nextStepAfterSeatImport(input: SeatRouteInput): LauncherStep {
	if (isRetailSealedUi()) {
		if (input.mode === 'offline' && input.entitlementOk) return 'shell';
		if (input.redeemSucceeded) return 'shell';
		if (input.entitlementOk) return 'shell';
		return 'home';
	}
	if (input.mode === 'offline' && input.entitlementOk) {
		return 'shell';
	}
	if (input.redeemSucceeded) {
		return 'shell';
	}
	if (input.redeemAttempted && !input.redeemSucceeded) {
		return 'license';
	}
	if (input.entitlementOk) {
		return 'shell';
	}
	return input.hasWgConf ? 'license' : 'tunnel';
}
