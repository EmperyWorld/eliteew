/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React SSOT hook for companion surface lifecycle / view prefs via Shell Lifecycle
 * Manager subscribe + load/save — no component-local lifecycle mirrors.
 *
 * Invariants:
 * - Dismiss/pin/collapse never cancel server task runs.
 * - Persist immediately on dispatch (save notifies subscribers).
 * - Empty → real principal merges in-memory prefs (never wipe).
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md Part B
 * - src/pages/Desktop/shell/shellLifecycleManager.ts
 * - src/features/ewa/companionOutputSurface/companionSurfaceLifecycle.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
	companionSurfaceLifecycleReducer,
	getCompanionViewPrefs,
	loadCompanionSurfaceLifecycleState,
	mergeCompanionSurfaceLifecycleStates,
	saveCompanionSurfaceLifecycleState,
	type CompanionSurfaceLifecycleState,
	type CompanionViewPrefs,
} from '@/features/ewa/companionOutputSurface/companionSurfaceLifecycle';
import { subscribeShellLifecycle } from '@/pages/Desktop/shell/shellLifecycleManager';

export type CompanionSurfaceLifecycleAction = Parameters<
	typeof companionSurfaceLifecycleReducer
>[1];

export type UseCompanionViewPrefsResult = {
	lifecycle: CompanionSurfaceLifecycleState;
	viewPrefs: CompanionViewPrefs;
	dispatchLifecycle: (action: CompanionSurfaceLifecycleAction) => void;
};

function hasInMemoryPrefs(state: CompanionSurfaceLifecycleState): boolean {
	return (
		state.dismissedIds.length > 0 ||
		state.pinnedIds.length > 0 ||
		state.restoredIds.length > 0 ||
		state.collapsedMissionIds.length > 0 ||
		state.expandedMissionIds.length > 0 ||
		state.historyExpanded
	);
}

/**
 * Subscribe to SLM companion view prefs for `principalId`.
 * Writes go through reducer + save (notify); reads reload from storage on notify.
 */
export function useCompanionViewPrefs(
	principalId: string
): UseCompanionViewPrefsResult {
	const principalIdRef = useRef(principalId);
	const prevPrincipalRef = useRef(principalId.trim());
	const [lifecycle, setLifecycle] = useState(() =>
		loadCompanionSurfaceLifecycleState(principalId)
	);

	useEffect(() => {
		const prevPid = prevPrincipalRef.current;
		const nextPid = principalId.trim();
		principalIdRef.current = principalId;
		prevPrincipalRef.current = nextPid;

		const loaded = loadCompanionSurfaceLifecycleState(nextPid);
		setLifecycle((prev) => {
			if (!nextPid) return prev;
			if (!prevPid && hasInMemoryPrefs(prev)) {
				const merged = mergeCompanionSurfaceLifecycleStates(loaded, prev);
				saveCompanionSurfaceLifecycleState(nextPid, merged);
				return merged;
			}
			return loaded;
		});
	}, [principalId]);

	useEffect(() => {
		return subscribeShellLifecycle((pid) => {
			const current = principalIdRef.current.trim();
			if (!current || pid !== current) return;
			setLifecycle(loadCompanionSurfaceLifecycleState(current));
		});
	}, []);

	const dispatchLifecycle = useCallback(
		(action: CompanionSurfaceLifecycleAction) => {
			setLifecycle((prev) => {
				const next = companionSurfaceLifecycleReducer(prev, action);
				const pid = principalIdRef.current.trim();
				if (pid) {
					saveCompanionSurfaceLifecycleState(pid, next);
				}
				return next;
			});
		},
		[]
	);

	const viewPrefs = useMemo((): CompanionViewPrefs => {
		const pid = principalId.trim();
		if (!pid) {
			return {
				pinnedIds: lifecycle.pinnedIds,
				dismissedIds: lifecycle.dismissedIds,
				restoredIds: lifecycle.restoredIds,
				historyExpanded: lifecycle.historyExpanded,
				collapsedMissionIds: lifecycle.collapsedMissionIds,
			};
		}
		return getCompanionViewPrefs(pid);
	}, [lifecycle, principalId]);

	return { lifecycle, viewPrefs, dispatchLifecycle };
}
