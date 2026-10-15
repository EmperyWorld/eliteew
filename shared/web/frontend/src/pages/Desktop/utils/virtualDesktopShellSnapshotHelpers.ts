/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Helpers to align virtual-desktop membership with `windows_snapshot` on shell hydrate.
 *
 * Invariants:
 * - Snapshot ids win when present; legacy snapshots without ids use membership heuristics only.
 *
 * Related:
 * - hooks/useVirtualDesktops.ts
 * - utils/reconcileVirtualDesktopWindowMembership.ts
 */

import type { VirtualDesktopWindowHost } from './reconcileVirtualDesktopWindowMembership';

/** Collect persisted window ids from shell `windows_snapshot` when present. */
export function liveWindowIdsFromWindowsSnapshot(ws: unknown): string[] | null {
	if (!ws || typeof ws !== 'object' || Array.isArray(ws)) {
		return null;
	}
	const windows = (ws as { windows?: unknown }).windows;
	if (!Array.isArray(windows)) {
		return null;
	}
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const entry of windows) {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			continue;
		}
		const id = (entry as { id?: unknown }).id;
		if (typeof id !== 'string') {
			continue;
		}
		const trimmed = id.trim();
		if (!trimmed || seen.has(trimmed)) {
			continue;
		}
		seen.add(trimmed);
		ids.push(trimmed);
	}
	return ids;
}

export function countWindowsInShellSnapshot(ws: unknown): number {
	if (!ws || typeof ws !== 'object' || Array.isArray(ws)) {
		return 0;
	}
	const windows = (ws as { windows?: unknown }).windows;
	return Array.isArray(windows) ? windows.length : 0;
}

export function totalVirtualDesktopMembershipIds(
	desktops: readonly VirtualDesktopWindowHost[]
): number {
	const seen = new Set<string>();
	for (const desktop of desktops) {
		for (const windowId of desktop.windows) {
			if (typeof windowId === 'string' && windowId.length > 0) {
				seen.add(windowId);
			}
		}
	}
	return seen.size;
}

/** Legacy snapshots without ids: suspect orphan drift when membership far exceeds snapshot size. */
export function shouldDeferLegacyVirtualDesktopMembership(
	desktops: readonly VirtualDesktopWindowHost[],
	windowsSnapshot: unknown
): boolean {
	const snapshotCount = countWindowsInShellSnapshot(windowsSnapshot);
	const membershipCount = totalVirtualDesktopMembershipIds(desktops);
	if (membershipCount === 0) {
		return false;
	}
	if (snapshotCount === 0) {
		return membershipCount > 32;
	}
	return membershipCount > Math.max(snapshotCount, 1) * 2;
}
