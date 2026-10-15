/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual continuity proofs — scroll anchor, boot→full pipeline, line stabilization.
 *
 * Related:
 * - tiptapGutterVisualContinuity.ts
 * - TiptapEditor.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildViewportGutterSkeletonLines } from './tiptapGutterStableEstimate';
import {
	applyStableGutterHeight,
	createGutterTransitionState,
	markGutterFullReady,
	markGutterViewportReady,
	resolveGutterHeightForPhase,
} from './tiptapGutterTransition';
import {
	applyGutterLayoutWithScrollAnchor,
	gutterTrackStructureFingerprint,
	resolveCommittedGutterHeight,
	scheduleScrollAnchorAfterPaint,
	stabilizeVisualLineMetrics,
} from './tiptapGutterVisualContinuity';

const tiptapEditorInnerSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'TiptapEditorInner.tsx'
);
const gutterLayoutHookSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'useTiptapGutterLayout.ts'
);
const tiptapLineGutterSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'TiptapLineGutter.tsx'
);

function mountEditorScrollFixture(contentScrollHeight: number): {
	scrollContainer: HTMLElement;
	track: HTMLElement;
	root: HTMLElement;
} {
	const scrollContainer = document.createElement('div');
	scrollContainer.setAttribute('data-doc-editor-scroll', '');
	Object.defineProperty(scrollContainer, 'clientHeight', {
		value: 480,
		configurable: true,
	});
	Object.defineProperty(scrollContainer, 'scrollHeight', {
		value: contentScrollHeight,
		configurable: true,
	});
	scrollContainer.style.overflowY = 'auto';
	Object.defineProperty(scrollContainer, 'scrollTop', {
		value: 240,
		writable: true,
		configurable: true,
	});

	const root = document.createElement('div');
	root.className = 'ProseMirror';
	root.setAttribute('contenteditable', 'true');
	Object.defineProperty(root, 'scrollHeight', {
		value: contentScrollHeight,
		configurable: true,
	});
	for (let index = 0; index < 40; index += 1) {
		const block = document.createElement('p');
		block.textContent = `Line ${index + 1}`;
		block.getBoundingClientRect = () =>
			({
				top: index * 32,
				bottom: index * 32 + 28,
				left: 0,
				right: 400,
				width: 400,
				height: 28,
				x: 0,
				y: index * 32,
				toJSON: () => ({}),
			}) as DOMRect;
		root.appendChild(block);
	}
	root.getBoundingClientRect = () =>
		({
			top: 0,
			bottom: contentScrollHeight,
			left: 0,
			right: 400,
			width: 400,
			height: contentScrollHeight,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		}) as DOMRect;

	const track = document.createElement('div');
	track.setAttribute('data-gutter-track', '');
	track.style.height = '500px';

	scrollContainer.appendChild(root);
	document.body.appendChild(scrollContainer);
	document.body.appendChild(track);
	return { scrollContainer, track, root };
}

describe('tiptapGutterVisualContinuity', () => {
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

	it('Jump Proof — scrollTop preserved when gutter height commits', () => {
		const { scrollContainer } = mountEditorScrollFixture(3200);
		const scrollTopBefore = scrollContainer.scrollTop;

		const trace = applyGutterLayoutWithScrollAnchor(
			scrollContainer,
			500,
			3200,
			() => {
				scrollContainer.scrollTop = 999;
			}
		);

		expect(trace.scrollTopBefore).toBe(scrollTopBefore);
		expect(trace.scrollAnchored).toBe(true);
		expect(trace.scrollTopAfterAnchor).toBe(scrollTopBefore);
	});

	it('Jump Proof — post-paint rAF re-applies scroll anchor if browser drift occurs', () => {
		const { scrollContainer } = mountEditorScrollFixture(3200);
		const scrollTopBefore = 240;
		scrollContainer.scrollTop = scrollTopBefore;

		const rafQueue: FrameRequestCallback[] = [];
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			rafQueue.push(cb);
			return rafQueue.length;
		});

		scheduleScrollAnchorAfterPaint(scrollContainer, scrollTopBefore);
		scrollContainer.scrollTop = 480;
		rafQueue.shift()?.(0);

		expect(scrollContainer.scrollTop).toBe(scrollTopBefore);
	});

	it('Final Convergence + Visual — boot→viewport→full keeps height equal to content when stable', () => {
		const { root, scrollContainer, track } = mountEditorScrollFixture(3200);
		const transition = createGutterTransitionState();
		const structureBefore = gutterTrackStructureFingerprint(track);

		const bootHeight = applyStableGutterHeight(transition, root.scrollHeight);
		const skeleton = buildViewportGutterSkeletonLines(root, 32);
		applyGutterLayoutWithScrollAnchor(scrollContainer, 0, bootHeight, () => {
			track.style.height = `${bootHeight}px`;
		});
		markGutterViewportReady(transition);

		const viewportHeight = applyStableGutterHeight(
			transition,
			root.scrollHeight
		);
		applyGutterLayoutWithScrollAnchor(
			scrollContainer,
			bootHeight,
			viewportHeight,
			() => {
				track.style.height = `${viewportHeight}px`;
			}
		);

		markGutterFullReady(transition);
		const fullHeight = resolveGutterHeightForPhase(
			transition,
			root.scrollHeight,
			'full'
		);
		applyGutterLayoutWithScrollAnchor(
			scrollContainer,
			viewportHeight,
			fullHeight,
			() => {
				track.style.height = `${fullHeight}px`;
			}
		);

		expect(bootHeight).toBe(3200);
		expect(viewportHeight).toBe(3200);
		expect(fullHeight).toBe(3200);
		expect(Number.parseInt(track.style.height, 10)).toBe(root.scrollHeight);
		expect(gutterTrackStructureFingerprint(track)).toBe(structureBefore);
		expect(scrollContainer.scrollTop).toBe(240);
		expect(skeleton.length).toBeGreaterThan(0);
	});

	it('Double-Jump guard — viewport phase never shrinks committed height', () => {
		const { heightPx: boot } = resolveCommittedGutterHeight('boot', 0, 3200);
		const { heightPx: viewport } = resolveCommittedGutterHeight(
			'viewport',
			boot,
			3200
		);
		const { heightPx: full } = resolveCommittedGutterHeight(
			'full',
			viewport,
			3200
		);

		expect(boot).toBe(3200);
		expect(viewport).toBe(3200);
		expect(full).toBe(3200);
	});

	it('line metric stabilization prevents sub-pixel flicker on skeleton refine', () => {
		const previous = [
			{
				lineNumber: 1,
				top: 24,
				height: 32,
				isWrapContinuation: false as const,
			},
		];
		const refined = [
			{
				lineNumber: 1,
				top: 25,
				height: 32,
				isWrapContinuation: false as const,
			},
		];
		const stabilized = stabilizeVisualLineMetrics(previous, refined);
		expect(stabilized[0]?.top).toBe(24);
	});

	it('gutter layout hook wires scroll anchor and line gutter owns track markup', () => {
		const hookSrc = readFileSync(gutterLayoutHookSourcePath, 'utf8');
		const gutterSrc = readFileSync(tiptapLineGutterSourcePath, 'utf8');
		const innerSrc = readFileSync(tiptapEditorInnerSourcePath, 'utf8');
		expect(hookSrc).toMatch(/applyGutterLayoutWithScrollAnchor/);
		expect(hookSrc).toMatch(/scheduleScrollAnchorAfterPaint/);
		expect(hookSrc).toMatch(/stabilizeVisualLineMetrics/);
		expect(gutterSrc).toMatch(/data-gutter-track/);
		expect(gutterSrc).toMatch(/transition-\[height\]/);
		expect(innerSrc).toMatch(/useTiptapGutterLayout\(/);
		expect(innerSrc).toMatch(/<TiptapLineGutter/);
	});
});
