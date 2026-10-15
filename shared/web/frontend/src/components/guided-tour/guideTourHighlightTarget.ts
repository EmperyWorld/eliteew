/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve visible spotlight targets and apply transient in-DOM highlight styling.
 *
 * Invariants:
 * - Highlight marker is removed on step change, tour close, and unmount.
 * - Prefers first painted match with a useful rect (not full-viewport, not opacity 0).
 *
 * Related:
 * - guideTourHighlightTarget.css, SpotlightGuideModal.tsx, CreativeStudioGuideTourModal.tsx
 */

import './guideTourHighlightTarget.css';

export const GUIDE_TOUR_SPOTLIGHT_TARGET_ATTR =
	'data-guide-tour-spotlight-target';

/** Full-canvas anchors (inset-0 / work-area fieldset) look like “no highlight”. */
const MAX_VIEWPORT_COVERAGE = 0.42;
const MIN_EDGE_PX = 8;

export function isUsefulGuideSpotlightRect(rect: DOMRect): boolean {
	if (rect.width < MIN_EDGE_PX || rect.height < MIN_EDGE_PX) return false;
	if (typeof window === 'undefined') return true;
	const viewportW = window.innerWidth;
	const viewportH = window.innerHeight;
	if (viewportW <= 0 || viewportH <= 0) return true;
	const coverage = (rect.width * rect.height) / (viewportW * viewportH);
	return coverage <= MAX_VIEWPORT_COVERAGE;
}

function isPaintedGuideTarget(node: HTMLElement): boolean {
	if (node.hidden) return false;
	const style = window.getComputedStyle(node);
	if (style.display === 'none' || style.visibility === 'hidden') return false;
	if (Number.parseFloat(style.opacity) === 0) return false;
	return true;
}

export function findVisibleGuideHighlight(
	root: HTMLElement,
	selector: string
): HTMLElement | null {
	const nodes = root.querySelectorAll(selector);
	for (const node of nodes) {
		if (!(node instanceof HTMLElement)) continue;
		if (!isPaintedGuideTarget(node)) continue;
		const rect = node.getBoundingClientRect();
		if (!isUsefulGuideSpotlightRect(rect)) continue;
		return node;
	}
	return null;
}

export function setGuideTourSpotlightTarget(el: HTMLElement | null): void {
	clearGuideTourSpotlightTarget();
	if (!el) return;
	el.setAttribute(GUIDE_TOUR_SPOTLIGHT_TARGET_ATTR, 'active');
}

export function clearGuideTourSpotlightTarget(): void {
	if (typeof document === 'undefined') return;
	for (const node of document.querySelectorAll(
		`[${GUIDE_TOUR_SPOTLIGHT_TARGET_ATTR}="active"]`
	)) {
		if (node instanceof HTMLElement) {
			node.removeAttribute(GUIDE_TOUR_SPOTLIGHT_TARGET_ATTR);
		}
	}
}
