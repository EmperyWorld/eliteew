/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared accessibility helpers: focusable queries, modal focus trap, focus-restore stack,
 * keyboard key constants, and screen-reader announcements.
 *
 * Invariants:
 * - Focusable queries skip disabled nodes and descendants of `aria-hidden="true"`.
 * - `saveFocus` / `restoreFocus` use a LIFO stack so nested overlays restore in order.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopModalFocusTrap.ts
 * - src/features/ewa/companionUx/useEwaDialogFocusTrap.ts
 * - documentation/product/desktop/DESKTOP-SHELL-A11Y-CHECKLIST.md
 */

import type { ReactNode } from 'react';

/** Canonical focusable selector for shell modals, EWA dialogs, and shared traps. */
export const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusRestoreStack: HTMLElement[] = [];

/**
 * Generate unique ID for accessibility
 */
export function generateA11yId(prefix = 'a11y'): string {
	return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create live region for screen reader announcements
 */
export function announceToScreenReader(
	message: string,
	politeness: 'polite' | 'assertive' = 'polite'
): void {
	if (typeof document === 'undefined') {
		return;
	}

	const announcement = document.createElement('div');
	announcement.setAttribute('role', 'status');
	announcement.setAttribute('aria-live', politeness);
	announcement.setAttribute('aria-atomic', 'true');
	announcement.className = 'sr-only';
	announcement.textContent = message;

	document.body.appendChild(announcement);

	setTimeout(() => {
		document.body.removeChild(announcement);
	}, 1000);
}

/**
 * Check if element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
	if (element.tabIndex < 0) {
		return false;
	}
	if (element.hasAttribute('disabled')) {
		return false;
	}

	const tagName = element.tagName.toLowerCase();
	const focusableTags = ['a', 'button', 'input', 'select', 'textarea'];

	return focusableTags.includes(tagName) || element.tabIndex >= 0;
}

/** True when the node may receive keyboard focus inside an active trap. */
export function isElementFocusTrapVisible(element: HTMLElement): boolean {
	if (element.hasAttribute('disabled')) {
		return false;
	}
	if (element.getAttribute('aria-hidden') === 'true') {
		return false;
	}
	if (element.closest('[aria-hidden="true"]')) {
		return false;
	}
	return true;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
	).filter(isElementFocusTrapVisible);
}

/**
 * Tab / Shift+Tab cycle inside `root`. Returns true when the event was handled.
 */
export function cycleTabFocusWithinContainer(
	root: HTMLElement,
	event: KeyboardEvent
): boolean {
	if (event.key !== 'Tab') {
		return false;
	}
	const nodes = getFocusableElements(root);
	if (nodes.length === 0) {
		return false;
	}
	const first = nodes[0];
	const last = nodes[nodes.length - 1];
	const activeEl = document.activeElement as Node | null;
	if (event.shiftKey) {
		if (activeEl === first || !root.contains(activeEl)) {
			event.preventDefault();
			last.focus();
			return true;
		}
		return false;
	}
	if (activeEl === last || !root.contains(activeEl)) {
		event.preventDefault();
		first.focus();
		return true;
	}
	return false;
}

/**
 * Trap focus within a container (for modals, dialogs)
 */
export function trapFocus(container: HTMLElement): () => void {
	const handleKeyDown = (event: KeyboardEvent) => {
		cycleTabFocusWithinContainer(container, event);
	};

	container.addEventListener('keydown', handleKeyDown);

	return () => {
		container.removeEventListener('keydown', handleKeyDown);
	};
}

/**
 * Focus first element in container
 */
export function focusFirstElement(container: HTMLElement): void {
	const focusableElements = getFocusableElements(container);
	focusableElements[0]?.focus({ preventScroll: true });
}

/** Push the currently focused element onto the restore stack. */
export function saveFocus(): void {
	const el = document.activeElement;
	if (el instanceof HTMLElement) {
		focusRestoreStack.push(el);
	}
}

/** Pop and focus the most recently saved element. */
export function restoreFocus(): void {
	const el = focusRestoreStack.pop();
	el?.focus({ preventScroll: true });
}

/** Test helper — reset stacked restore targets between cases. */
export function clearFocusRestoreStack(): void {
	focusRestoreStack.length = 0;
}

/**
 * Generate ARIA label from children text content
 */
export function getAriaLabelFromChildren(children: ReactNode): string {
	if (typeof children === 'string') {
		return children;
	}
	if (typeof children === 'number') {
		return children.toString();
	}
	return '';
}

/**
 * Keyboard event helpers
 */
export const Keys = {
	Enter: 'Enter',
	Space: ' ',
	Escape: 'Escape',
	Tab: 'Tab',
	ArrowUp: 'ArrowUp',
	ArrowDown: 'ArrowDown',
	ArrowLeft: 'ArrowLeft',
	ArrowRight: 'ArrowRight',
	Home: 'Home',
	End: 'End',
} as const;

export function isEnterOrSpace(event: React.KeyboardEvent): boolean {
	return event.key === Keys.Enter || event.key === Keys.Space;
}

export function isEscape(event: React.KeyboardEvent): boolean {
	return event.key === Keys.Escape;
}

export function isArrowKey(event: React.KeyboardEvent): boolean {
	const k = event.key;
	return (
		k === Keys.ArrowUp ||
		k === Keys.ArrowDown ||
		k === Keys.ArrowLeft ||
		k === Keys.ArrowRight
	);
}

/**
 * ARIA attribute generators
 */
export interface AriaButtonProps {
	role?: string;
	'aria-label'?: string;
	'aria-pressed'?: boolean;
	'aria-expanded'?: boolean;
	'aria-haspopup'?: boolean | 'menu' | 'dialog' | 'listbox' | 'tree' | 'grid';
	'aria-controls'?: string;
	'aria-describedby'?: string;
}

export function getAriaButtonProps(
	label?: string,
	pressed?: boolean,
	expanded?: boolean
): AriaButtonProps {
	const props: AriaButtonProps = {};

	if (label) {
		props['aria-label'] = label;
	}
	if (pressed !== undefined) {
		props['aria-pressed'] = pressed;
	}
	if (expanded !== undefined) {
		props['aria-expanded'] = expanded;
	}

	return props;
}

/**
 * Screen reader only styles (Tailwind compatible)
 */
export const srOnlyStyles = {
	position: 'absolute' as const,
	width: '1px',
	height: '1px',
	padding: '0',
	margin: '-1px',
	overflow: 'hidden',
	clip: 'rect(0, 0, 0, 0)',
	whiteSpace: 'nowrap' as const,
	borderWidth: '0',
};

export const a11y = {
	generateId: generateA11yId,
	announce: announceToScreenReader,
	isFocusable,
	isElementFocusTrapVisible,
	getFocusableElements,
	cycleTabFocusWithinContainer,
	trapFocus,
	focusFirst: focusFirstElement,
	saveFocus,
	restoreFocus,
	clearFocusRestoreStack,
	getAriaLabel: getAriaLabelFromChildren,
	Keys,
	isEnterOrSpace,
	isEscape,
	isArrowKey,
	getButtonProps: getAriaButtonProps,
	srOnlyStyles,
	FOCUSABLE_SELECTOR,
};

export default a11y;
