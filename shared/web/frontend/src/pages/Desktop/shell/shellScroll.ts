/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve EnhancedWindow body overflow / data-desktop-scroll from Shell App Registry.
 *
 * Invariants:
 * - self → overflow-hidden, no data-desktop-scroll
 * - outer | outer_preview → overflow-auto + data-desktop-scroll
 *
 * Related:
 * - shell/appRegistry.ts
 * - components/EnhancedWindow.tsx
 */

import './appRegistry.catalog';
import {
	resolveWindowBodyScroll,
	type ResolvedWindowBodyScroll,
} from './appRegistry';

export type WindowBodyScrollDomFlags = {
	mode: ResolvedWindowBodyScroll['mode'];
	scrollContainerId?: string;
	/** Tailwind overflow class for the window `<section>`. */
	overflowClassName: 'overflow-hidden' | 'overflow-auto';
	/** When set, shell marks the section as the legacy desktop scroll host. */
	dataDesktopScroll: 'true' | undefined;
};

export function resolveWindowBodyScrollDomFlags(
	windowType: string,
	appComponent?: string | null
): WindowBodyScrollDomFlags {
	const resolved = resolveWindowBodyScroll(windowType, appComponent);
	const self = resolved.mode === 'self';
	return {
		mode: resolved.mode,
		scrollContainerId: resolved.scrollContainerId,
		overflowClassName: self ? 'overflow-hidden' : 'overflow-auto',
		dataDesktopScroll: self ? undefined : 'true',
	};
}

export { resolveWindowBodyScroll, isShellAppSelfScroll } from './appRegistry';
