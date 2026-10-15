/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Lightweight, **client-driven proactive tick** for EWA companion (HCM Module B, project «Mela's Ascension»).
 * Polls `getSnapshot()` periodically, detects meaningful **shell deltas** (active app changed, window set
 * changed, idle), and posts `/companion-observation` debounced. Returns the latest anticipation hint so the
 * companion chat panel can render a *pre-message bubble* without injecting anything into the persisted
 * transcript.
 *
 * Invariants:
 * - **Never** opens an SSE stream and **never** triggers a full chat turn — the endpoint deliberately runs
 *   without an LLM call.
 * - Server is authoritative: when `hint = null` we clear local state; we never invent a hint client-side.
 * - **Debounce ≥ 5s** between requests, plus **diff guard**: skip when the heuristic key did not change.
 * - When no Desktop shell bridge is mounted (`getSnapshot()` → null) the hook stays inert.
 * - Hint dismissal is local — the next non-empty hint from the server replaces it.
 * - Skips work while `document.hidden` (tab background) — no observation POST / timer side-effects until visible.
 *
 * Related:
 * - src/features/ewa/companionObservationConstants.ts (**canonical pacing numbers** — import here instead of literals)
 * - api/ewa_platform/gateways/routers/companion_chat.py
 * - api/ewa_platform/companion/persona/anticipation.py
 * - src/services/ewa/ewaCompanionChatApi.ts
 */
import { useEwaCompanionShellBridge } from '@/pages/Desktop/context/EwaCompanionShellBridgeContext';
import {
	type CompanionAnticipationHint,
	type CompanionObservationRequest,
	postEwaCompanionObservation,
} from '@/services/ewa/ewaCompanionChatApi';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
	COMPANION_OBSERVATION_IDLE_MS,
	COMPANION_OBSERVATION_MIN_GAP_MS,
	COMPANION_OBSERVATION_POLL_INTERVAL_MS,
} from '@/features/ewa/companionObservationConstants';
import {
	observationTriggerAllowed,
	readLocalObservationTriggerPrefs,
} from '@/features/ewa/companionObservationTriggerPrefs';
import { isProactiveSnoozedToday } from '@/features/ewa/companionUx/companionProactiveSnoozeStorage';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';

const DEFAULT_TICK_INTERVAL_MS = COMPANION_OBSERVATION_POLL_INTERVAL_MS;
const DEFAULT_MIN_GAP_BETWEEN_POSTS_MS = COMPANION_OBSERVATION_MIN_GAP_MS;
const DEFAULT_IDLE_AFTER_MS = COMPANION_OBSERVATION_IDLE_MS;

type ShellSnapshot = ReturnType<
	ReturnType<typeof useEwaCompanionShellBridge>['getSnapshot']
>;

type ActivityKey = {
	activeApp: string | null;
	activeWindow: string | null;
	activeTitle: string | null;
	openCount: number;
	workspaceLabel: string | null;
};

function emptyActivityKey(): ActivityKey {
	return {
		activeApp: null,
		activeWindow: null,
		activeTitle: null,
		openCount: 0,
		workspaceLabel: null,
	};
}

export function pickActivityKey(snap: ShellSnapshot): ActivityKey {
	if (!snap || typeof snap !== 'object') {
		return emptyActivityKey();
	}
	const obj = snap as Record<string, unknown>;
	const windows = Array.isArray(obj.windows) ? obj.windows : [];
	const activeWindowId =
		typeof obj.active_window_id === 'string' && obj.active_window_id
			? obj.active_window_id
			: null;
	const activeDesktopId =
		typeof obj.active_desktop_id === 'string' && obj.active_desktop_id
			? obj.active_desktop_id
			: null;
	const activeRow = windows.find((row) => {
		if (!row || typeof row !== 'object') return false;
		const rawId = (row as Record<string, unknown>).window_id;
		return typeof rawId === 'string' && rawId === activeWindowId;
	}) as Record<string, unknown> | undefined;
	if (activeRow || activeWindowId || activeDesktopId || windows.length > 0) {
		const activeApp =
			typeof activeRow?.app_component === 'string' &&
			activeRow.app_component.trim()
				? activeRow.app_component.trim()
				: null;
		const activeTitle =
			typeof activeRow?.title === 'string' && activeRow.title.trim()
				? activeRow.title.trim()
				: null;
		return {
			activeApp,
			activeWindow: activeWindowId,
			activeTitle,
			openCount: windows.length,
			workspaceLabel: activeDesktopId,
		};
	}

	// Compatibility for old synthetic snapshots used before EwaCompanionShellContextV1.
	const focused =
		(obj.focused_window as Record<string, unknown> | undefined) ?? {};
	const open = obj.open_windows;
	const workspace =
		(obj.active_workspace as Record<string, unknown> | undefined) ?? {};
	const activeApp =
		typeof focused.app_component === 'string' && focused.app_component
			? focused.app_component
			: null;
	const activeWindow =
		typeof focused.window_id === 'string' && focused.window_id
			? focused.window_id
			: null;
	const activeTitle =
		typeof focused.title === 'string' && focused.title ? focused.title : null;
	const openCount = Array.isArray(open) ? open.length : 0;
	const workspaceLabel =
		typeof workspace.id === 'string' && workspace.id
			? workspace.id
			: typeof workspace.label === 'string'
				? workspace.label
				: null;
	return { activeApp, activeWindow, activeTitle, openCount, workspaceLabel };
}

function inferTrigger(
	prev: ActivityKey | null,
	next: ActivityKey,
	lastInteractionMs: number,
	idleAfterMs: number
): CompanionObservationRequest['trigger'] | null {
	if (!prev) {
		return next.activeApp || next.openCount > 0 ? 'active_app_changed' : null;
	}
	if (prev.workspaceLabel !== next.workspaceLabel) return 'workspace_switched';
	if (prev.activeApp !== next.activeApp) return 'active_app_changed';
	if (prev.activeWindow !== next.activeWindow) return 'focus_change';
	if (next.openCount > prev.openCount) return 'window_opened';
	if (next.openCount < prev.openCount) return 'window_closed';
	const now = Date.now();
	if (
		idleAfterMs > 0 &&
		lastInteractionMs > 0 &&
		now - lastInteractionMs >= idleAfterMs
	) {
		return 'idle';
	}
	return null;
}

function observationFromKey(
	key: ActivityKey
): CompanionObservationRequest['observation'] {
	const payload: Record<string, unknown> = {};
	if (key.activeApp) payload.app_component = key.activeApp;
	if (key.activeWindow) payload.window_id = key.activeWindow;
	if (key.activeTitle) payload.title = key.activeTitle;
	if (key.workspaceLabel) payload.workspace_id = key.workspaceLabel;
	payload.open_windows_count = key.openCount;
	return payload;
}

export type UseEwaCompanionAnticipationTickOptions = {
	enabled?: boolean;
	tickIntervalMs?: number;
	minGapBetweenPostsMs?: number;
	idleAfterMs?: number;
	/** Contemplation / Right to Silence — keep posting observations but never show hint bubbles. */
	suppressHints?: boolean;
};

export type UseEwaCompanionAnticipationTickResult = {
	hint: CompanionAnticipationHint | null;
	dismissHint: () => void;
};

export function useEwaCompanionAnticipationTick(
	principalId: string,
	options?: UseEwaCompanionAnticipationTickOptions
): UseEwaCompanionAnticipationTickResult {
	const enabled = options?.enabled ?? true;
	const suppressHints = options?.suppressHints ?? false;
	const tickIntervalMs = options?.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
	const minGap =
		options?.minGapBetweenPostsMs ?? DEFAULT_MIN_GAP_BETWEEN_POSTS_MS;
	const idleAfterMs = options?.idleAfterMs ?? DEFAULT_IDLE_AFTER_MS;

	const { getSnapshot } = useEwaCompanionShellBridge();
	const [hint, setHint] = useState<CompanionAnticipationHint | null>(null);
	const lastKeyRef = useRef<ActivityKey | null>(null);
	const lastPostAtRef = useRef<number>(0);
	const lastInteractionAtRef = useRef<number>(0);
	const inflightRef = useRef<boolean>(false);

	const dismissHint = useCallback(() => {
		setHint(null);
	}, []);

	useEffect(() => {
		if (!enabled) return undefined;
		if (!principalId) return undefined;

		const onInteraction = () => {
			lastInteractionAtRef.current = Date.now();
		};
		window.addEventListener('pointerdown', onInteraction, { passive: true });
		window.addEventListener('keydown', onInteraction, { passive: true });

		const tick = async () => {
			if (typeof document !== 'undefined' && document.hidden) return;
			if (inflightRef.current) return;
			const snap = getSnapshot();
			if (!snap) return;
			const nextKey = pickActivityKey(snap);
			const trigger = inferTrigger(
				lastKeyRef.current,
				nextKey,
				lastInteractionAtRef.current,
				idleAfterMs
			);
			if (!trigger) {
				lastKeyRef.current = nextKey;
				return;
			}
			const triggerPrefs = readLocalObservationTriggerPrefs(principalId);
			if (!observationTriggerAllowed(trigger, triggerPrefs)) {
				lastKeyRef.current = nextKey;
				return;
			}
			const now = Date.now();
			if (now - lastPostAtRef.current < minGap) {
				return;
			}
			lastKeyRef.current = nextKey;
			lastPostAtRef.current = now;
			inflightRef.current = true;
			try {
				const res = await postEwaCompanionObservation({
					trigger,
					observation: observationFromKey(nextKey),
					shell_context: snap,
				});
				if (suppressHints || isProactiveSnoozedToday(principalId)) {
					setHint(null);
				} else {
					setHint(res.hint);
				}
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_anticipation_observation',
					'proactive observation post failed',
					err
				);
			} finally {
				inflightRef.current = false;
			}
		};

		const intervalId = window.setInterval(() => {
			void tick();
		}, tickIntervalMs);

		const onVisibility = () => {
			if (document.hidden) return;
			void tick();
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pointerdown', onInteraction);
			window.removeEventListener('keydown', onInteraction);
		};
	}, [
		enabled,
		suppressHints,
		principalId,
		getSnapshot,
		tickIntervalMs,
		minGap,
		idleAfterMs,
	]);

	useEffect(() => {
		if (suppressHints || isProactiveSnoozedToday(principalId)) {
			setHint(null);
		}
	}, [suppressHints, principalId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset bookkeeping when principal switches; no closure captures.
	useEffect(() => {
		setHint(null);
		lastKeyRef.current = null;
		lastPostAtRef.current = 0;
		lastInteractionAtRef.current = 0;
	}, [principalId]);

	return { hint, dismissHint };
}
