/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Process-wide coordinator for TooltipV2: single visible tooltip, global dismiss,
 * and pointer-integrity checks when `pointerleave` is lost (Quest, Linux/XFCE Chromium).
 *
 * Invariants:
 * - At most one tracked visible tooltip; showing a new one force-hides the previous.
 * - Global listeners attach lazily and detach when no tooltips are registered.
 * - Pointer integrity uses trigger `contains(elementFromPoint)` — tooltips are pointer-events-none.
 *
 * Related:
 * - TooltipV2.tsx
 * - pages/Desktop/utils/desktopLaserPointerEnvironment.ts
 */

import { DESKTOP_HOVER_CHROME_DISMISS_EVENT } from '@/pages/Desktop/utils/desktopHoverChromeDismissEvent';

export type TooltipCoordinatorHandle = {
	id: string;
	getTrigger: () => HTMLElement | null;
	forceHide: () => void;
};

type VisibleTooltip = {
	trigger: HTMLElement;
	forceHide: () => void;
};

const registered = new Map<string, TooltipCoordinatorHandle>();
const visible = new Map<string, VisibleTooltip>();

let globalListenersAttached = false;
let pendingPointerEvent: PointerEvent | null = null;
let pointerIntegrityRaf = 0;

function runPointerIntegrityCheck(event: PointerEvent): void {
	if (visible.size === 0) {
		return;
	}
	const hit = document.elementFromPoint(event.clientX, event.clientY);
	for (const [id, entry] of [...visible.entries()]) {
		if (hit && entry.trigger.contains(hit)) {
			continue;
		}
		entry.forceHide();
		visible.delete(id);
	}
}

function schedulePointerIntegrityCheck(event: PointerEvent): void {
	pendingPointerEvent = event;
	if (pointerIntegrityRaf !== 0) {
		return;
	}
	pointerIntegrityRaf = window.requestAnimationFrame(() => {
		pointerIntegrityRaf = 0;
		const evt = pendingPointerEvent;
		pendingPointerEvent = null;
		if (evt) {
			runPointerIntegrityCheck(evt);
		}
	});
}

function dismissAllVisibleTooltips(): void {
	for (const entry of visible.values()) {
		entry.forceHide();
	}
	visible.clear();
}

function onGlobalDismissEvent(): void {
	dismissAllVisibleTooltips();
}

function onGlobalPointerMove(event: PointerEvent): void {
	schedulePointerIntegrityCheck(event);
}

function onGlobalLifecycleDismiss(): void {
	dismissAllVisibleTooltips();
}

function attachGlobalListeners(): void {
	if (globalListenersAttached || typeof window === 'undefined') {
		return;
	}
	globalListenersAttached = true;
	window.addEventListener(
		DESKTOP_HOVER_CHROME_DISMISS_EVENT,
		onGlobalDismissEvent
	);
	window.addEventListener('pointermove', onGlobalPointerMove, {
		passive: true,
	});
	window.addEventListener('blur', onGlobalLifecycleDismiss);
	window.addEventListener('scroll', onGlobalLifecycleDismiss, true);
	document.addEventListener('visibilitychange', onGlobalLifecycleDismiss);
}

function detachGlobalListeners(): void {
	if (!globalListenersAttached || typeof window === 'undefined') {
		return;
	}
	if (registered.size > 0) {
		return;
	}
	globalListenersAttached = false;
	window.removeEventListener(
		DESKTOP_HOVER_CHROME_DISMISS_EVENT,
		onGlobalDismissEvent
	);
	window.removeEventListener('pointermove', onGlobalPointerMove);
	window.removeEventListener('blur', onGlobalLifecycleDismiss);
	window.removeEventListener('scroll', onGlobalLifecycleDismiss, true);
	document.removeEventListener('visibilitychange', onGlobalLifecycleDismiss);
	if (pointerIntegrityRaf !== 0) {
		window.cancelAnimationFrame(pointerIntegrityRaf);
		pointerIntegrityRaf = 0;
	}
	pendingPointerEvent = null;
}

/** Register a tooltip instance for coordinator lifecycle (call from TooltipV2 mount). */
export function registerTooltipCoordinatorHandle(
	handle: TooltipCoordinatorHandle
): () => void {
	registered.set(handle.id, handle);
	attachGlobalListeners();
	return () => {
		registered.delete(handle.id);
		visible.delete(handle.id);
		detachGlobalListeners();
	};
}

/** Notify coordinator that a tooltip became visible. */
export function notifyTooltipCoordinatorShown(
	id: string,
	trigger: HTMLElement,
	forceHide: () => void
): void {
	for (const [otherId, entry] of visible.entries()) {
		if (otherId === id) {
			continue;
		}
		entry.forceHide();
		visible.delete(otherId);
	}
	visible.set(id, { trigger, forceHide });
}

/** Notify coordinator that a tooltip hid. */
export function notifyTooltipCoordinatorHidden(id: string): void {
	visible.delete(id);
}

/** Force-hide every visible tooltip (also used by desktop hover safety net). */
export function dismissAllCoordinatorTooltips(): void {
	dismissAllVisibleTooltips();
}
