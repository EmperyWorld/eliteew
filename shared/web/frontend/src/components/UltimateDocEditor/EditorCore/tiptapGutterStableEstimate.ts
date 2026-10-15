/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cheap gutter skeleton rows from block geometry — stable before detailed wrap measurement.
 *
 * Invariants:
 * - Uses block-level getBoundingClientRect only (no getClientRects text-line scan).
 *
 * Related:
 * - TiptapEditor.tsx
 * - tiptapGutterViewportScope.ts
 */

import {
	isBlockInGutterViewport,
	resolveProseMirrorViewportRect,
} from './tiptapGutterViewportScope';

export interface GutterSkeletonLine {
	lineNumber: number;
	top: number;
	height: number;
	isWrapContinuation: false;
}

export function buildViewportGutterSkeletonLines(
	proseMirrorRoot: HTMLElement,
	fallbackLineHeight: number
): GutterSkeletonLine[] {
	const rootRect = proseMirrorRoot.getBoundingClientRect();
	const viewportRect = resolveProseMirrorViewportRect(proseMirrorRoot);
	const lines: GutterSkeletonLine[] = [];
	let nextLineNumber = 1;

	const pushSkeleton = (element: HTMLElement): void => {
		const blockRect = element.getBoundingClientRect();
		lines.push({
			lineNumber: nextLineNumber,
			top: Math.max(0, blockRect.top - rootRect.top),
			height: Math.max(blockRect.height, fallbackLineHeight * 0.85, 12),
			isWrapContinuation: false,
		});
		nextLineNumber += 1;
	};

	const processBlock = (element: HTMLElement): void => {
		if (!isBlockInGutterViewport(element, viewportRect)) {
			nextLineNumber += 1;
			return;
		}
		const tag = element.tagName;
		if ((tag === 'UL' || tag === 'OL') && element.children.length > 0) {
			Array.from(element.children).forEach((child) => {
				if (child instanceof HTMLElement && child.tagName === 'LI') {
					if (!isBlockInGutterViewport(child, viewportRect)) {
						nextLineNumber += 1;
						return;
					}
					pushSkeleton(child);
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
		pushSkeleton(element);
	};

	const blocks = Array.from(proseMirrorRoot.children).filter(
		(child): child is HTMLElement => child instanceof HTMLElement
	);

	if (blocks.length === 0) {
		return [
			{
				lineNumber: 1,
				top: 24,
				height: fallbackLineHeight,
				isWrapContinuation: false,
			},
		];
	}

	blocks.forEach(processBlock);

	if (lines.length === 0) {
		return [
			{
				lineNumber: 1,
				top: 24,
				height: fallbackLineHeight,
				isWrapContinuation: false,
			},
		];
	}

	return lines;
}
