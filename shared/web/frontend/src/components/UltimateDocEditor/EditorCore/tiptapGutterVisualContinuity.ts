/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual continuity for gutter layout commits — scroll anchoring and line metric stabilization.
 *
 * Invariants:
 * - Editor scrollTop is restored when gutter geometry commits run.
 * - Line tops drift less than GUTTER_VISUAL_LINE_TOP_EPS_PX when refining skeleton → viewport.
 *
 * Related:
 * - TiptapEditor.tsx
 * - tiptapGutterTransition.ts
 */

import type { GutterLayoutPhase } from './tiptapGutterTransition';

export const GUTTER_HEIGHT_TRANSITION_MS = 150;
export const GUTTER_LINE_TOP_STABILIZE_EPS_PX = 4;

export interface GutterLineMetric {
	lineNumber: number;
	top: number;
	height: number;
	isWrapContinuation: boolean;
}

export interface GutterLayoutCommitTrace {
	scrollTopBefore: number;
	scrollTopAfterApply: number;
	scrollTopAfterAnchor: number;
	heightBefore: number;
	heightAfter: number;
	scrollAnchored: boolean;
	heightDeltaPx: number;
}

export function applyGutterLayoutWithScrollAnchor(
	scrollContainer: HTMLElement | null,
	heightBefore: number,
	heightAfter: number,
	apply: () => void
): GutterLayoutCommitTrace {
	const scrollTopBefore = scrollContainer?.scrollTop ?? 0;
	apply();
	const scrollTopAfterApply = scrollContainer?.scrollTop ?? 0;

	let scrollTopAfterAnchor = scrollTopAfterApply;
	if (
		scrollContainer &&
		Math.abs(scrollTopAfterApply - scrollTopBefore) > 0.5
	) {
		scrollContainer.scrollTop = scrollTopBefore;
		scrollTopAfterAnchor = scrollContainer.scrollTop;
	}

	return {
		scrollTopBefore,
		scrollTopAfterApply,
		scrollTopAfterAnchor,
		heightBefore,
		heightAfter,
		scrollAnchored: Math.abs(scrollTopAfterAnchor - scrollTopBefore) <= 0.5,
		heightDeltaPx: heightAfter - heightBefore,
	};
}

export function scheduleScrollAnchorAfterPaint(
	scrollContainer: HTMLElement | null,
	scrollTopBefore: number
): void {
	if (!scrollContainer || typeof window === 'undefined') {
		return;
	}
	window.requestAnimationFrame(() => {
		if (Math.abs(scrollContainer.scrollTop - scrollTopBefore) > 0.5) {
			scrollContainer.scrollTop = scrollTopBefore;
		}
	});
}

/**
 * Boot/viewport: never shrink height (anti-CLS). Full: exact content height.
 * Returns whether a CSS height transition should run (increase-only during transition).
 */
export function resolveCommittedGutterHeight(
	phase: GutterLayoutPhase,
	stableHeightPx: number,
	contentScrollHeightPx: number,
	minHeightPx = 500
): { heightPx: number; shouldAnimateHeight: boolean } {
	const target = Math.max(contentScrollHeightPx, minHeightPx);
	if (phase === 'full') {
		return { heightPx: target, shouldAnimateHeight: false };
	}
	const next = Math.max(stableHeightPx, target);
	const shouldAnimateHeight =
		stableHeightPx > 0 && next > stableHeightPx && next - stableHeightPx <= 64;
	return { heightPx: next, shouldAnimateHeight };
}

export function stabilizeVisualLineMetrics(
	previous: GutterLineMetric[],
	next: GutterLineMetric[]
): GutterLineMetric[] {
	if (previous.length === 0) {
		return next;
	}
	const previousByKey = new Map<string, GutterLineMetric>();
	for (const line of previous) {
		previousByKey.set(
			`${line.lineNumber}:${line.isWrapContinuation ? 'w' : 'b'}`,
			line
		);
	}
	return next.map((line) => {
		const key = `${line.lineNumber}:${line.isWrapContinuation ? 'w' : 'b'}`;
		const prior = previousByKey.get(key);
		if (!prior) {
			return line;
		}
		if (
			Math.abs(prior.top - line.top) <= GUTTER_LINE_TOP_STABILIZE_EPS_PX &&
			Math.abs(prior.height - line.height) <= GUTTER_LINE_TOP_STABILIZE_EPS_PX
		) {
			return prior;
		}
		if (Math.abs(prior.top - line.top) <= GUTTER_LINE_TOP_STABILIZE_EPS_PX) {
			return { ...line, top: prior.top };
		}
		return line;
	});
}

export function gutterTrackStructureFingerprint(
	track: ParentNode | null
): string {
	if (!track) {
		return 'missing';
	}
	const element = track as HTMLElement;
	const childCount = element.childElementCount;
	const role = element.getAttribute('data-gutter-track') ?? 'none';
	return `${role}|${childCount}|${element.tagName}`;
}
