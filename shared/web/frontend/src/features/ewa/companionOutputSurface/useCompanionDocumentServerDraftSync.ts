/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Server-draft autosync state machine for embedded companion document editor (debounce, retry, manual flush).
 *
 * Invariants:
 * - Sync runs only when document is saveable, version-known, and local edits exist.
 * - Draft conflict preserves local edits and surfaces operator-facing copy via sync state.
 *
 * Related:
 * - CompanionDocumentEditorMode.tsx
 * - src/services/ewa/ewaCompanionDocumentSurfaceApi.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';

import {
	EwaCompanionDocumentDraftConflictError,
	saveEwaCompanionDocumentServerDraft,
	type EwaCompanionDocumentServerDraft,
} from '@/services/ewa/ewaCompanionDocumentSurfaceApi';

export type ServerDraftSyncState =
	| 'idle'
	| 'queued'
	| 'syncing'
	| 'retrying'
	| 'synced'
	| 'failed'
	| 'conflict';

const SERVER_DRAFT_SYNC_DEBOUNCE_MS = 1500;
const SERVER_DRAFT_RETRY_BASE_MS = 1200;
const SERVER_DRAFT_MAX_RETRIES = 2;
const SERVER_DRAFT_SYNC_AGE_TICK_MS = 60_000;

function buildServerDraftSyncKey(
	markdown: string,
	version: number | null
): string {
	return `${version ?? -1}::${markdown}`;
}

function createEditorSessionId(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	return `ewa-doc-surface-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type UseCompanionDocumentServerDraftSyncArgs = {
	documentId: string | null;
	canSave: boolean | undefined;
	hasUnsavedChanges: boolean;
	loading: boolean;
	saving: boolean;
	markdown: string;
	baseVersion: number | null;
	t: TFunction;
};

export function useCompanionDocumentServerDraftSync({
	documentId,
	canSave,
	hasUnsavedChanges,
	loading,
	saving,
	markdown,
	baseVersion,
	t,
}: UseCompanionDocumentServerDraftSyncArgs) {
	const editorSessionIdRef = useRef<string>(createEditorSessionId());
	const serverDraftSyncRef = useRef<string>(
		buildServerDraftSyncKey(markdown, baseVersion)
	);
	const serverDraftForceSyncRef = useRef(false);
	const serverDraftRetryCountRef = useRef<number>(0);
	const serverDraftRetryTimerRef = useRef<number | null>(null);
	const [serverDraft, setServerDraft] =
		useState<EwaCompanionDocumentServerDraft | null>(null);
	const [serverDraftSyncError, setServerDraftSyncError] = useState<
		string | null
	>(null);
	const [serverDraftSyncState, setServerDraftSyncState] =
		useState<ServerDraftSyncState>('idle');
	const [serverDraftRetryTick, setServerDraftRetryTick] = useState(0);
	const [serverDraftAgeTick, setServerDraftAgeTick] = useState(0);

	const resetSyncBaseline = useCallback(
		(nextMarkdown: string, version: number | null) => {
			serverDraftSyncRef.current = buildServerDraftSyncKey(
				nextMarkdown,
				version
			);
		},
		[]
	);

	const resetSyncRuntime = useCallback(() => {
		setServerDraftSyncError(null);
		setServerDraftSyncState('idle');
		setServerDraftAgeTick(0);
		serverDraftForceSyncRef.current = false;
		serverDraftRetryCountRef.current = 0;
		if (
			typeof window !== 'undefined' &&
			serverDraftRetryTimerRef.current != null
		) {
			window.clearTimeout(serverDraftRetryTimerRef.current);
			serverDraftRetryTimerRef.current = null;
		}
	}, []);

	useEffect(
		() => () => {
			if (
				typeof window !== 'undefined' &&
				serverDraftRetryTimerRef.current != null
			) {
				window.clearTimeout(serverDraftRetryTimerRef.current);
				serverDraftRetryTimerRef.current = null;
			}
		},
		[]
	);

	useEffect(() => {
		void serverDraftRetryTick;
		if (!documentId || canSave === false) {
			setServerDraftSyncState('idle');
			serverDraftForceSyncRef.current = false;
			return;
		}
		if (!hasUnsavedChanges || loading || saving || baseVersion == null) {
			if (!hasUnsavedChanges) {
				setServerDraftSyncState('idle');
				serverDraftForceSyncRef.current = false;
				serverDraftRetryCountRef.current = 0;
				if (
					typeof window !== 'undefined' &&
					serverDraftRetryTimerRef.current != null
				) {
					window.clearTimeout(serverDraftRetryTimerRef.current);
					serverDraftRetryTimerRef.current = null;
				}
			}
			return;
		}
		const syncKey = buildServerDraftSyncKey(markdown, baseVersion);
		const forceSyncNow = serverDraftForceSyncRef.current;
		serverDraftForceSyncRef.current = false;
		if (!forceSyncNow && serverDraftSyncRef.current === syncKey) return;
		if (typeof window === 'undefined') return;
		if (serverDraftRetryTimerRef.current != null) {
			window.clearTimeout(serverDraftRetryTimerRef.current);
			serverDraftRetryTimerRef.current = null;
		}
		setServerDraftSyncState(
			forceSyncNow
				? 'queued'
				: serverDraftRetryCountRef.current > 0
					? 'retrying'
					: 'queued'
		);
		const timer = window.setTimeout(
			() => {
				setServerDraftSyncState('syncing');
				void saveEwaCompanionDocumentServerDraft(documentId, {
					content: markdown,
					baseDocumentVersion: baseVersion ?? 0,
					expectedDraftVersion: serverDraft?.draftVersion,
					sourceSessionId: editorSessionIdRef.current,
				})
					.then((savedDraft) => {
						setServerDraft(savedDraft);
						setServerDraftSyncError(null);
						setServerDraftSyncState('synced');
						setServerDraftAgeTick(0);
						serverDraftSyncRef.current = syncKey;
						serverDraftRetryCountRef.current = 0;
					})
					.catch((err) => {
						if (err instanceof EwaCompanionDocumentDraftConflictError) {
							setServerDraft(err.conflict.serverDraft);
							setServerDraftSyncError(
								t('ewaCompanion.documentSurfaceServerDraftSyncConflict')
							);
							setServerDraftSyncState('conflict');
							serverDraftRetryCountRef.current = 0;
							serverDraftSyncRef.current = syncKey;
							return;
						}
						const nextRetry = serverDraftRetryCountRef.current + 1;
						if (nextRetry <= SERVER_DRAFT_MAX_RETRIES) {
							serverDraftRetryCountRef.current = nextRetry;
							setServerDraftSyncError(null);
							setServerDraftSyncState('retrying');
							serverDraftRetryTimerRef.current = window.setTimeout(() => {
								serverDraftRetryTimerRef.current = null;
								setServerDraftRetryTick((prev) => prev + 1);
							}, SERVER_DRAFT_RETRY_BASE_MS * nextRetry);
							return;
						}
						serverDraftRetryCountRef.current = 0;
						setServerDraftSyncError(
							err instanceof Error
								? `${t('ewaCompanion.documentSurfaceServerDraftSyncFailed')}: ${err.message}`
								: t('ewaCompanion.documentSurfaceServerDraftSyncFailed')
						);
						setServerDraftSyncState('failed');
						serverDraftSyncRef.current = syncKey;
					});
			},
			forceSyncNow ? 0 : SERVER_DRAFT_SYNC_DEBOUNCE_MS
		);
		return () => {
			window.clearTimeout(timer);
		};
	}, [
		baseVersion,
		canSave,
		documentId,
		hasUnsavedChanges,
		loading,
		markdown,
		saving,
		serverDraft?.draftVersion,
		serverDraftRetryTick,
		t,
	]);

	useEffect(() => {
		if (
			typeof window === 'undefined' ||
			serverDraftSyncState !== 'synced' ||
			!serverDraft?.updatedAt
		) {
			return;
		}
		const interval = window.setInterval(() => {
			setServerDraftAgeTick((prev) => prev + 1);
		}, SERVER_DRAFT_SYNC_AGE_TICK_MS);
		return () => {
			window.clearInterval(interval);
		};
	}, [serverDraft?.updatedAt, serverDraftSyncState]);

	const serverDraftSyncHint = useMemo(() => {
		void serverDraftAgeTick;
		if (!documentId || canSave === false) return '';
		switch (serverDraftSyncState) {
			case 'queued':
				return t('ewaCompanion.documentSurfaceServerDraftSyncQueued');
			case 'syncing':
				return t('ewaCompanion.documentSurfaceServerDraftSyncing');
			case 'retrying':
				return t('ewaCompanion.documentSurfaceServerDraftSyncRetrying');
			case 'failed':
				return t('ewaCompanion.documentSurfaceServerDraftSyncFailedShort');
			case 'conflict':
				return t('ewaCompanion.documentSurfaceServerDraftSyncConflictShort');
			case 'synced': {
				if (!serverDraft?.updatedAt) {
					return t('ewaCompanion.documentSurfaceServerDraftSynced');
				}
				const parsed = new Date(serverDraft.updatedAt);
				if (Number.isNaN(parsed.getTime())) {
					return t('ewaCompanion.documentSurfaceServerDraftSynced');
				}
				const ageMs = Math.max(0, Date.now() - parsed.getTime());
				if (ageMs < 5000) {
					return t('ewaCompanion.documentSurfaceServerDraftSyncedNow');
				}
				if (ageMs < 60_000) {
					return t('ewaCompanion.documentSurfaceServerDraftSyncedSecondsAgo', {
						seconds: Math.max(1, Math.floor(ageMs / 1000)),
					});
				}
				if (ageMs < 3_600_000) {
					return t('ewaCompanion.documentSurfaceServerDraftSyncedMinutesAgo', {
						minutes: Math.max(1, Math.floor(ageMs / 60_000)),
					});
				}
				return t('ewaCompanion.documentSurfaceServerDraftSyncedHoursAgo', {
					hours: Math.max(1, Math.floor(ageMs / 3_600_000)),
				});
			}
			default:
				return '';
		}
	}, [
		canSave,
		documentId,
		serverDraftAgeTick,
		serverDraft?.updatedAt,
		serverDraftSyncState,
		t,
	]);

	const serverDraftSyncActionBusy =
		serverDraftSyncState === 'syncing' || serverDraftSyncState === 'retrying';
	const saveDisabledForSync =
		!documentId || canSave === false || saving || loading;
	const serverDraftSyncActionVisible =
		!saveDisabledForSync && hasUnsavedChanges && baseVersion != null;
	const serverDraftSyncActionDisabled =
		!serverDraftSyncActionVisible || serverDraftSyncActionBusy;
	const serverDraftSyncActionLabel = serverDraftSyncActionBusy
		? t('ewaCompanion.documentSurfaceServerDraftSyncingAction')
		: serverDraftSyncState === 'failed' || serverDraftSyncState === 'conflict'
			? t('ewaCompanion.documentSurfaceServerDraftSyncRetry')
			: t('ewaCompanion.documentSurfaceServerDraftSyncNow');

	const runServerDraftSyncNow = () => {
		if (
			!documentId ||
			canSave === false ||
			baseVersion == null ||
			!hasUnsavedChanges ||
			loading ||
			saving
		) {
			return;
		}
		if (
			typeof window !== 'undefined' &&
			serverDraftRetryTimerRef.current != null
		) {
			window.clearTimeout(serverDraftRetryTimerRef.current);
			serverDraftRetryTimerRef.current = null;
		}
		serverDraftRetryCountRef.current = 0;
		serverDraftForceSyncRef.current = true;
		setServerDraftSyncError(null);
		setServerDraftSyncState('queued');
		setServerDraftAgeTick(0);
		setServerDraftRetryTick((prev) => prev + 1);
	};

	const offlineDraftOnly =
		hasUnsavedChanges &&
		(serverDraftSyncState === 'failed' ||
			serverDraftSyncState === 'retrying' ||
			Boolean(serverDraftSyncError));

	return {
		serverDraft,
		setServerDraft,
		serverDraftSyncError,
		setServerDraftSyncError,
		serverDraftSyncState,
		serverDraftSyncHint,
		serverDraftSyncActionVisible,
		serverDraftSyncActionDisabled,
		serverDraftSyncActionLabel,
		runServerDraftSyncNow,
		resetSyncBaseline,
		resetSyncRuntime,
		offlineDraftOnly,
	};
}
