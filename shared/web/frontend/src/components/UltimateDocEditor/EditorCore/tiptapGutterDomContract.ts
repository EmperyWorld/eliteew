/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * DOM contract for gutter layout — content root and scroll container resolution.
 *
 * Invariants:
 * - Prefer ProseMirror/contenteditable semantics over TipTap-specific class chains.
 * - Skeleton/estimate modules consume HTMLElement roots only; no querySelector here.
 *
 * Related:
 * - TiptapEditor.tsx
 * - tiptapGutterStableEstimate.ts
 */

/** ProseMirror root: contenteditable surface (stable across TipTap minor versions). */
export const GUTTER_CONTENT_ROOT_SELECTOR =
	'[contenteditable="true"].ProseMirror, .ProseMirror[contenteditable="true"], .ProseMirror, [role="textbox"][contenteditable="true"]';

/** Doc editor scroll band — product shell marker, not TipTap internal. */
export const GUTTER_SCROLL_CONTAINER_SELECTOR = '[data-doc-editor-scroll]';

/** Explicit operator override when ProseMirror class naming drifts. */
export const GUTTER_CONTENT_ROOT_OVERRIDE_SELECTOR =
	'[data-gutter-content-root]';

export type GutterContentRootResolution =
	| 'operator-override'
	| 'selector-primary'
	| 'selector-fallback'
	| 'tree-walk'
	| 'missing';

const CONTENT_ROOT_CANDIDATE_SELECTORS = [
	'.ProseMirror[contenteditable="true"]',
	'[contenteditable="true"].ProseMirror',
	'.ProseMirror',
	'[role="textbox"][contenteditable="true"]',
	'[contenteditable="true"]',
] as const;

function firstHTMLElement(
	root: ParentNode,
	selectors: readonly string[]
): HTMLElement | null {
	for (const selector of selectors) {
		const match = root.querySelector(selector);
		if (match instanceof HTMLElement) {
			return match;
		}
	}
	return null;
}

function walkForContentEditableRoot(host: HTMLElement): HTMLElement | null {
	const walker = document.createTreeWalker(host, NodeFilter.SHOW_ELEMENT);
	let node = walker.nextNode();
	while (node) {
		if (node instanceof HTMLElement) {
			if (node.isContentEditable) {
				return node;
			}
			const editable = node.getAttribute('contenteditable');
			if (
				editable === 'true' ||
				editable === 'plaintext-only' ||
				editable === ''
			) {
				return node;
			}
		}
		node = walker.nextNode();
	}
	return null;
}

export function resolveGutterContentRootDetailed(
	host: HTMLElement | null | undefined
): { root: HTMLElement | null; resolution: GutterContentRootResolution } {
	if (!host) {
		return { root: null, resolution: 'missing' };
	}

	const override = host.querySelector(GUTTER_CONTENT_ROOT_OVERRIDE_SELECTOR);
	if (override instanceof HTMLElement) {
		return { root: override, resolution: 'operator-override' };
	}

	const primary = host.querySelector(GUTTER_CONTENT_ROOT_SELECTOR);
	if (primary instanceof HTMLElement) {
		return { root: primary, resolution: 'selector-primary' };
	}

	const fallback = firstHTMLElement(host, CONTENT_ROOT_CANDIDATE_SELECTORS);
	if (fallback) {
		return { root: fallback, resolution: 'selector-fallback' };
	}

	const walked = walkForContentEditableRoot(host);
	if (walked) {
		return { root: walked, resolution: 'tree-walk' };
	}

	return { root: null, resolution: 'missing' };
}

export function resolveGutterContentRoot(
	host: HTMLElement | null | undefined
): HTMLElement | null {
	return resolveGutterContentRootDetailed(host).root;
}

export function resolveGutterScrollContainer(
	contentRoot: HTMLElement | null | undefined
): HTMLElement | null {
	if (!contentRoot) {
		return null;
	}
	const marked = contentRoot.closest(GUTTER_SCROLL_CONTAINER_SELECTOR);
	if (marked instanceof HTMLElement) {
		return marked;
	}
	return contentRoot.parentElement;
}

/** Files that must stay free of TipTap-internal descendant selectors. */
export const GUTTER_DOM_ABSTRACT_MODULES = [
	'tiptapGutterStableEstimate.ts',
	'tiptapGutterViewportScope.ts',
	'tiptapGutterTransition.ts',
	'tiptapGutterLayoutScheduling.ts',
] as const;

const FRAGILE_SELECTOR_PATTERNS = [
	/\.tiptap\b/,
	/querySelector\s*\(\s*['"][^'"]*tiptap[^'"]*['"]\s*\)/,
	/\.node-/,
	/\.ProseMirror-\w+/,
];

export function assertGutterModuleUsesAbstractDomContract(
	moduleSource: string,
	moduleName: string
): void {
	if (!GUTTER_DOM_ABSTRACT_MODULES.includes(moduleName as never)) {
		return;
	}
	for (const pattern of FRAGILE_SELECTOR_PATTERNS) {
		if (pattern.test(moduleSource)) {
			throw new Error(
				`${moduleName} uses fragile selector matching ${String(pattern)}`
			);
		}
	}
}
