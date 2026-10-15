/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Gutter transition phase guards — boot race and stable height contracts.
 *
 * Related:
 * - tiptapGutterTransition.ts
 */

import { describe, expect, it } from 'vitest';
import {
	applyStableGutterHeight,
	consumePendingFullLayout,
	createGutterTransitionState,
	deferScrollResizePromotion,
	markGutterFullReady,
	markGutterViewportReady,
	requestGutterFullLayoutPromotion,
	resolveGutterHeightForPhase,
	resolveScheduledGutterScope,
	resolveStableGutterHeight,
} from './tiptapGutterTransition';

describe('tiptapGutterTransition', () => {
	it('stable gutter height never decreases during a mount session', () => {
		const state = createGutterTransitionState();
		expect(applyStableGutterHeight(state, 1200)).toBe(1200);
		expect(applyStableGutterHeight(state, 900)).toBe(1200);
		expect(applyStableGutterHeight(state, 1500)).toBe(1500);
	});

	it('defers scroll promotion during boot and coalesces pending full layout', () => {
		const state = createGutterTransitionState();
		expect(deferScrollResizePromotion(state)).toBe(true);
		expect(state.pendingFullLayout).toBe(true);
		expect(requestGutterFullLayoutPromotion(state)).toBe(false);

		const pending = markGutterViewportReady(state);
		expect(pending).toBe(true);
		expect(state.phase).toBe('viewport');
		expect(consumePendingFullLayout(state)).toBe(true);
	});

	it('allows full layout promotion after viewport is ready', () => {
		const state = createGutterTransitionState();
		markGutterViewportReady(state);
		expect(requestGutterFullLayoutPromotion(state)).toBe(true);
		markGutterFullReady(state);
		expect(state.phase).toBe('full');
		expect(state.pendingFullLayout).toBe(false);
	});

	it('resolveStableGutterHeight enforces minimum column height', () => {
		expect(resolveStableGutterHeight(120)).toBe(500);
		expect(resolveStableGutterHeight(2400, 500)).toBe(2400);
	});

	it('resolveGutterHeightForPhase converges exactly on full phase', () => {
		const state = createGutterTransitionState();
		applyStableGutterHeight(state, 7000);
		markGutterFullReady(state);
		const converged = resolveGutterHeightForPhase(state, 4300, 'full');
		expect(converged).toBe(4300);
		expect(state.stableHeightPx).toBe(4300);
	});

	it('resolveScheduledGutterScope maps viewport phase to viewport reads', () => {
		expect(resolveScheduledGutterScope('boot')).toBe('viewport');
		expect(resolveScheduledGutterScope('viewport')).toBe('viewport');
		expect(resolveScheduledGutterScope('full')).toBe('full');
	});
});
