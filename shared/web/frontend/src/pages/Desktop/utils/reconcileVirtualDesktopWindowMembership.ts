/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Keep virtual-desktop window membership equal to the live window id set so
 * `shell_state.virtual_desktops.desktops[].windows` does not accumulate orphans
 * across session restore (which mints new window ids).
 *
 * Invariants:
 * - Each live id appears on at most one desktop.
 * - Ids not in the live set are dropped.
 * - Missing live ids land on `assignments[id]` when that desktop exists, else
 *   current membership, else the active desktop.
 * - Unchanged membership returns the same `desktops` reference.
 *
 * Related:
 * - hooks/useVirtualDesktops.ts
 * - hooks/useWindowManager.ts
 * - hooks/useDesktopShellWindowPersistence.ts
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
 */

export type VirtualDesktopWindowHost = {
	id: string;
	windows: string[];
};

export type ReconcileVirtualDesktopWindowMembershipInput<
	T extends VirtualDesktopWindowHost,
> = {
	desktops: T[];
	liveWindowIds: readonly string[];
	assignments?: Readonly<Record<string, string>>;
	activeDesktopId: string;
};

export type ReconcileDesktopWindowMembership = (
	liveWindowIds: readonly string[],
	assignments?: Readonly<Record<string, string>>
) => void;

function uniqueLiveWindowIds(liveWindowIds: readonly string[]): string[] {
	const live: string[] = [];
	const seen = new Set<string>();
	for (const id of liveWindowIds) {
		if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue;
		seen.add(id);
		live.push(id);
	}
	return live;
}

function sameWindowList(left: string[], right: string[]): boolean {
	if (left.length !== right.length) return false;
	return left.every((id, index) => id === right[index]);
}

export function reconcileVirtualDesktopWindowMembership<
	T extends VirtualDesktopWindowHost,
>(input: ReconcileVirtualDesktopWindowMembershipInput<T>): T[] {
	const { desktops, assignments, activeDesktopId } = input;
	if (desktops.length === 0) {
		return desktops;
	}

	const live = uniqueLiveWindowIds(input.liveWindowIds);
	const desktopIds = new Set(desktops.map((desktop) => desktop.id));
	const fallbackDesktopId = desktopIds.has(activeDesktopId)
		? activeDesktopId
		: desktops[0]?.id;

	const currentOwner = new Map<string, string>();
	for (const desktop of desktops) {
		for (const windowId of desktop.windows) {
			if (!currentOwner.has(windowId)) {
				currentOwner.set(windowId, desktop.id);
			}
		}
	}

	const targetOwner = new Map<string, string>();
	for (const windowId of live) {
		const assigned = assignments?.[windowId];
		if (assigned && desktopIds.has(assigned)) {
			targetOwner.set(windowId, assigned);
			continue;
		}
		const existing = currentOwner.get(windowId);
		if (existing && desktopIds.has(existing)) {
			targetOwner.set(windowId, existing);
			continue;
		}
		if (fallbackDesktopId) {
			targetOwner.set(windowId, fallbackDesktopId);
		}
	}

	let changed = false;
	const next = desktops.map((desktop) => {
		const windows = live.filter(
			(windowId) => targetOwner.get(windowId) === desktop.id
		);
		if (sameWindowList(desktop.windows, windows)) {
			return desktop;
		}
		changed = true;
		return { ...desktop, windows };
	});
	return changed ? next : desktops;
}
