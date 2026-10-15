/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Session store for the first-visit desktop tour step so chrome can reveal
 * example UI (widgets, overflow, sync chip) without persisting settings.
 *
 * Invariants:
 * - Step id is null when the tour is closed.
 * - Listeners are notified only when the id actually changes.
 *
 * Related:
 * - DesktopWelcomeScreen.tsx, useDesktopWorkspaceWidgetsPanelProps.ts
 * - documentation/product/GUIDED-TOUR-EXCURSION.md
 */

let welcomeTourStepId: string | null = null;
const listeners = new Set<() => void>();

export function getDesktopWelcomeTourStep(): string | null {
	return welcomeTourStepId;
}

export function setDesktopWelcomeTourStep(next: string | null): void {
	if (welcomeTourStepId === next) return;
	welcomeTourStepId = next;
	for (const listener of listeners) listener();
}

export function subscribeDesktopWelcomeTourStep(
	listener: () => void
): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function welcomeTourNeedsWidgetsExample(stepId: string | null): boolean {
	return stepId === 'widgets-panel' || stepId === 'favorites-widget';
}

export function welcomeTourNeedsWorkspaceExample(
	stepId: string | null
): boolean {
	return stepId === 'workspace';
}

export function welcomeTourNeedsIconsExample(stepId: string | null): boolean {
	return stepId === 'icons';
}

export function welcomeTourNeedsShortcutsMenu(stepId: string | null): boolean {
	return stepId === 'shortcuts';
}

export function welcomeTourNeedsSyncExample(stepId: string | null): boolean {
	return stepId === 'sync-status';
}
