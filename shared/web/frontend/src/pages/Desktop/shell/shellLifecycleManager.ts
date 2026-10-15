/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell Lifecycle Manager (SLM) public entry for Desktop shell — companion view
 * prefs (dismiss/pin/collapse). Apps must call this facade, not invent localStorage.
 *
 * Invariants:
 * - Dismiss/collapse never cancel server task runs.
 * - Storage implementation lives in companionSurfaceLifecycle (same localStorage key).
 * - Active missions ignore collapse at read time.
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md §U0 / Part B
 * - src/pages/Desktop/shell/useCompanionViewPrefs.ts
 * - src/features/ewa/companionOutputSurface/companionSurfaceLifecycle.ts
 */

export type {
	CompanionSurfaceLifecycleState,
	CompanionViewPrefs,
} from '@/features/ewa/companionOutputSurface/companionSurfaceLifecycle';

export {
	dismissCompanionRunInSurfaceLifecycle as dismissCompanionCard,
	getCompanionViewPrefs,
	isMissionChromeCollapsed,
	setMissionCollapsed,
	subscribeCompanionSurfaceLifecycle as subscribeShellLifecycle,
} from '@/features/ewa/companionOutputSurface/companionSurfaceLifecycle';
