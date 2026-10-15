/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Gutter layout hook for Ultimate Doc Editor — visual line measurement, debounced
 * updates, ResizeObserver, scroll anchor, bootstrap phases, and blur flush wiring.
 *
 * Invariants:
 * - Full-document layout reads are debounced (GUTTER_LAYOUT_DEBOUNCE_MS) and canceled on cleanup.
 * - Boot gutter: sync stable height + viewport skeleton in useLayoutEffect; rAF viewport refine + background full.
 * - Blur flushes pending gutter layout and invokes onDocumentFlush when provided.
 *
 * Related:
 * - TiptapEditor.tsx, TiptapLineGutter.tsx, tiptapGutterMeasure.ts
 */
import type { Editor } from '@tiptap/react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type RefObject,
} from 'react';
import {
	GUTTER_LAYOUT_DEBOUNCE_MS,
	measureVisualRowsInBlock,
	type VisualLineMetric,
} from './tiptapGutterMeasure';
import {
	cancelGutterLayoutFrame,
	scheduleGutterBackgroundFullLayout,
	scheduleGutterPostPaintWork,
	type GutterLayoutFrameHandle,
} from './tiptapGutterLayoutScheduling';
import { buildViewportGutterSkeletonLines } from './tiptapGutterStableEstimate';
import {
	resolveGutterContentRoot,
	resolveGutterScrollContainer,
} from './tiptapGutterDomContract';
import {
	applyGutterLayoutWithScrollAnchor,
	resolveCommittedGutterHeight,
	scheduleScrollAnchorAfterPaint,
	stabilizeVisualLineMetrics,
} from './tiptapGutterVisualContinuity';
import {
	type GutterLayoutScope,
	isBlockInGutterViewport,
	resolveProseMirrorViewportRect,
} from './tiptapGutterViewportScope';
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
	type GutterTransitionState,
} from './tiptapGutterTransition';

export interface UseTiptapGutterLayoutParams {
	editor: Editor | null;
	editorHostRef: RefObject<HTMLDivElement | null>;
	onDocumentFlushRef: RefObject<
		((payload: { editor: Editor }) => void) | undefined
	>;
}

export interface UseTiptapGutterLayoutResult {
	visualLines: VisualLineMetric[];
	gutterHeight: number;
	gutterTrackTransitionEnabled: boolean;
}

export function useTiptapGutterLayout({
	editor,
	editorHostRef,
	onDocumentFlushRef,
}: UseTiptapGutterLayoutParams): UseTiptapGutterLayoutResult {
	const visualLinesRafRef = useRef<number | null>(null);
	const gutterLayoutTimerRef = useRef<number | null>(null);
	const gutterBootstrapFrameRef = useRef<GutterLayoutFrameHandle | null>(null);
	const gutterBackgroundFullFrameRef = useRef<GutterLayoutFrameHandle | null>(
		null
	);
	const gutterTransitionRef = useRef<GutterTransitionState>(
		createGutterTransitionState()
	);
	const previousVisualLinesRef = useRef<VisualLineMetric[]>([]);
	const [visualLines, setVisualLines] = useState<VisualLineMetric[]>([
		{ lineNumber: 1, top: 24, height: 32, isWrapContinuation: false },
	]);
	const [gutterHeight, setGutterHeight] = useState(500);
	const [gutterTrackTransitionEnabled, setGutterTrackTransitionEnabled] =
		useState(false);
	const isMountedRef = useRef(true);

	useEffect(() => {
		return () => {
			if (visualLinesRafRef.current !== null) {
				window.cancelAnimationFrame(visualLinesRafRef.current);
			}
			if (gutterLayoutTimerRef.current !== null) {
				window.clearTimeout(gutterLayoutTimerRef.current);
			}
			cancelGutterLayoutFrame(gutterBootstrapFrameRef.current);
			gutterBootstrapFrameRef.current = null;
			cancelGutterLayoutFrame(gutterBackgroundFullFrameRef.current);
			gutterBackgroundFullFrameRef.current = null;
		};
	}, []);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const updateVisualLines = useCallback(
		(scope: GutterLayoutScope = 'full'): void => {
			if (!isMountedRef.current) {
				return;
			}
			if (!editor || (editor as { isDestroyed?: boolean }).isDestroyed) {
				return;
			}

			const root = resolveGutterContentRoot(editorHostRef.current);
			if (!root) {
				setVisualLines([
					{ lineNumber: 1, top: 24, height: 32, isWrapContinuation: false },
				]);
				setGutterHeight(500);
				return;
			}

			if (scope === 'full') {
				markGutterFullReady(gutterTransitionRef.current);
			}

			const viewportRect =
				scope === 'viewport' ? resolveProseMirrorViewportRect(root) : null;

			const rootRect = root.getBoundingClientRect();
			const rootStyle = window.getComputedStyle(root);
			const fallbackLineHeight = Number.parseFloat(rootStyle.lineHeight) || 32;
			const nextLines: VisualLineMetric[] = [];
			let nextLineNumber = 1;

			const shouldMeasureBlock = (element: HTMLElement): boolean => {
				if (scope === 'full' || !viewportRect) {
					return true;
				}
				return isBlockInGutterViewport(element, viewportRect);
			};

			/**
			 * One block index per logical block; continuation visual rows use ↳. Row geometry
			 * comes from layout (getClientRects), not height/lineHeight division.
			 */
			const pushBlockGutterRows = (element: HTMLElement): void => {
				const blockNum = nextLineNumber;
				const rows = measureVisualRowsInBlock(
					element,
					rootRect,
					fallbackLineHeight
				);
				rows.forEach((row, index) => {
					nextLines.push({
						lineNumber: blockNum,
						top: row.top,
						height: row.height,
						isWrapContinuation: index > 0,
					});
				});
				nextLineNumber += 1;
			};

			const processBlock = (element: HTMLElement): void => {
				if (!shouldMeasureBlock(element)) {
					nextLineNumber += 1;
					return;
				}
				const tag = element.tagName;
				if ((tag === 'UL' || tag === 'OL') && element.children.length > 0) {
					Array.from(element.children).forEach((child) => {
						if (child instanceof HTMLElement && child.tagName === 'LI') {
							if (!shouldMeasureBlock(child)) {
								nextLineNumber += 1;
								return;
							}
							pushBlockGutterRows(child);
						}
					});
					return;
				}
				if (tag === 'BLOCKQUOTE' && element.children.length > 0) {
					Array.from(element.children).forEach((child) => {
						if (child instanceof HTMLElement) {
							processBlock(child);
						}
					});
					return;
				}

				pushBlockGutterRows(element);
			};

			const blocks = Array.from(root.children).filter(
				(child): child is HTMLElement => child instanceof HTMLElement
			);

			if (blocks.length === 0) {
				nextLines.push({
					lineNumber: 1,
					top: 24,
					height: fallbackLineHeight,
					isWrapContinuation: false,
				});
			} else {
				blocks.forEach(processBlock);
			}

			if (nextLines.length === 0) {
				nextLines.push({
					lineNumber: 1,
					top: 24,
					height: fallbackLineHeight,
					isWrapContinuation: false,
				});
			}

			setVisualLines(nextLines);
			const scrollContainer = resolveGutterScrollContainer(root);
			const layoutPhase =
				scope === 'full' ? 'full' : gutterTransitionRef.current.phase;
			const stabilizedLines =
				layoutPhase !== 'full' && previousVisualLinesRef.current.length > 0
					? stabilizeVisualLineMetrics(
							previousVisualLinesRef.current,
							nextLines
						)
					: nextLines;
			const heightBefore = gutterTransitionRef.current.stableHeightPx;
			const stableHeight = resolveGutterHeightForPhase(
				gutterTransitionRef.current,
				root.scrollHeight,
				layoutPhase
			);
			const { shouldAnimateHeight } = resolveCommittedGutterHeight(
				layoutPhase,
				heightBefore,
				root.scrollHeight
			);
			const scrollTopBefore = scrollContainer?.scrollTop ?? 0;

			applyGutterLayoutWithScrollAnchor(
				scrollContainer,
				heightBefore,
				stableHeight,
				() => {
					previousVisualLinesRef.current = stabilizedLines;
					setGutterTrackTransitionEnabled(shouldAnimateHeight);
					setVisualLines(stabilizedLines);
					setGutterHeight(stableHeight);
				}
			);
			scheduleScrollAnchorAfterPaint(scrollContainer, scrollTopBefore);
		},
		[editor, editorHostRef]
	);

	const scheduleUpdateVisualLines = useCallback((): void => {
		if (!requestGutterFullLayoutPromotion(gutterTransitionRef.current)) {
			return;
		}
		if (gutterLayoutTimerRef.current !== null) {
			window.clearTimeout(gutterLayoutTimerRef.current);
		}
		gutterLayoutTimerRef.current = window.setTimeout(() => {
			gutterLayoutTimerRef.current = null;
			if (visualLinesRafRef.current !== null) {
				return;
			}
			visualLinesRafRef.current = window.requestAnimationFrame(() => {
				visualLinesRafRef.current = null;
				const scope = resolveScheduledGutterScope(
					gutterTransitionRef.current.phase
				);
				updateVisualLines(scope);
			});
		}, GUTTER_LAYOUT_DEBOUNCE_MS);
	}, [updateVisualLines]);

	const flushUpdateVisualLines = useCallback((): void => {
		if (gutterLayoutTimerRef.current !== null) {
			window.clearTimeout(gutterLayoutTimerRef.current);
			gutterLayoutTimerRef.current = null;
		}
		if (visualLinesRafRef.current !== null) {
			window.cancelAnimationFrame(visualLinesRafRef.current);
			visualLinesRafRef.current = null;
		}
		markGutterFullReady(gutterTransitionRef.current);
		updateVisualLines('full');
	}, [updateVisualLines]);

	const runViewportGutterInitialLayout = useCallback((): void => {
		updateVisualLines('viewport');
	}, [updateVisualLines]);

	const bootstrapGutterLayout = useCallback((): void => {
		if (!editor || (editor as { isDestroyed?: boolean }).isDestroyed) {
			return;
		}
		const root = resolveGutterContentRoot(editorHostRef.current);
		if (!root) {
			return;
		}

		const rootStyle = window.getComputedStyle(root);
		const fallbackLineHeight = Number.parseFloat(rootStyle.lineHeight) || 32;
		const skeletonLines = buildViewportGutterSkeletonLines(
			root,
			fallbackLineHeight
		);
		const scrollContainer = resolveGutterScrollContainer(root);
		const stableHeight = applyStableGutterHeight(
			gutterTransitionRef.current,
			root.scrollHeight
		);
		const scrollTopBefore = scrollContainer?.scrollTop ?? 0;

		applyGutterLayoutWithScrollAnchor(scrollContainer, 0, stableHeight, () => {
			previousVisualLinesRef.current = skeletonLines;
			setGutterTrackTransitionEnabled(false);
			setGutterHeight(stableHeight);
			setVisualLines(skeletonLines);
		});
		scheduleScrollAnchorAfterPaint(scrollContainer, scrollTopBefore);

		const hadPendingFull = markGutterViewportReady(gutterTransitionRef.current);

		cancelGutterLayoutFrame(gutterBootstrapFrameRef.current);
		gutterBootstrapFrameRef.current = scheduleGutterPostPaintWork(() => {
			gutterBootstrapFrameRef.current = null;
			if (!isMountedRef.current) {
				return;
			}
			runViewportGutterInitialLayout();
		});

		cancelGutterLayoutFrame(gutterBackgroundFullFrameRef.current);
		gutterBackgroundFullFrameRef.current = scheduleGutterBackgroundFullLayout(
			() => {
				gutterBackgroundFullFrameRef.current = null;
				if (!isMountedRef.current) {
					return;
				}
				if (
					hadPendingFull ||
					consumePendingFullLayout(gutterTransitionRef.current)
				) {
					scheduleUpdateVisualLines();
					return;
				}
				if (gutterTransitionRef.current.phase === 'viewport') {
					scheduleUpdateVisualLines();
				}
			}
		);
	}, [
		editor,
		editorHostRef,
		runViewportGutterInitialLayout,
		scheduleUpdateVisualLines,
	]);

	useLayoutEffect(() => {
		if (!editor) {
			return;
		}
		gutterTransitionRef.current = createGutterTransitionState();
		previousVisualLinesRef.current = [];
		bootstrapGutterLayout();
	}, [editor, bootstrapGutterLayout]);

	useEffect(() => {
		if (!editor) return;

		editor.on('update', scheduleUpdateVisualLines);

		const handleBlur = (): void => {
			onDocumentFlushRef.current?.({ editor });
			flushUpdateVisualLines();
		};
		editor.on('blur', handleBlur);

		const root = resolveGutterContentRoot(editorHostRef.current);
		const resizeObserver =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(() => {
						if (deferScrollResizePromotion(gutterTransitionRef.current)) {
							return;
						}
						scheduleUpdateVisualLines();
					})
				: null;

		if (root && resizeObserver) {
			resizeObserver.observe(root);
		}

		const scrollContainer = resolveGutterScrollContainer(root);

		const handleGutterScrollPromote = (): void => {
			if (deferScrollResizePromotion(gutterTransitionRef.current)) {
				return;
			}
			if (gutterTransitionRef.current.phase !== 'full') {
				scheduleUpdateVisualLines();
			}
		};

		scrollContainer?.addEventListener('scroll', handleGutterScrollPromote, {
			passive: true,
		});

		const handleResize = (): void => {
			if (deferScrollResizePromotion(gutterTransitionRef.current)) {
				return;
			}
			scheduleUpdateVisualLines();
		};

		window.addEventListener('resize', handleResize);

		return () => {
			editor.off('update', scheduleUpdateVisualLines);
			editor.off('blur', handleBlur);
			window.removeEventListener('resize', handleResize);
			scrollContainer?.removeEventListener('scroll', handleGutterScrollPromote);
			resizeObserver?.disconnect();
			cancelGutterLayoutFrame(gutterBootstrapFrameRef.current);
			gutterBootstrapFrameRef.current = null;
			cancelGutterLayoutFrame(gutterBackgroundFullFrameRef.current);
			gutterBackgroundFullFrameRef.current = null;
			if (visualLinesRafRef.current !== null) {
				window.cancelAnimationFrame(visualLinesRafRef.current);
				visualLinesRafRef.current = null;
			}
			if (gutterLayoutTimerRef.current !== null) {
				window.clearTimeout(gutterLayoutTimerRef.current);
				gutterLayoutTimerRef.current = null;
			}
		};
	}, [
		editor,
		editorHostRef,
		flushUpdateVisualLines,
		onDocumentFlushRef,
		scheduleUpdateVisualLines,
	]);

	return {
		visualLines,
		gutterHeight,
		gutterTrackTransitionEnabled,
	};
}
