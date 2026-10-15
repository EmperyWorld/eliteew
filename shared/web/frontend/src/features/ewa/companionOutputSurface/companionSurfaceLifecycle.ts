/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companion slice of Shell Lifecycle Manager (SLM): UOS card zones plus center-mission
 * collapse prefs. Desktop shell facade: pages/Desktop/shell/shellLifecycleManager.ts.
 *
 * Invariants:
 * - Server task runs remain the source of truth; this file stores only view preferences.
 * - Terminal runs stay in the active zone until the operator closes the card (dismiss).
 * - Closing a card never cancels a run. Cancellation goes through explicit task-run APIs.
 * - Dismiss/pin/collapse prefs persist in localStorage per principal and survive reload.
 * - Active / truthfully-live missions ignore collapse (always expanded chrome).
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md §U0
 * - src/pages/Desktop/shell/shellLifecycleManager.ts
 * - src/features/ewa/companionOutputSurface/UniversalOutputSurface.tsx
 */

import type {
	CompanionSurfaceBlock,
	EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';

import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';

export type CompanionSurfaceCardZone = 'active' | 'history' | 'pinned';

export type CompanionSurfaceLifecycleState = {
	pinnedIds: string[];
	dismissedIds: string[];
	restoredIds: string[];
	historyExpanded: boolean;
	/** Terminal missions the operator collapsed (durable). */
	collapsedMissionIds: string[];
	/** Terminal missions the operator expanded (overrides default collapsed). */
	expandedMissionIds: string[];
};

/** Public SLM companion view prefs (design §B.2). */
export type CompanionViewPrefs = {
	pinnedIds: string[];
	dismissedIds: string[];
	restoredIds: string[];
	historyExpanded: boolean;
	collapsedMissionIds: string[];
};

export type CompanionSurfaceCardRef = {
	id: string;
	runId: string | null;
	status: string;
	zone: CompanionSurfaceCardZone;
	dismissed: boolean;
};

const STORAGE_VERSION = 1;
const MAX_DISMISSED_IDS = 80;
const MAX_MISSION_COLLAPSE_IDS = 80;

export const EMPTY_COMPANION_SURFACE_LIFECYCLE: CompanionSurfaceLifecycleState =
	{
		pinnedIds: [],
		dismissedIds: [],
		restoredIds: [],
		historyExpanded: false,
		collapsedMissionIds: [],
		expandedMissionIds: [],
	};

type LifecycleListener = (principalId: string) => void;
const lifecycleListeners = new Set<LifecycleListener>();

export function subscribeCompanionSurfaceLifecycle(
	listener: LifecycleListener
): () => void {
	lifecycleListeners.add(listener);
	return () => {
		lifecycleListeners.delete(listener);
	};
}

function notifyCompanionSurfaceLifecycle(principalId: string): void {
	const pid = principalId.trim();
	if (!pid) return;
	for (const listener of lifecycleListeners) {
		try {
			listener(pid);
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_surface_lifecycle_notify',
				'surface lifecycle listener failed',
				err
			);
		}
	}
}

function storageKey(principalId: string): string {
	return `eliteew.ewa.surfaceLifecycle.v${STORAGE_VERSION}.${principalId}`;
}

function unique(list: string[]): string[] {
	return [...new Set(list.map((id) => id.trim()).filter(Boolean))];
}

export function cardIdForSurfaceBlock(block: CompanionSurfaceBlock): string {
	return block.id || `block:${block.kind}:${block.run_id ?? 'floating'}`;
}

export function cardIdForRun(run: EwaCompanionTaskRun): string {
	const runId = run.id?.trim();
	if (runId) return `run:${runId}`;
	const blockId = run.surface_blocks?.[0]?.id;
	return blockId || 'task_run:unknown:result';
}

export function cardIdForRunId(runId: string): string {
	const id = runId.trim();
	return id ? `run:${id}` : '';
}

/** Legacy surface block ids — kept for dismiss matching after card id migration. */
export function legacyCardIdsForRun(run: EwaCompanionTaskRun): string[] {
	const runId = run.id?.trim();
	const blockId = run.surface_blocks?.[0]?.id?.trim();
	const legacy = runId ? [`task_run:${runId}:result`] : [];
	return unique([...(blockId ? [blockId] : []), ...legacy]);
}

function normalizeDismissedId(id: string): string {
	const trimmed = id.trim();
	const legacy = /^task_run:([^:]+):result$/.exec(trimmed);
	if (legacy?.[1]) return `run:${legacy[1]}`;
	return trimmed;
}

function runIdFromCardId(cardId: string): string {
	const normalized = normalizeDismissedId(cardId);
	const match = /^run:(.+)$/.exec(normalized);
	return match?.[1]?.trim() || '';
}

function isRunDismissed(
	run: EwaCompanionTaskRun,
	dismissed: Set<string>
): boolean {
	const keys = unique([cardIdForRun(run), ...legacyCardIdsForRun(run)]);
	return keys.some((key) => dismissed.has(key));
}

export function isCompanionRunIdDismissed(
	runId: string,
	state: CompanionSurfaceLifecycleState
): boolean {
	const id = runId.trim();
	if (!id) return false;
	const dismissed = new Set(state.dismissedIds.map(normalizeDismissedId));
	return (
		dismissed.has(cardIdForRunId(id)) || dismissed.has(`task_run:${id}:result`)
	);
}

export function dismissedCompanionRunIdsFromLifecycle(
	state: CompanionSurfaceLifecycleState
): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const cardId of state.dismissedIds) {
		const runId = runIdFromCardId(cardId);
		if (!runId || seen.has(runId)) continue;
		seen.add(runId);
		out.push(runId);
	}
	return out;
}

export function loadCompanionSurfaceLifecycleState(
	principalId: string
): CompanionSurfaceLifecycleState {
	if (typeof window === 'undefined') return EMPTY_COMPANION_SURFACE_LIFECYCLE;
	const pid = principalId.trim();
	if (!pid) return EMPTY_COMPANION_SURFACE_LIFECYCLE;
	try {
		const raw = window.localStorage.getItem(storageKey(pid));
		if (!raw) return EMPTY_COMPANION_SURFACE_LIFECYCLE;
		const parsed = JSON.parse(raw) as Partial<CompanionSurfaceLifecycleState>;
		return {
			pinnedIds: unique(
				Array.isArray(parsed.pinnedIds) ? parsed.pinnedIds : []
			),
			dismissedIds: unique(
				(Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : []).map(
					normalizeDismissedId
				)
			).slice(0, MAX_DISMISSED_IDS),
			restoredIds: unique(
				Array.isArray(parsed.restoredIds) ? parsed.restoredIds : []
			),
			historyExpanded: Boolean(parsed.historyExpanded),
			collapsedMissionIds: unique(
				Array.isArray(parsed.collapsedMissionIds)
					? parsed.collapsedMissionIds
					: []
			).slice(0, MAX_MISSION_COLLAPSE_IDS),
			expandedMissionIds: unique(
				Array.isArray(parsed.expandedMissionIds)
					? parsed.expandedMissionIds
					: []
			).slice(0, MAX_MISSION_COLLAPSE_IDS),
		};
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_surface_lifecycle_load',
			'localStorage surface lifecycle load failed',
			err
		);
		return EMPTY_COMPANION_SURFACE_LIFECYCLE;
	}
}

export function saveCompanionSurfaceLifecycleState(
	principalId: string,
	state: CompanionSurfaceLifecycleState
): void {
	if (typeof window === 'undefined') return;
	const pid = principalId.trim();
	if (!pid) return;
	try {
		window.localStorage.setItem(
			storageKey(pid),
			JSON.stringify({
				pinnedIds: unique(state.pinnedIds),
				dismissedIds: unique(state.dismissedIds).slice(0, MAX_DISMISSED_IDS),
				restoredIds: unique(state.restoredIds),
				historyExpanded: Boolean(state.historyExpanded),
				collapsedMissionIds: unique(state.collapsedMissionIds).slice(
					0,
					MAX_MISSION_COLLAPSE_IDS
				),
				expandedMissionIds: unique(state.expandedMissionIds).slice(
					0,
					MAX_MISSION_COLLAPSE_IDS
				),
			})
		);
		notifyCompanionSurfaceLifecycle(pid);
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_surface_lifecycle_save',
			'localStorage surface lifecycle save failed',
			err
		);
	}
}

export function mergeCompanionSurfaceLifecycleStates(
	base: CompanionSurfaceLifecycleState,
	overlay: CompanionSurfaceLifecycleState
): CompanionSurfaceLifecycleState {
	return {
		pinnedIds: unique([...base.pinnedIds, ...overlay.pinnedIds]),
		dismissedIds: unique([...base.dismissedIds, ...overlay.dismissedIds]).slice(
			0,
			MAX_DISMISSED_IDS
		),
		restoredIds: unique([...base.restoredIds, ...overlay.restoredIds]),
		historyExpanded: Boolean(base.historyExpanded || overlay.historyExpanded),
		collapsedMissionIds: unique([
			...base.collapsedMissionIds,
			...overlay.collapsedMissionIds,
		]).slice(0, MAX_MISSION_COLLAPSE_IDS),
		expandedMissionIds: unique([
			...base.expandedMissionIds,
			...overlay.expandedMissionIds,
		]).slice(0, MAX_MISSION_COLLAPSE_IDS),
	};
}

export function companionSurfaceLifecycleReducer(
	state: CompanionSurfaceLifecycleState,
	action:
		| { type: 'close'; id: string; alsoIds?: string[] }
		| { type: 'pin'; id: string }
		| { type: 'unpin'; id: string }
		| { type: 'restore'; id: string }
		| { type: 'toggle_history' }
): CompanionSurfaceLifecycleState {
	const id = 'id' in action ? action.id.trim() : '';
	if ('id' in action && !id) return state;
	if (action.type === 'close') {
		const closeIds = unique([
			id,
			...(action.alsoIds ?? []).map((x) => x.trim()).filter(Boolean),
		]).map(normalizeDismissedId);
		return {
			...state,
			dismissedIds: unique([...state.dismissedIds, ...closeIds]).slice(
				0,
				MAX_DISMISSED_IDS
			),
			pinnedIds: state.pinnedIds.filter((x) => !closeIds.includes(x)),
			restoredIds: state.restoredIds.filter((x) => !closeIds.includes(x)),
		};
	}
	if (action.type === 'pin') {
		return {
			...state,
			pinnedIds: unique([...state.pinnedIds, id]),
			dismissedIds: state.dismissedIds.filter((x) => x !== id),
			restoredIds: state.restoredIds.filter((x) => x !== id),
		};
	}
	if (action.type === 'unpin') {
		return {
			...state,
			pinnedIds: state.pinnedIds.filter((x) => x !== id),
		};
	}
	if (action.type === 'restore') {
		return {
			...state,
			restoredIds: unique([...state.restoredIds, id]),
			dismissedIds: state.dismissedIds.filter((x) => x !== id),
			historyExpanded: true,
		};
	}
	return {
		...state,
		historyExpanded: !state.historyExpanded,
	};
}

/** Dismiss a task run from center/ops chrome; persists immediately when principal is known. */
export function dismissCompanionRunInSurfaceLifecycle(
	principalId: string,
	runId: string
): CompanionSurfaceLifecycleState {
	const current = loadCompanionSurfaceLifecycleState(principalId);
	const id = runId.trim();
	if (!id) return current;
	const next = companionSurfaceLifecycleReducer(current, {
		type: 'close',
		id: cardIdForRunId(id),
		alsoIds: [`task_run:${id}:result`],
	});
	saveCompanionSurfaceLifecycleState(principalId, next);
	return next;
}

export function getCompanionViewPrefs(principalId: string): CompanionViewPrefs {
	const state = loadCompanionSurfaceLifecycleState(principalId);
	return {
		pinnedIds: state.pinnedIds,
		dismissedIds: state.dismissedIds,
		restoredIds: state.restoredIds,
		historyExpanded: state.historyExpanded,
		collapsedMissionIds: state.collapsedMissionIds,
	};
}

/**
 * Persist center-mission chrome collapse. Active missions ignore collapse at read time.
 * Terminal default (no override): collapsed. Expand clears collapsed and records expandedIds.
 */
export function setMissionCollapsed(
	principalId: string,
	runId: string,
	collapsed: boolean
): CompanionSurfaceLifecycleState {
	const current = loadCompanionSurfaceLifecycleState(principalId);
	const id = runId.trim();
	if (!id) return current;
	const next: CompanionSurfaceLifecycleState = collapsed
		? {
				...current,
				collapsedMissionIds: unique([...current.collapsedMissionIds, id]).slice(
					0,
					MAX_MISSION_COLLAPSE_IDS
				),
				expandedMissionIds: current.expandedMissionIds.filter((x) => x !== id),
			}
		: {
				...current,
				expandedMissionIds: unique([...current.expandedMissionIds, id]).slice(
					0,
					MAX_MISSION_COLLAPSE_IDS
				),
				collapsedMissionIds: current.collapsedMissionIds.filter(
					(x) => x !== id
				),
			};
	saveCompanionSurfaceLifecycleState(principalId, next);
	return next;
}

/** View-only: live missions always expanded; terminal defaults to collapsed. */
export function isMissionChromeCollapsed(
	principalId: string,
	runId: string,
	isActive: boolean
): boolean {
	if (isActive) return false;
	const id = runId.trim();
	if (!id) return true;
	const state = loadCompanionSurfaceLifecycleState(principalId);
	if (state.expandedMissionIds.includes(id)) return false;
	if (state.collapsedMissionIds.includes(id)) return true;
	return true;
}

export function deriveCompanionSurfaceCardRefs(
	runs: EwaCompanionTaskRun[],
	state: CompanionSurfaceLifecycleState
): CompanionSurfaceCardRef[] {
	const pinned = new Set(state.pinnedIds);
	const dismissed = new Set(state.dismissedIds.map(normalizeDismissedId));
	return runs.map((run) => {
		const id = cardIdForRun(run);
		const status = (run.status || '').trim().toLowerCase();
		const isPinned = pinned.has(id);
		const isDismissed = isRunDismissed(run, dismissed);
		const zone: CompanionSurfaceCardZone = isPinned ? 'pinned' : 'active';
		return {
			id,
			runId: run.id || null,
			status,
			zone,
			dismissed: isDismissed,
		};
	});
}
