/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Center-mission view prefs — thin adapter over Shell Lifecycle Manager so center
 * canvas and Operations share durable dismiss/collapse without app-local storage.
 *
 * Invariants:
 * - Dismiss/collapse never cancel a task run; they only hide/reshape chrome.
 * - Active / truthfully-live missions ignore dismiss and collapse until terminal.
 *
 * Related:
 * - src/pages/Desktop/shell/shellLifecycleManager.ts
 * - src/features/ewa/companionUx/CompanionCenterMissionCanvas.tsx
 */

import {
	dismissCompanionCard,
	isMissionChromeCollapsed,
	setMissionCollapsed,
	subscribeShellLifecycle,
} from '@/pages/Desktop/shell/shellLifecycleManager';
import {
	dismissedCompanionRunIdsFromLifecycle,
	isCompanionRunIdDismissed,
	loadCompanionSurfaceLifecycleState,
} from '@/features/ewa/companionOutputSurface/companionSurfaceLifecycle';

export function loadDismissedCenterMissionRunIds(
	principalId: string
): string[] {
	return dismissedCompanionRunIdsFromLifecycle(
		loadCompanionSurfaceLifecycleState(principalId)
	);
}

export function dismissCenterMissionRunId(
	principalId: string,
	runId: string,
	_current: string[]
): string[] {
	const next = dismissCompanionCard(principalId, runId);
	return dismissedCompanionRunIdsFromLifecycle(next);
}

export function isCenterMissionRunDismissed(
	principalId: string,
	runId: string
): boolean {
	return isCompanionRunIdDismissed(
		runId,
		loadCompanionSurfaceLifecycleState(principalId)
	);
}

export function isCenterMissionChromeCollapsed(
	principalId: string,
	runId: string,
	isActive: boolean
): boolean {
	return isMissionChromeCollapsed(principalId, runId, isActive);
}

export function setCenterMissionChromeCollapsed(
	principalId: string,
	runId: string,
	collapsed: boolean
): void {
	setMissionCollapsed(principalId, runId, collapsed);
}

export { subscribeShellLifecycle as subscribeCompanionSurfaceLifecycle };
