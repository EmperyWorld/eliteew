/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stress tests for gutter boot stability — rapid scroll and fast typing races.
 *
 * Related:
 * - TiptapEditor.tsx
 * - tiptapGutterTransition.ts
 * - tiptapGutterStableEstimate.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildViewportGutterSkeletonLines } from './tiptapGutterStableEstimate';
import {
	applyStableGutterHeight,
	createGutterTransitionState,
	deferScrollResizePromotion,
	markGutterViewportReady,
} from './tiptapGutterTransition';

const tiptapEditorInnerSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'TiptapEditorInner.tsx'
);
const gutterLayoutHookSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'useTiptapGutterLayout.ts'
);

function mountLargeDocFixture(blockCount: number): {
	root: HTMLElement;
	scrollContainer: HTMLElement;
} {
	const scrollContainer = document.createElement('div');
	scrollContainer.setAttribute('data-doc-editor-scroll', '');
	Object.defineProperty(scrollContainer, 'clientHeight', {
		value: 480,
		configurable: true,
	});
	Object.defineProperty(scrollContainer, 'scrollHeight', {
		value: blockCount * 40,
		configurable: true,
	});
	scrollContainer.style.overflowY = 'auto';

	const root = document.createElement('div');
	root.className = 'tiptap ProseMirror';
	Object.defineProperty(root, 'scrollHeight', {
		value: blockCount * 40,
		configurable: true,
	});

	for (let index = 0; index < blockCount; index += 1) {
		const block = document.createElement('p');
		block.textContent = `Block ${index + 1}`;
		block.getBoundingClientRect = () =>
			({
				top: index * 40,
				bottom: index * 40 + 32,
				left: 0,
				right: 400,
				width: 400,
				height: 32,
				x: 0,
				y: index * 40,
				toJSON: () => ({}),
			}) as DOMRect;
		root.appendChild(block);
	}

	root.getBoundingClientRect = () =>
		({
			top: 0,
			bottom: blockCount * 40,
			left: 0,
			right: 400,
			width: 400,
			height: blockCount * 40,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		}) as DOMRect;

	scrollContainer.appendChild(root);
	document.body.appendChild(scrollContainer);
	return { root, scrollContainer };
}

describe('tiptapGutterStability', () => {
	beforeEach(() => {
		vi.spyOn(window, 'getComputedStyle').mockImplementation(
			(el: Element) =>
				({
					overflowY:
						el === document.querySelector('[data-doc-editor-scroll]')
							? 'auto'
							: 'visible',
					lineHeight: '32px',
					fontSize: '16px',
				}) as CSSStyleDeclaration
		);
	});

	afterEach(() => {
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('Test Case 1 — rapid scroller: stable height monotonic during boot scroll bursts', () => {
		const { root, scrollContainer } = mountLargeDocFixture(120);
		const transition = createGutterTransitionState();
		const heights: number[] = [];

		const recordHeight = (): void => {
			heights.push(applyStableGutterHeight(transition, root.scrollHeight));
		};

		recordHeight();
		setVisualLinesStable(root, transition, heights);
		markGutterViewportReady(transition);

		let scrollTop = 0;
		const scrollStepPx = 10;
		const steps = 20;
		for (let step = 0; step < steps; step += 1) {
			scrollTop += scrollStepPx;
			Object.defineProperty(scrollContainer, 'scrollTop', {
				value: scrollTop,
				configurable: true,
			});
			scrollContainer.getBoundingClientRect = () =>
				({
					top: 0,
					bottom: 480,
					left: 0,
					right: 400,
					width: 400,
					height: 480,
					x: 0,
					y: 0,
					toJSON: () => ({}),
				}) as DOMRect;

			if (deferScrollResizePromotion(transition)) {
				continue;
			}
			setVisualLinesStable(root, transition, heights);
			recordHeight();
		}

		for (let index = 1; index < heights.length; index += 1) {
			expect(heights[index]).toBeGreaterThanOrEqual(heights[index - 1] ?? 0);
		}
		expect(heights[0]).toBeGreaterThanOrEqual(500);
	});

	it('Test Case 2 — fast typer: boot defers full layout without collapsing to placeholder', () => {
		const { root } = mountLargeDocFixture(80);
		const transition = createGutterTransitionState();
		const stableHeight = applyStableGutterHeight(transition, root.scrollHeight);
		const skeleton = buildViewportGutterSkeletonLines(root, 32);

		expect(skeleton.length).toBeGreaterThan(1);
		expect(stableHeight).toBeGreaterThanOrEqual(500);

		expect(deferScrollResizePromotion(transition)).toBe(true);
		expect(transition.pendingFullLayout).toBe(true);

		const linesAfterFastEditIntent = skeleton;
		expect(linesAfterFastEditIntent.length).toBeGreaterThan(1);
		expect(linesAfterFastEditIntent[0]?.lineNumber).toBe(1);

		markGutterViewportReady(transition);
		expect(transition.phase).toBe('viewport');
	});

	it('gutter layout hook does not use requestIdleCallback for gutter boot', () => {
		const hookSrc = readFileSync(gutterLayoutHookSourcePath, 'utf8');
		const innerSrc = readFileSync(tiptapEditorInnerSourcePath, 'utf8');
		expect(hookSrc).not.toMatch(/requestIdleCallback/);
		expect(innerSrc).not.toMatch(/requestIdleCallback/);
		expect(hookSrc).toMatch(/useLayoutEffect/);
		expect(hookSrc).toMatch(/resolveGutterContentRoot/);
		expect(hookSrc).toMatch(/resolveGutterHeightForPhase/);
	});
});

function setVisualLinesStable(
	root: HTMLElement,
	transition: ReturnType<typeof createGutterTransitionState>,
	heights: number[]
): void {
	const skeleton = buildViewportGutterSkeletonLines(root, 32);
	expect(skeleton.length).toBeGreaterThan(0);
	heights.push(applyStableGutterHeight(transition, root.scrollHeight));
}
