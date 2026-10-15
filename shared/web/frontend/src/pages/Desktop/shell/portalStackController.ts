/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell portal stack controller — open/close queue, z-index by layer kind + order,
 * Escape closes top dismissible surface (U1.d / U1.e).
 *
 * Invariants:
 * - zIndex is computed only here (window base + layer bump + open sequence).
 * - Escape targets getTopShellPortalSurface() when dismissOnEscape is true.
 * - Stack is in-memory; reload clears (OK per U1 Failure matrix).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md §5
 * - shell/shellPortal.tsx
 */

import { DESKTOP_Z_INDEX } from '../constants';
import type { ShellPortalLayerKind } from './appRegistry';
import { resolveShellPortalLayerBump } from './portalLayerBumps';

export type ShellPortalSurface = {
	id: string;
	appComponent: string | 'shell';
	windowId: string | null;
	layer: ShellPortalLayerKind;
	zIndex: number;
	dismissOnEscape: boolean;
	/** Invoked when Shell Escape dismisses this top surface. */
	onRequestClose?: () => void;
};

export type OpenShellPortalSurfaceInput = {
	layer: ShellPortalLayerKind;
	appComponent?: string | 'shell';
	windowId?: string | null;
	/** From DesktopWindowPortalStackContext; defaults to CONTEXT_MENU. */
	windowPortalBase?: number;
	dismissOnEscape?: boolean;
	onRequestClose?: () => void;
};

type StackListener = () => void;

let stack: ShellPortalSurface[] = [];
let openSeq = 0;
let idSeq = 0;
const listeners = new Set<StackListener>();
let escapeListenerAttached = false;

function notify(): void {
	for (const listener of listeners) {
		listener();
	}
}

function ensureEscapeListener(): void {
	if (escapeListenerAttached || typeof document === 'undefined') return;
	escapeListenerAttached = true;
	document.addEventListener('keydown', onDocumentEscape, true);
}

function tearDownEscapeListenerIfIdle(): void {
	if (stack.length > 0 || !escapeListenerAttached) return;
	if (typeof document === 'undefined') return;
	document.removeEventListener('keydown', onDocumentEscape, true);
	escapeListenerAttached = false;
}

function onDocumentEscape(event: KeyboardEvent): void {
	if (event.key !== 'Escape' && event.code !== 'Escape') return;
	const top = getTopShellPortalSurface();
	if (!top?.dismissOnEscape) return;
	event.preventDefault();
	event.stopPropagation();
	top.onRequestClose?.();
}

export function computeShellPortalZIndex(
	windowPortalBase: number,
	layer: ShellPortalLayerKind,
	orderIndex: number
): number {
	return (
		windowPortalBase +
		resolveShellPortalLayerBump(layer) +
		Math.max(0, orderIndex)
	);
}

export function openShellPortalSurface(
	input: OpenShellPortalSurfaceInput
): string {
	const id = `shell-portal-${++idSeq}`;
	const orderIndex = openSeq++;
	const windowPortalBase =
		input.windowPortalBase ?? DESKTOP_Z_INDEX.CONTEXT_MENU;
	const surface: ShellPortalSurface = {
		id,
		appComponent: input.appComponent?.trim() || 'shell',
		windowId: input.windowId ?? null,
		layer: input.layer,
		zIndex: computeShellPortalZIndex(windowPortalBase, input.layer, orderIndex),
		dismissOnEscape: input.dismissOnEscape ?? true,
		onRequestClose: input.onRequestClose,
	};

	if (
		input.layer === 'embedded_modal_backdrop' &&
		surface.windowId &&
		stack.some(
			(s) =>
				s.layer === 'embedded_modal_backdrop' && s.windowId === surface.windowId
		)
	) {
		console.warn(
			`[STEP] shell_portal_duplicate_backdrop windowId=${surface.windowId}`
		);
	}

	stack = [...stack, surface];
	ensureEscapeListener();
	notify();
	return id;
}

export function closeShellPortalSurface(id: string): void {
	const next = stack.filter((s) => s.id !== id);
	if (next.length === stack.length) return;
	stack = next;
	tearDownEscapeListenerIfIdle();
	notify();
}

export function getShellPortalSurface(id: string): ShellPortalSurface | null {
	return stack.find((s) => s.id === id) ?? null;
}

export function getTopShellPortalSurface(): ShellPortalSurface | null {
	if (stack.length === 0) return null;
	return stack[stack.length - 1] ?? null;
}

export function listShellPortalSurfaces(): readonly ShellPortalSurface[] {
	return stack;
}

export function isTopShellPortalSurface(id: string): boolean {
	return getTopShellPortalSurface()?.id === id;
}

export function subscribeShellPortalStack(listener: StackListener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Close top dismissible surface (same path as Escape). Returns true if dismissed. */
export function dismissTopShellPortalSurface(): boolean {
	const top = getTopShellPortalSurface();
	if (!top?.dismissOnEscape) return false;
	top.onRequestClose?.();
	return true;
}

/** Test helper — clear stack and Escape listener. */
export function __resetShellPortalStackForTests(): void {
	stack = [];
	openSeq = 0;
	idSeq = 0;
	if (escapeListenerAttached && typeof document !== 'undefined') {
		document.removeEventListener('keydown', onDocumentEscape, true);
	}
	escapeListenerAttached = false;
	notify();
}
