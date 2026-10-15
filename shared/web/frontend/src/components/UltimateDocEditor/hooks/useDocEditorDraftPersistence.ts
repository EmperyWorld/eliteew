/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local + server draft persistence for Ultimate Doc Editor: debounced save,
 * recovery modal, conflict detection, and server-draft version tracking.
 *
 * Invariants:
 * - In-flight server draft PUT is aborted on document switch, clean save, or unmount.
 * - Generation token drops stale debounced callbacks after doc/key change.
 *
 * Related:
 * - `api/docEditorDraftsApi.ts`, `utils/docEditorServerDraftSync.ts`
 * - `documentation/product/ULTIMATE-DOC-EDITOR.md` §6.1 Черновики
 */

import type { Editor } from '@tiptap/react';
import type { FileId } from '@/types/fileExchange';
import { log } from '@/utils/logger';
import type { StoreApi } from 'zustand';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import {
	discardServerDraft,
	fetchServerDraft,
} from '../api/docEditorDraftsApi';
import { isRequestAborted } from '@/services/api/client';
import { persistServerDraftWithConflictRecovery } from '../utils/docEditorServerDraftSync';
import type { EditorStore } from '../store/editorStore';
import { normalizeContentToHtml } from '../utils/htmlComparableText';
import {
	isUltimateDocTelemetryEnabled,
	LOCAL_DRAFT_KEY_PREFIX,
	LOCAL_DRAFT_MAX_AGE_MS,
	LOCAL_DRAFT_RETENTION_DAYS,
	type DraftCleanupReason,
	type DraftTelemetryEventName,
	type LocalDraftConflict,
	type LocalEditorDraft,
	parseLocalEditorDraft,
	ULTIMATE_DOC_TELEMETRY_EVENT,
} from '../utils/docEditorDraftLocal';
import { DOC_EDITOR_DRAFT_DEBOUNCE_MS } from '../utils/docEditorPersistTiming';

export interface UseDocEditorDraftPersistenceParams {
	currentFileId: FileId | null;
	currentDocument: EditorStore['currentDocument'];
	documentId?: string;
	documentSource: EditorStore['documentSource'];
	payloadWantsUnifiedContent: boolean;
	canPersistCanonical: boolean;
	collaborationEnabledForEditor: boolean;
	editorInitialContent: string;
	isDirty: boolean;
	isLoadingDocument: boolean;
	editorStoreApi: StoreApi<EditorStore>;
	updateStats: (html: string) => void;
	tiptapEditor: Editor | null;
	programmaticUpdateRef: MutableRefObject<boolean>;
	markdownOriginalHtmlRef: MutableRefObject<string>;
	markdownBaselineRef: MutableRefObject<string>;
	setMarkdownMode: Dispatch<SetStateAction<boolean>>;
	setMarkdownSource: Dispatch<SetStateAction<string>>;
	setMarkdownEdited: Dispatch<SetStateAction<boolean>>;
	setRenderedMarkdownPreview: Dispatch<SetStateAction<string>>;
}

export interface UseDocEditorDraftPersistenceResult {
	draftRecoveryOpen: boolean;
	draftRecoverySource: 'auto' | 'manual' | null;
	pendingDraft: LocalEditorDraft | null;
	draftConflict: LocalDraftConflict | null;
	hasLocalDraftIndicator: boolean;
	localDraftUpdatedAt: string | null;
	localDraftStorageKey: string;
	localDraftTooltip: string | null;
	handleRestoreLocalDraft: () => void;
	handleSkipDraftRecovery: () => void;
	handleDiscardLocalDraft: () => void;
	handleOpenLocalDraftRecovery: () => void;
}

export function useDocEditorDraftPersistence(
	params: UseDocEditorDraftPersistenceParams
): UseDocEditorDraftPersistenceResult {
	const {
		currentFileId,
		currentDocument,
		documentId,
		documentSource,
		payloadWantsUnifiedContent,
		canPersistCanonical,
		collaborationEnabledForEditor,
		editorInitialContent,
		isDirty,
		isLoadingDocument,
		editorStoreApi,
		updateStats,
		tiptapEditor,
		programmaticUpdateRef,
		markdownOriginalHtmlRef,
		markdownBaselineRef,
		setMarkdownMode,
		setMarkdownSource,
		setMarkdownEdited,
		setRenderedMarkdownPreview,
	} = params;

	const [draftRecoveryOpen, setDraftRecoveryOpen] = useState(false);
	const [draftRecoverySource, setDraftRecoverySource] = useState<
		'auto' | 'manual' | null
	>(null);
	const [pendingDraft, setPendingDraft] = useState<LocalEditorDraft | null>(
		null
	);
	const [draftConflict, setDraftConflict] = useState<LocalDraftConflict | null>(
		null
	);
	const [hasLocalDraftIndicator, setHasLocalDraftIndicator] = useState(false);
	const [localDraftUpdatedAt, setLocalDraftUpdatedAt] = useState<string | null>(
		null
	);

	const dismissedDraftKeysRef = useRef<Set<string>>(new Set());
	const becameDirtyForCurrentDocRef = useRef(false);
	const lastConflictSignatureRef = useRef<string | null>(null);
	const draftCleanupInitializedRef = useRef(false);
	const serverDraftVersionRef = useRef<number | null>(null);
	const serverDraftSyncingRef = useRef(false);
	const serverDraftOpGenerationRef = useRef(0);
	const serverDraftAbortRef = useRef<AbortController | null>(null);

	const abortInFlightServerDraftPut = useCallback(() => {
		serverDraftAbortRef.current?.abort();
		serverDraftAbortRef.current = null;
	}, []);

	const draftDocumentKey = useMemo(() => {
		if (currentFileId) {
			return `file:${currentFileId}`;
		}
		if (currentDocument?.id && currentDocument.id !== 'temp') {
			return `doc:${currentDocument.id}`;
		}
		if (documentId) {
			return `doc:${documentId}`;
		}
		return 'draft:new';
	}, [currentFileId, currentDocument?.id, documentId]);

	const localDraftStorageKey = useMemo(
		() => `${LOCAL_DRAFT_KEY_PREFIX}:${draftDocumentKey}`,
		[draftDocumentKey]
	);

	const serverDraftEnabledForDocument = useMemo(
		() =>
			Boolean(
				!collaborationEnabledForEditor &&
					!payloadWantsUnifiedContent &&
					!currentFileId &&
					documentSource === 'doc_editor' &&
					currentDocument?.id &&
					currentDocument.id !== 'temp' &&
					canPersistCanonical
			),
		[
			collaborationEnabledForEditor,
			currentDocument?.id,
			canPersistCanonical,
			currentFileId,
			documentSource,
			payloadWantsUnifiedContent,
		]
	);

	const emitDraftTelemetry = useCallback(
		(
			name: DraftTelemetryEventName,
			details?: Record<string, unknown>
		): void => {
			if (typeof window === 'undefined' || !isUltimateDocTelemetryEnabled()) {
				return;
			}

			const payload = {
				name,
				documentId: currentDocument?.id ?? null,
				draftDocumentKey,
				localDraftStorageKey,
				timestamp: new Date().toISOString(),
				...(details ?? {}),
			};

			window.dispatchEvent(
				new CustomEvent(ULTIMATE_DOC_TELEMETRY_EVENT, { detail: payload })
			);
			log.debug('UltimateDocEditor', `Draft telemetry: ${name}`, payload);
		},
		[currentDocument?.id, draftDocumentKey, localDraftStorageKey]
	);

	const localDraftSessionId = useMemo(() => {
		const sessionStorageKey = 'ultimate-doc-editor:local-draft-session-id';
		const fallback = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
		try {
			const existing = window.sessionStorage.getItem(sessionStorageKey)?.trim();
			if (existing) {
				return existing;
			}
			const generated =
				typeof window.crypto?.randomUUID === 'function'
					? window.crypto.randomUUID()
					: fallback;
			window.sessionStorage.setItem(sessionStorageKey, generated);
			return generated;
		} catch {
			return fallback;
		}
	}, []);

	const runLocalDraftCleanup = useCallback(
		(reason: DraftCleanupReason): void => {
			const now = Date.now();
			const staleKeys: string[] = [];
			let scanned = 0;
			let removedCorrupted = 0;
			let removedExpired = 0;

			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (!key?.startsWith(`${LOCAL_DRAFT_KEY_PREFIX}:`)) {
					continue;
				}

				scanned += 1;
				const draft = parseLocalEditorDraft(localStorage.getItem(key));
				if (!draft) {
					removedCorrupted += 1;
					staleKeys.push(key);
					continue;
				}

				const updatedAtMs = Date.parse(draft.updatedAt);
				if (
					!Number.isFinite(updatedAtMs) ||
					now - updatedAtMs > LOCAL_DRAFT_MAX_AGE_MS
				) {
					removedExpired += 1;
					staleKeys.push(key);
				}
			}

			staleKeys.forEach((key) => {
				localStorage.removeItem(key);
			});

			emitDraftTelemetry('draft_cleanup_metrics', {
				reason,
				scanned,
				removedCorrupted,
				removedExpired,
				removedTotal: staleKeys.length,
				retentionDays: LOCAL_DRAFT_RETENTION_DAYS,
			});
		},
		[emitDraftTelemetry]
	);

	useEffect(() => {
		if (draftCleanupInitializedRef.current) {
			return;
		}
		draftCleanupInitializedRef.current = true;
		runLocalDraftCleanup('startup');
	}, [runLocalDraftCleanup]);

	useEffect(() => {
		const intervalId = window.setInterval(
			() => {
				runLocalDraftCleanup('interval');
			},
			10 * 60 * 1000
		);
		return () => {
			window.clearInterval(intervalId);
		};
	}, [runLocalDraftCleanup]);

	useEffect(() => {
		void draftDocumentKey;
		setDraftConflict(null);
		lastConflictSignatureRef.current = null;
		becameDirtyForCurrentDocRef.current = false;
		serverDraftVersionRef.current = null;
		serverDraftOpGenerationRef.current += 1;
		abortInFlightServerDraftPut();
	}, [draftDocumentKey, abortInFlightServerDraftPut]);

	useEffect(() => {
		return () => {
			abortInFlightServerDraftPut();
		};
	}, [abortInFlightServerDraftPut]);

	const syncLocalDraftIndicator = useCallback(() => {
		if (!serverDraftEnabledForDocument) {
			const stored = parseLocalEditorDraft(
				localStorage.getItem(localDraftStorageKey)
			);
			if (!stored) {
				setHasLocalDraftIndicator(false);
				setLocalDraftUpdatedAt(null);
				return;
			}

			const updatedAtMs = Date.parse(stored.updatedAt);
			if (
				!Number.isFinite(updatedAtMs) ||
				Date.now() - updatedAtMs > LOCAL_DRAFT_MAX_AGE_MS
			) {
				localStorage.removeItem(localDraftStorageKey);
				setHasLocalDraftIndicator(false);
				setLocalDraftUpdatedAt(null);
				return;
			}

			const savedHtml = normalizeContentToHtml(
				editorInitialContent || '<p></p>'
			);
			const draftHtml = normalizeContentToHtml(stored.content || '<p></p>');
			if (savedHtml === draftHtml) {
				localStorage.removeItem(localDraftStorageKey);
				setHasLocalDraftIndicator(false);
				setLocalDraftUpdatedAt(null);
				return;
			}

			setHasLocalDraftIndicator(true);
			setLocalDraftUpdatedAt(stored.updatedAt);
			return;
		}

		const documentIdValue = currentDocument?.id;
		if (
			!documentIdValue ||
			documentIdValue === 'temp' ||
			serverDraftSyncingRef.current
		) {
			return;
		}
		serverDraftSyncingRef.current = true;
		void fetchServerDraft(documentIdValue)
			.then((draft) => {
				if (!draft) {
					serverDraftVersionRef.current = null;
					setHasLocalDraftIndicator(false);
					setLocalDraftUpdatedAt(null);
					return;
				}
				serverDraftVersionRef.current = draft.draftVersion ?? null;
				const savedHtml = normalizeContentToHtml(
					editorInitialContent || '<p></p>'
				);
				const draftHtml = normalizeContentToHtml(draft.content || '<p></p>');
				if (savedHtml === draftHtml) {
					setHasLocalDraftIndicator(false);
					setLocalDraftUpdatedAt(null);
					return;
				}
				setHasLocalDraftIndicator(true);
				setLocalDraftUpdatedAt(draft.updatedAt ?? null);
			})
			.catch((error) => {
				log.warn(
					'UltimateDocEditor',
					'Failed to sync server draft indicator',
					error
				);
			})
			.finally(() => {
				serverDraftSyncingRef.current = false;
			});
	}, [
		currentDocument?.id,
		editorInitialContent,
		localDraftStorageKey,
		serverDraftEnabledForDocument,
	]);

	useEffect(() => {
		if (!isDirty || !currentDocument) {
			return;
		}

		const scheduledGeneration = serverDraftOpGenerationRef.current;

		const timeoutId = window.setTimeout(() => {
			if (scheduledGeneration !== serverDraftOpGenerationRef.current) {
				return;
			}
			if (
				serverDraftEnabledForDocument &&
				currentDocument.id &&
				currentDocument.id !== 'temp'
			) {
				const documentId = currentDocument.id;
				abortInFlightServerDraftPut();
				const ac = new AbortController();
				serverDraftAbortRef.current = ac;
				void persistServerDraftWithConflictRecovery(
					documentId,
					{
						content: currentDocument.content || '<p></p>',
						baseDocumentVersion:
							currentDocument.version ?? currentDocument.version_number ?? 0,
						expectedDraftVersion: serverDraftVersionRef.current,
						sourceSessionId: localDraftSessionId,
					},
					{ signal: ac.signal }
				)
					.then((serverDraft) => {
						if (scheduledGeneration !== serverDraftOpGenerationRef.current) {
							return;
						}
						if (!serverDraft) {
							return;
						}
						serverDraftVersionRef.current = serverDraft.draftVersion ?? null;
						setHasLocalDraftIndicator(true);
						setLocalDraftUpdatedAt(
							serverDraft.updatedAt ?? new Date().toISOString()
						);
						if (draftConflict) {
							setDraftConflict(null);
						}
						emitDraftTelemetry('draft_saved_local', {
							provider: 'server',
							revision: serverDraft.draftVersion ?? 0,
							updatedAt: serverDraft.updatedAt,
							sourceSessionId: localDraftSessionId,
						});
					})
					.catch((error) => {
						if (scheduledGeneration !== serverDraftOpGenerationRef.current) {
							return;
						}
						if (isRequestAborted(error)) {
							return;
						}
						log.warn(
							'UltimateDocEditor',
							'Failed to persist server draft',
							error
						);
					})
					.finally(() => {
						if (serverDraftAbortRef.current === ac) {
							serverDraftAbortRef.current = null;
						}
					});
				return;
			}
			try {
				const previousDraft = parseLocalEditorDraft(
					localStorage.getItem(localDraftStorageKey)
				);
				const nextRevision = Math.max(previousDraft?.revision ?? 0, 0) + 1;
				const draftPayload: LocalEditorDraft = {
					content: currentDocument.content || '<p></p>',
					updatedAt: new Date().toISOString(),
					title: currentDocument.title,
					sourceSessionId: localDraftSessionId,
					revision: nextRevision,
				};
				localStorage.setItem(
					localDraftStorageKey,
					JSON.stringify(draftPayload)
				);
				setHasLocalDraftIndicator(true);
				setLocalDraftUpdatedAt(draftPayload.updatedAt);
				if (draftConflict) {
					setDraftConflict(null);
				}
				emitDraftTelemetry('draft_saved_local', {
					revision: draftPayload.revision ?? 0,
					updatedAt: draftPayload.updatedAt,
					sourceSessionId: localDraftSessionId,
				});
			} catch (error) {
				log.warn('UltimateDocEditor', 'Failed to persist local draft', error);
			}
		}, DOC_EDITOR_DRAFT_DEBOUNCE_MS);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [
		currentDocument,
		draftConflict,
		emitDraftTelemetry,
		isDirty,
		localDraftSessionId,
		localDraftStorageKey,
		serverDraftEnabledForDocument,
		abortInFlightServerDraftPut,
	]);

	useEffect(() => {
		if (isDirty) {
			becameDirtyForCurrentDocRef.current = true;
			return;
		}

		if (!becameDirtyForCurrentDocRef.current) {
			return;
		}

		becameDirtyForCurrentDocRef.current = false;
		serverDraftOpGenerationRef.current += 1;
		abortInFlightServerDraftPut();
		serverDraftVersionRef.current = null;
		if (
			serverDraftEnabledForDocument &&
			currentDocument?.id &&
			currentDocument.id !== 'temp'
		) {
			void discardServerDraft(currentDocument.id)
				.catch((error) => {
					log.warn(
						'UltimateDocEditor',
						'Failed to clear server draft after save',
						error
					);
				})
				.finally(() => {
					setHasLocalDraftIndicator(false);
					setLocalDraftUpdatedAt(null);
				});
			return;
		}
		try {
			localStorage.removeItem(localDraftStorageKey);
			setHasLocalDraftIndicator(false);
			setLocalDraftUpdatedAt(null);
		} catch (error) {
			log.warn(
				'UltimateDocEditor',
				'Failed to clear local draft after save',
				error
			);
		}
	}, [
		currentDocument?.id,
		isDirty,
		localDraftStorageKey,
		serverDraftEnabledForDocument,
		abortInFlightServerDraftPut,
	]);

	useEffect(() => {
		syncLocalDraftIndicator();
	}, [syncLocalDraftIndicator]);

	useEffect(() => {
		const onStorage = (event: StorageEvent): void => {
			if (event.storageArea !== localStorage) {
				return;
			}
			if (event.key !== localDraftStorageKey) {
				return;
			}
			const incomingDraft = parseLocalEditorDraft(event.newValue);
			if (
				incomingDraft?.sourceSessionId &&
				incomingDraft.sourceSessionId !== localDraftSessionId &&
				isDirty
			) {
				const conflictSignature = `${incomingDraft.sourceSessionId}:${incomingDraft.revision ?? 0}:${incomingDraft.updatedAt}`;
				setDraftConflict({
					incomingUpdatedAt: incomingDraft.updatedAt,
					incomingSessionId: incomingDraft.sourceSessionId,
					incomingRevision: incomingDraft.revision ?? 0,
					detectedAt: new Date().toISOString(),
				});
				if (lastConflictSignatureRef.current !== conflictSignature) {
					lastConflictSignatureRef.current = conflictSignature;
					emitDraftTelemetry('draft_conflict_detected', {
						incomingUpdatedAt: incomingDraft.updatedAt,
						incomingRevision: incomingDraft.revision ?? 0,
						incomingSessionId: incomingDraft.sourceSessionId,
						via: 'storage_event',
					});
				}
			}
			syncLocalDraftIndicator();
		};

		window.addEventListener('storage', onStorage);
		return () => {
			window.removeEventListener('storage', onStorage);
		};
	}, [
		emitDraftTelemetry,
		isDirty,
		localDraftSessionId,
		localDraftStorageKey,
		syncLocalDraftIndicator,
	]);

	useEffect(() => {
		if (
			isLoadingDocument ||
			isDirty ||
			draftRecoveryOpen ||
			dismissedDraftKeysRef.current.has(localDraftStorageKey)
		) {
			return;
		}
		if (
			serverDraftEnabledForDocument &&
			currentDocument?.id &&
			currentDocument.id !== 'temp'
		) {
			void fetchServerDraft(currentDocument.id)
				.then((stored) => {
					if (!stored) {
						return;
					}
					const savedHtml = normalizeContentToHtml(
						editorInitialContent || '<p></p>'
					);
					const draftHtml = normalizeContentToHtml(stored.content || '<p></p>');
					if (savedHtml === draftHtml) {
						return;
					}
					const normalizedDraft: LocalEditorDraft = {
						content: stored.content || '<p></p>',
						updatedAt: stored.updatedAt || new Date().toISOString(),
						title: currentDocument.title,
						sourceSessionId: stored.sourceSessionId,
						revision: stored.draftVersion,
						provider: 'server',
						draftVersion: stored.draftVersion,
						baseDocumentVersion: stored.baseDocumentVersion,
					};
					serverDraftVersionRef.current = stored.draftVersion ?? null;
					setPendingDraft(normalizedDraft);
					setDraftRecoveryOpen(true);
					setDraftRecoverySource('auto');
					setHasLocalDraftIndicator(true);
					setLocalDraftUpdatedAt(normalizedDraft.updatedAt);
					emitDraftTelemetry('draft_recovery_opened', {
						source: 'auto',
						provider: 'server',
						draftUpdatedAt: normalizedDraft.updatedAt,
						draftRevision: normalizedDraft.revision ?? 0,
						draftSourceSessionId: normalizedDraft.sourceSessionId ?? null,
					});
				})
				.catch((error) => {
					log.warn(
						'UltimateDocEditor',
						'Failed to auto-load server draft',
						error
					);
				});
			return;
		}

		let stored: LocalEditorDraft | null = null;
		try {
			stored = parseLocalEditorDraft(
				localStorage.getItem(localDraftStorageKey)
			);
		} catch {
			stored = null;
		}

		if (!stored) {
			return;
		}

		const updatedAtMs = Date.parse(stored.updatedAt);
		if (
			!Number.isFinite(updatedAtMs) ||
			Date.now() - updatedAtMs > LOCAL_DRAFT_MAX_AGE_MS
		) {
			localStorage.removeItem(localDraftStorageKey);
			setHasLocalDraftIndicator(false);
			setLocalDraftUpdatedAt(null);
			return;
		}

		const savedHtml = normalizeContentToHtml(editorInitialContent || '<p></p>');
		const draftHtml = normalizeContentToHtml(stored.content || '<p></p>');

		if (savedHtml === draftHtml) {
			localStorage.removeItem(localDraftStorageKey);
			setHasLocalDraftIndicator(false);
			setLocalDraftUpdatedAt(null);
			return;
		}

		setPendingDraft(stored);
		setDraftRecoveryOpen(true);
		setDraftRecoverySource('auto');
		setHasLocalDraftIndicator(true);
		setLocalDraftUpdatedAt(stored.updatedAt);
		emitDraftTelemetry('draft_recovery_opened', {
			source: 'auto',
			draftUpdatedAt: stored.updatedAt,
			draftRevision: stored.revision ?? 0,
			draftSourceSessionId: stored.sourceSessionId ?? null,
		});
		if (
			stored.sourceSessionId &&
			stored.sourceSessionId !== localDraftSessionId
		) {
			setDraftConflict({
				incomingUpdatedAt: stored.updatedAt,
				incomingSessionId: stored.sourceSessionId,
				incomingRevision: stored.revision ?? 0,
				detectedAt: new Date().toISOString(),
			});
		}
	}, [
		currentDocument?.id,
		currentDocument?.title,
		draftRecoveryOpen,
		editorInitialContent,
		emitDraftTelemetry,
		isDirty,
		isLoadingDocument,
		localDraftSessionId,
		localDraftStorageKey,
		serverDraftEnabledForDocument,
	]);

	const handleRestoreLocalDraft = useCallback(() => {
		if (!pendingDraft) {
			return;
		}

		const restoredHtml = normalizeContentToHtml(
			pendingDraft.content || '<p></p>'
		);
		setDraftRecoveryOpen(false);
		setDraftRecoverySource(null);
		setPendingDraft(null);
		setDraftConflict(null);
		lastConflictSignatureRef.current = null;
		setMarkdownMode(false);
		setMarkdownSource('');
		setMarkdownEdited(false);
		setRenderedMarkdownPreview('<p></p>');
		markdownOriginalHtmlRef.current = '';
		markdownBaselineRef.current = '';
		updateStats(restoredHtml);
		if (tiptapEditor) {
			programmaticUpdateRef.current = true;
			tiptapEditor.commands.setContent(restoredHtml, { emitUpdate: false });
		}
		editorStoreApi.setState({ isDirty: true });
		emitDraftTelemetry('draft_restored', {
			source: draftRecoverySource ?? 'unknown',
			draftUpdatedAt: pendingDraft.updatedAt,
			draftRevision: pendingDraft.revision ?? 0,
			hadConflict: Boolean(draftConflict),
		});
	}, [
		draftConflict,
		draftRecoverySource,
		emitDraftTelemetry,
		pendingDraft,
		tiptapEditor,
		updateStats,
		editorStoreApi.setState,
		setMarkdownMode,
		setMarkdownSource,
		setMarkdownEdited,
		setRenderedMarkdownPreview,
		markdownOriginalHtmlRef,
		markdownBaselineRef,
		programmaticUpdateRef,
	]);

	const handleSkipDraftRecovery = useCallback(() => {
		emitDraftTelemetry('draft_recovery_skipped', {
			source: draftRecoverySource ?? 'unknown',
			hadConflict: Boolean(draftConflict),
		});
		dismissedDraftKeysRef.current.add(localDraftStorageKey);
		setDraftRecoveryOpen(false);
		setDraftRecoverySource(null);
		setPendingDraft(null);
		setDraftConflict(null);
		lastConflictSignatureRef.current = null;
	}, [
		draftConflict,
		draftRecoverySource,
		emitDraftTelemetry,
		localDraftStorageKey,
	]);

	const handleDiscardLocalDraft = useCallback(() => {
		emitDraftTelemetry('draft_discarded', {
			source: draftRecoverySource ?? 'unknown',
			hadConflict: Boolean(draftConflict),
		});
		if (
			pendingDraft?.provider === 'server' &&
			currentDocument?.id &&
			currentDocument.id !== 'temp'
		) {
			void discardServerDraft(currentDocument.id)
				.catch((error) => {
					log.warn(
						'UltimateDocEditor',
						'Failed to discard server draft',
						error
					);
				})
				.finally(() => {
					serverDraftVersionRef.current = null;
					setHasLocalDraftIndicator(false);
					setLocalDraftUpdatedAt(null);
				});
		} else {
			try {
				localStorage.removeItem(localDraftStorageKey);
				setHasLocalDraftIndicator(false);
				setLocalDraftUpdatedAt(null);
			} catch (error) {
				log.warn('UltimateDocEditor', 'Failed to discard local draft', error);
			}
		}
		dismissedDraftKeysRef.current.add(localDraftStorageKey);
		setDraftRecoveryOpen(false);
		setDraftRecoverySource(null);
		setPendingDraft(null);
		setDraftConflict(null);
		lastConflictSignatureRef.current = null;
	}, [
		currentDocument?.id,
		draftConflict,
		draftRecoverySource,
		emitDraftTelemetry,
		localDraftStorageKey,
		pendingDraft?.provider,
	]);

	const handleOpenLocalDraftRecovery = useCallback(() => {
		if (
			serverDraftEnabledForDocument &&
			currentDocument?.id &&
			currentDocument.id !== 'temp'
		) {
			void fetchServerDraft(currentDocument.id)
				.then((stored) => {
					if (!stored) {
						syncLocalDraftIndicator();
						return;
					}
					const savedHtml = normalizeContentToHtml(
						editorInitialContent || '<p></p>'
					);
					const draftHtml = normalizeContentToHtml(stored.content || '<p></p>');
					if (savedHtml === draftHtml) {
						syncLocalDraftIndicator();
						return;
					}
					dismissedDraftKeysRef.current.delete(localDraftStorageKey);
					const normalizedDraft: LocalEditorDraft = {
						content: stored.content || '<p></p>',
						updatedAt: stored.updatedAt || new Date().toISOString(),
						title: currentDocument.title,
						sourceSessionId: stored.sourceSessionId,
						revision: stored.draftVersion,
						provider: 'server',
						draftVersion: stored.draftVersion,
						baseDocumentVersion: stored.baseDocumentVersion,
					};
					serverDraftVersionRef.current = stored.draftVersion ?? null;
					setPendingDraft(normalizedDraft);
					setDraftRecoveryOpen(true);
					setDraftRecoverySource('manual');
					setHasLocalDraftIndicator(true);
					setLocalDraftUpdatedAt(normalizedDraft.updatedAt);
					emitDraftTelemetry('draft_recovery_opened', {
						source: 'manual',
						provider: 'server',
						draftUpdatedAt: normalizedDraft.updatedAt,
						draftRevision: normalizedDraft.revision ?? 0,
						draftSourceSessionId: normalizedDraft.sourceSessionId ?? null,
					});
				})
				.catch((error) => {
					log.warn(
						'UltimateDocEditor',
						'Failed to open server draft recovery',
						error
					);
				});
			return;
		}
		const stored = parseLocalEditorDraft(
			localStorage.getItem(localDraftStorageKey)
		);
		if (!stored) {
			syncLocalDraftIndicator();
			return;
		}

		const updatedAtMs = Date.parse(stored.updatedAt);
		if (
			!Number.isFinite(updatedAtMs) ||
			Date.now() - updatedAtMs > LOCAL_DRAFT_MAX_AGE_MS
		) {
			localStorage.removeItem(localDraftStorageKey);
			syncLocalDraftIndicator();
			return;
		}

		const savedHtml = normalizeContentToHtml(editorInitialContent || '<p></p>');
		const draftHtml = normalizeContentToHtml(stored.content || '<p></p>');
		if (savedHtml === draftHtml) {
			localStorage.removeItem(localDraftStorageKey);
			syncLocalDraftIndicator();
			return;
		}

		dismissedDraftKeysRef.current.delete(localDraftStorageKey);
		setPendingDraft(stored);
		setDraftRecoveryOpen(true);
		setDraftRecoverySource('manual');
		setHasLocalDraftIndicator(true);
		setLocalDraftUpdatedAt(stored.updatedAt);
		emitDraftTelemetry('draft_recovery_opened', {
			source: 'manual',
			draftUpdatedAt: stored.updatedAt,
			draftRevision: stored.revision ?? 0,
			draftSourceSessionId: stored.sourceSessionId ?? null,
		});
		if (
			stored.sourceSessionId &&
			stored.sourceSessionId !== localDraftSessionId
		) {
			setDraftConflict({
				incomingUpdatedAt: stored.updatedAt,
				incomingSessionId: stored.sourceSessionId,
				incomingRevision: stored.revision ?? 0,
				detectedAt: new Date().toISOString(),
			});
		} else {
			setDraftConflict(null);
		}
	}, [
		currentDocument?.id,
		currentDocument?.title,
		editorInitialContent,
		emitDraftTelemetry,
		localDraftSessionId,
		localDraftStorageKey,
		serverDraftEnabledForDocument,
		syncLocalDraftIndicator,
	]);

	const localDraftTooltip = useMemo(() => {
		if (!hasLocalDraftIndicator || !localDraftUpdatedAt) {
			return null;
		}
		if (draftConflict) {
			return `Конфликт черновика: входящие изменения ${new Date(draftConflict.incomingUpdatedAt).toLocaleString('ru-RU')}`;
		}
		return `Черновик: ${new Date(localDraftUpdatedAt).toLocaleString('ru-RU')}`;
	}, [draftConflict, hasLocalDraftIndicator, localDraftUpdatedAt]);

	return {
		draftRecoveryOpen,
		draftRecoverySource,
		pendingDraft,
		draftConflict,
		hasLocalDraftIndicator,
		localDraftUpdatedAt,
		localDraftStorageKey,
		localDraftTooltip,
		handleRestoreLocalDraft,
		handleSkipDraftRecovery,
		handleDiscardLocalDraft,
		handleOpenLocalDraftRecovery,
	};
}
