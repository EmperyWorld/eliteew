/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mount branded EliteEW React overlays after imperative React root detach (stale bundle, chunk failures).
 *
 * Invariants:
 * - Caller must call `detachAppReactRoot()` before mounting a full-screen fallback.
 *
 * Related:
 * - `utils/staleBundleReload.ts`
 * - `utils/reactAppLifecycle.ts`
 */

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
	EliteTechnicalState,
	type EliteTechnicalStateProps,
} from '@/components/ui/EliteTechnicalState';
import {
	EliteRecoveryScreen,
	type EliteRecoveryScreenProps,
} from '@/components/ui/EliteRecoveryScreen';

const overlayRoots = new Map<string, Root>();

export function mountEliteTechnicalOverlay(
	containerId: string,
	props: EliteTechnicalStateProps
): HTMLElement {
	const existing = document.getElementById(containerId);
	if (existing) {
		return existing;
	}

	const container = document.createElement('div');
	container.id = containerId;
	document.body.appendChild(container);

	const root = createRoot(container);
	overlayRoots.set(containerId, root);
	root.render(createElement(EliteTechnicalState, props));
	return container;
}

export function mountEliteRecoveryOverlay(
	containerId: string,
	props: EliteRecoveryScreenProps
): HTMLElement {
	const existing = document.getElementById(containerId);
	if (existing) {
		return existing;
	}

	const container = document.createElement('div');
	container.id = containerId;
	document.body.appendChild(container);

	const root = createRoot(container);
	overlayRoots.set(containerId, root);
	root.render(createElement(EliteRecoveryScreen, props));
	return container;
}

export function unmountEliteTechnicalOverlay(containerId: string): void {
	const root = overlayRoots.get(containerId);
	if (root) {
		root.unmount();
		overlayRoots.delete(containerId);
	}
	document.getElementById(containerId)?.remove();
}
