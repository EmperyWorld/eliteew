/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * State, effects, and handlers for companion embedded document editor mode.
 *
 * Invariants:
 * - AI suggestions do not mutate text until Replace/Append.
 * - Saving uses UC replace-file with DocEditor fallback; server+local drafts recoverable.
 * - Document structure UI consumes backend offsets only.
 * - Transform requests carry companion persona metadata, never chat transcript.
 *
 * Related:
 * - CompanionDocumentEditorModeView.tsx
 * - documentation/product/ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';

import {
	markDocumentDiscussHintSeen,
	shouldShowDocumentDiscussHint,
} from '@/features/ewa/companionOutputSurface/companionDocumentEditorSessionHints';
import {
	applyDocumentSurfaceReplacement,
	buildDocumentSurfacePrompt,
	coerceCompanionDocumentSurfacePayload,
	selectedTextRange,
	type TextSelectionRange,
} from '@/features/ewa/companionOutputSurface/companionDocumentSurfaceUi';
import {
	clearCompanionDocumentSurfaceDraft,
	companionDocumentDraftScopeId,
	loadCompanionDocumentSurfaceDraft,
	saveCompanionDocumentSurfaceDraft,
	type CompanionDocumentSurfaceDraftSnapshot,
} from '@/features/ewa/companionOutputSurface/companionDocumentSurfaceDraftState';
import { useCompanionDocumentSaveConflict } from '@/features/ewa/companionOutputSurface/useCompanionDocumentSaveConflict';
import { useCompanionDocumentServerDraftSync } from '@/features/ewa/companionOutputSurface/useCompanionDocumentServerDraftSync';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
	deleteEwaCompanionDocumentServerDraft,
	EwaCompanionDocumentSaveConflictError,
	checkEwaCompanionDocumentPreInsert,
	fetchEwaCompanionDocumentStructure,
	fetchEwaCompanionDocumentServerDraft,
	fetchEwaCompanionSurfaceDocument,
	saveEwaCompanionSurfaceDocument,
	streamEwaCompanionDocumentAiTransform,
	type EwaCompanionDocumentStructure,
	type EwaCompanionDocumentStructureSection,
	type EwaCompanionSurfaceDocument,
} from '@/services/ewa/ewaCompanionDocumentSurfaceApi';
import { applyDocumentStructureSelection } from '@/features/ewa/companionOutputSurface/CompanionDocumentStructurePanel';

import {
	STRUCTURE_AUTO_BUILD_DEBOUNCE_MS,
	actionModeFor,
	markdownFromDocumentRow,
	recoverableSnapshotFromServerDraft,
	resolveCompanionDisplayName,
	resolveCompanionTransformEnvelope,
} from './helpers';
import type {
	CompanionDocumentEditorModeProps,
	PersistedDocumentSnapshot,
	QuickAction,
	RecoverableDraftSource,
} from './types';

export function useCompanionDocumentEditorMode({
	payload,
	companionProfile,
	companionPrincipalId = '',
	externalActionsHost,
	onBackToChat,
	onDraftPrompt,
}: CompanionDocumentEditorModeProps) {
	const { t, i18n } = useTranslation('marketing');
	const ru = i18n.language.startsWith('ru');
	const desktopRailVisible = useMediaQuery('(min-width: 1024px)');
	const effectiveActionsHost = desktopRailVisible ? externalActionsHost : null;
	const surfacePayload = useMemo(
		() => coerceCompanionDocumentSurfacePayload(payload),
		[payload]
	);
	const companionTransformEnvelope = useMemo(
		() => resolveCompanionTransformEnvelope(companionProfile),
		[companionProfile]
	);
	const companionDisplayName = useMemo(
		() =>
			resolveCompanionDisplayName({
				companionProfile,
				transformPersonaName: companionTransformEnvelope.companionPersona?.name,
				ru,
			}),
		[companionProfile, companionTransformEnvelope.companionPersona?.name, ru]
	);
	const initialSnapshot = useMemo<PersistedDocumentSnapshot>(
		() => ({
			title: surfacePayload.title,
			markdown: surfacePayload.initialMarkdown,
			version: null,
		}),
		[surfacePayload.initialMarkdown, surfacePayload.title]
	);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const abortRef = useRef<AbortController | null>(null);
	const structureAutoBuildRef = useRef<number | null>(null);
	const structureAutoBuiltDocIdRef = useRef<string | null>(null);
	const [documentRow, setDocumentRow] =
		useState<EwaCompanionSurfaceDocument | null>(null);
	const [title, setTitle] = useState(surfacePayload.title);
	const [markdown, setMarkdown] = useState(surfacePayload.initialMarkdown);
	const [baseSnapshot, setBaseSnapshot] =
		useState<PersistedDocumentSnapshot>(initialSnapshot);
	const [selection, setSelection] = useState<TextSelectionRange | null>(null);
	const [prompt, setPrompt] = useState('');
	const [aiResult, setAiResult] = useState('');
	const [loading, setLoading] = useState(false);
	const [aiBusy, setAiBusy] = useState(false);
	const [policyBusy, setPolicyBusy] = useState(false);
	const [policyWarnings, setPolicyWarnings] = useState<string[]>([]);
	const [documentStructure, setDocumentStructure] =
		useState<EwaCompanionDocumentStructure | null>(null);
	const [documentStructureLoading, setDocumentStructureLoading] =
		useState(false);
	const [documentStructureError, setDocumentStructureError] = useState<
		string | null
	>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [recoverableDraft, setRecoverableDraft] =
		useState<CompanionDocumentSurfaceDraftSnapshot | null>(null);
	const [recoverableDraftSource, setRecoverableDraftSource] =
		useState<RecoverableDraftSource | null>(null);
	const [alternateRecoverableDraft, setAlternateRecoverableDraft] =
		useState<CompanionDocumentSurfaceDraftSnapshot | null>(null);
	const [alternateRecoverableSource, setAlternateRecoverableSource] =
		useState<RecoverableDraftSource | null>(null);
	const [draftCompareOpen, setDraftCompareOpen] = useState(false);
	const [footerDetailsOpen, setFooterDetailsOpen] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [structurePanelOpen, setStructurePanelOpen] = useState(false);
	const [showDiscussHint, setShowDiscussHint] = useState(() =>
		shouldShowDocumentDiscussHint(companionPrincipalId)
	);
	const [policyBlocked, setPolicyBlocked] = useState(false);
	const { saveConflict, setSaveConflict, clearSaveConflict } =
		useCompanionDocumentSaveConflict();
	const draftScopeId = useMemo(
		() =>
			companionDocumentDraftScopeId({
				documentId: surfacePayload.documentId,
				title: documentRow?.title || surfacePayload.title,
			}),
		[surfacePayload.documentId, surfacePayload.title, documentRow?.title]
	);
	const hasUnsavedChanges = useMemo(
		() => title !== baseSnapshot.title || markdown !== baseSnapshot.markdown,
		[baseSnapshot.markdown, baseSnapshot.title, markdown, title]
	);
	const {
		serverDraft,
		setServerDraft,
		serverDraftSyncError,
		setServerDraftSyncError,
		serverDraftSyncHint,
		serverDraftSyncActionVisible,
		serverDraftSyncActionDisabled,
		serverDraftSyncActionLabel,
		runServerDraftSyncNow,
		resetSyncBaseline,
		resetSyncRuntime,
		offlineDraftOnly,
	} = useCompanionDocumentServerDraftSync({
		documentId: surfacePayload.documentId,
		canSave: documentRow?.canSave,
		hasUnsavedChanges,
		loading,
		saving,
		markdown,
		baseVersion: baseSnapshot.version,
		t,
	});
	const recoverableDraftTime = useMemo(() => {
		if (!recoverableDraft) return '';
		const parsed = new Date(recoverableDraft.updatedAt);
		if (Number.isNaN(parsed.getTime())) return recoverableDraft.updatedAt;
		return parsed.toLocaleString(i18n.language || undefined);
	}, [i18n.language, recoverableDraft]);

	useEffect(() => {
		const nextSnapshot: PersistedDocumentSnapshot = {
			title: surfacePayload.title,
			markdown: surfacePayload.initialMarkdown,
			version: null,
		};
		resetSyncBaseline(nextSnapshot.markdown, nextSnapshot.version);
		setTitle(nextSnapshot.title);
		setMarkdown(nextSnapshot.markdown);
		setBaseSnapshot(nextSnapshot);
		setDocumentRow(null);
		setDocumentStructure(null);
		setDocumentStructureError(null);
		setDocumentStructureLoading(false);
		setStructurePanelOpen(false);
		setSelection(null);
		setAiResult('');
		setPolicyWarnings([]);
		setPolicyBlocked(false);
		setPrompt('');
		setRecoverableDraft(null);
		setRecoverableDraftSource(null);
		setAlternateRecoverableDraft(null);
		setAlternateRecoverableSource(null);
		setDraftCompareOpen(false);
		structureAutoBuiltDocIdRef.current = null;
		setServerDraft(null);
		resetSyncRuntime();
		clearSaveConflict();
		setError(null);
		setSaved(false);
		setShowDiscussHint(shouldShowDocumentDiscussHint(companionPrincipalId));
		const initialScope = companionDocumentDraftScopeId({
			documentId: surfacePayload.documentId,
			title: nextSnapshot.title,
		});
		const localRecoverableDraft = initialScope
			? loadCompanionDocumentSurfaceDraft(initialScope)
			: null;
		const localRecoverableSnapshot =
			localRecoverableDraft?.markdown.trim() &&
			localRecoverableDraft.markdown !== nextSnapshot.markdown
				? localRecoverableDraft
				: null;
		if (localRecoverableSnapshot) {
			setRecoverableDraft(localRecoverableSnapshot);
			setRecoverableDraftSource('local');
		}
		const id = surfacePayload.documentId;
		if (!id) return;
		let alive = true;
		setLoading(true);
		void fetchEwaCompanionSurfaceDocument(id)
			.then(async (doc) => {
				if (!alive) return;
				const nextMarkdown = markdownFromDocumentRow(
					doc,
					nextSnapshot.markdown
				);
				const snapshot: PersistedDocumentSnapshot = {
					title: doc.title,
					markdown: nextMarkdown,
					version: doc.version,
				};
				setDocumentRow(doc);
				setTitle(snapshot.title);
				setMarkdown(snapshot.markdown);
				setBaseSnapshot(snapshot);
				resetSyncBaseline(snapshot.markdown, snapshot.version);
				const serverScope =
					companionDocumentDraftScopeId({
						documentId: doc.id || id,
						title: doc.title,
					}) || initialScope;
				const localServerScopeDraft = serverScope
					? loadCompanionDocumentSurfaceDraft(serverScope)
					: null;
				const localServerScopeRecoverable =
					localServerScopeDraft?.markdown.trim() &&
					localServerScopeDraft.markdown !== snapshot.markdown
						? localServerScopeDraft
						: null;
				const localCandidate =
					localServerScopeRecoverable || localRecoverableSnapshot;
				let resolvedRecoverableDraft = localCandidate;
				let resolvedRecoverableSource: RecoverableDraftSource | null =
					localCandidate ? 'local' : null;
				let resolvedAlternateDraft: CompanionDocumentSurfaceDraftSnapshot | null =
					null;
				let resolvedAlternateSource: RecoverableDraftSource | null = null;
				try {
					const remoteDraft = await fetchEwaCompanionDocumentServerDraft(
						doc.id || id
					);
					if (!alive) return;
					setServerDraft(remoteDraft);
					if (
						remoteDraft?.content.trim() &&
						remoteDraft.content !== snapshot.markdown
					) {
						const serverSnapshot = recoverableSnapshotFromServerDraft(
							remoteDraft,
							doc.title
						);
						if (localCandidate) {
							resolvedAlternateDraft = localCandidate;
							resolvedAlternateSource = 'local';
						}
						resolvedRecoverableDraft = serverSnapshot;
						resolvedRecoverableSource = 'server';
					}
				} catch (err) {
					if (!alive) return;
					ewaCompanionDegradeDebug(
						'document_server_draft_recover_probe',
						'server draft recoverability probe failed',
						err
					);
				}
				if (resolvedRecoverableDraft && resolvedRecoverableSource) {
					setRecoverableDraft(resolvedRecoverableDraft);
					setRecoverableDraftSource(resolvedRecoverableSource);
					setAlternateRecoverableDraft(resolvedAlternateDraft);
					setAlternateRecoverableSource(resolvedAlternateSource);
				} else {
					setRecoverableDraft(null);
					setRecoverableDraftSource(null);
					setAlternateRecoverableDraft(null);
					setAlternateRecoverableSource(null);
				}
			})
			.catch((err) => {
				if (!alive) return;
				setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => {
				if (alive) setLoading(false);
			});
		return () => {
			alive = false;
		};
	}, [
		surfacePayload,
		companionPrincipalId,
		clearSaveConflict,
		resetSyncBaseline,
		resetSyncRuntime,
		setServerDraft,
	]);

	useEffect(() => {
		if (!draftScopeId) return;
		if (!hasUnsavedChanges) {
			if (!recoverableDraft || recoverableDraftSource !== 'local') {
				clearCompanionDocumentSurfaceDraft(draftScopeId);
			}
			return;
		}
		saveCompanionDocumentSurfaceDraft(draftScopeId, {
			title,
			markdown,
			baseVersion: baseSnapshot.version,
		});
	}, [
		baseSnapshot.version,
		draftScopeId,
		hasUnsavedChanges,
		markdown,
		recoverableDraft,
		recoverableDraftSource,
		title,
	]);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
			if (
				typeof window !== 'undefined' &&
				structureAutoBuildRef.current != null
			) {
				window.clearTimeout(structureAutoBuildRef.current);
				structureAutoBuildRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined' || !hasUnsavedChanges) return;
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload);
		};
	}, [hasUnsavedChanges]);

	const handleBackToChat = () => {
		if (!hasUnsavedChanges || typeof window === 'undefined') {
			onBackToChat();
			return;
		}
		if (window.confirm(t('ewaCompanion.documentSurfaceUnsavedLeaveConfirm'))) {
			onBackToChat();
		}
	};

	const restoreRecoverableDraft = () => {
		if (!recoverableDraft) return;
		setMarkdown(recoverableDraft.markdown);
		if (recoverableDraft.title.trim()) {
			setTitle(recoverableDraft.title.trim());
		}
		if (recoverableDraftSource === 'server') {
			resetSyncBaseline(
				recoverableDraft.markdown,
				recoverableDraft.baseVersion ?? baseSnapshot.version
			);
		}
		setSelection(null);
		setSaved(false);
		setError(null);
		resetSyncRuntime();
		clearSaveConflict();
		setRecoverableDraft(null);
		setRecoverableDraftSource(null);
		setAlternateRecoverableDraft(null);
		setAlternateRecoverableSource(null);
		setDraftCompareOpen(false);
	};

	const discardRecoverableDraft = () => {
		if (recoverableDraftSource === 'server' && surfacePayload.documentId) {
			void deleteEwaCompanionDocumentServerDraft(surfacePayload.documentId)
				.then(() => {
					setServerDraft(null);
					setServerDraftSyncError(null);
				})
				.catch((err) => {
					ewaCompanionDegradeDebug(
						'document_server_draft_delete',
						'discard recoverable server draft failed',
						err
					);
				});
		}
		if (recoverableDraftSource !== 'server' && draftScopeId) {
			clearCompanionDocumentSurfaceDraft(draftScopeId);
		}
		setRecoverableDraft(null);
		setRecoverableDraftSource(null);
		setAlternateRecoverableDraft(null);
		setAlternateRecoverableSource(null);
		setDraftCompareOpen(false);
	};

	const syncSelection = () => {
		const node = textareaRef.current;
		if (!node) return;
		setSelection(
			selectedTextRange(markdown, node.selectionStart, node.selectionEnd)
		);
	};

	const loadDocumentStructure = useCallback(async () => {
		const id = surfacePayload.documentId;
		if (!id) return;
		setDocumentStructureLoading(true);
		setDocumentStructureError(null);
		try {
			const structure = await fetchEwaCompanionDocumentStructure(id);
			setDocumentStructure(structure);
			setStructurePanelOpen(false);
		} catch (err) {
			setDocumentStructureError(
				err instanceof Error
					? err.message
					: t('ewaCompanion.documentStructureLoadFailed')
			);
		} finally {
			setDocumentStructureLoading(false);
		}
	}, [surfacePayload.documentId, t]);

	useEffect(() => {
		if (!surfacePayload.documentId || !documentRow || loading) return;
		if (typeof window === 'undefined') return;
		if (structureAutoBuiltDocIdRef.current === surfacePayload.documentId) {
			return;
		}
		structureAutoBuiltDocIdRef.current = surfacePayload.documentId;
		if (structureAutoBuildRef.current != null) {
			window.clearTimeout(structureAutoBuildRef.current);
		}
		structureAutoBuildRef.current = window.setTimeout(() => {
			structureAutoBuildRef.current = null;
			void loadDocumentStructure();
		}, STRUCTURE_AUTO_BUILD_DEBOUNCE_MS);
		return () => {
			if (structureAutoBuildRef.current != null) {
				window.clearTimeout(structureAutoBuildRef.current);
				structureAutoBuildRef.current = null;
			}
		};
	}, [documentRow, loadDocumentStructure, loading, surfacePayload.documentId]);

	const selectDocumentStructureSection = (
		section: EwaCompanionDocumentStructureSection
	) => {
		const node = textareaRef.current;
		if (!node) return;
		applyDocumentStructureSelection(node, section);
		const start = node.selectionStart;
		const end = node.selectionEnd;
		flushSync(() => {
			setSelection(selectedTextRange(markdown, start, end));
		});
		const current = textareaRef.current;
		if (current) {
			applyDocumentStructureSelection(current, section);
		}
	};

	const stopAiTransform = () => {
		abortRef.current?.abort();
	};

	const runAi = async (action: QuickAction) => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		const context = selection?.text || markdown;
		if (!context.trim()) return;
		setAiBusy(true);
		setAiResult('');
		setPolicyWarnings([]);
		setSaveConflict(null);
		setError(null);
		try {
			await streamEwaCompanionDocumentAiTransform(
				{
					prompt: buildDocumentSurfacePrompt(action, prompt, ru),
					context,
					actionMode: actionModeFor(action),
					contextScope: selection ? 'selection' : 'document',
					documentId: surfacePayload.documentId,
					generationOptions: companionTransformEnvelope.generationOptions,
					companionPersona: companionTransformEnvelope.companionPersona,
					noDialogueOutput: true,
				},
				(chunk) => setAiResult((prev) => prev + chunk),
				controller.signal
			);
		} catch (err) {
			if (!(err instanceof DOMException && err.name === 'AbortError')) {
				setError(err instanceof Error ? err.message : String(err));
			}
		} finally {
			if (abortRef.current === controller) abortRef.current = null;
			setAiBusy(false);
		}
	};

	const applyAiResult = async (mode: 'replace' | 'append') => {
		const candidate = aiResult.trim();
		if (!candidate) return;
		setPolicyBusy(true);
		setPolicyWarnings([]);
		setSaveConflict(null);
		setError(null);
		try {
			const check = await checkEwaCompanionDocumentPreInsert({
				text: candidate,
				contextScope: selection ? 'selection' : 'document',
				documentId: surfacePayload.documentId,
			});
			if (!check.allowed) {
				setPolicyBlocked(true);
				setError(
					check.warnings.length > 0
						? `${t('ewaCompanion.documentSurfacePolicyBlocked')}: ${check.warnings.join(', ')}`
						: t('ewaCompanion.documentSurfacePolicyBlocked')
				);
				return;
			}
			setPolicyBlocked(false);
			setPolicyWarnings(check.warnings);
			setMarkdown((prev) =>
				mode === 'replace'
					? applyDocumentSurfaceReplacement(prev, selection, candidate)
					: `${prev.trimEnd()}\n\n${candidate}`
			);
			if (mode === 'replace') {
				setSelection(null);
			}
			setSaved(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setPolicyBusy(false);
		}
	};

	const saveDocument = async (forceSave = false) => {
		const id = surfacePayload.documentId;
		if (!id) return;
		if (documentRow?.canSave === false) return;
		setSaving(true);
		clearSaveConflict();
		setError(null);
		try {
			const savedDoc = await saveEwaCompanionSurfaceDocument(id, {
				content: markdown,
				expectedVersion: documentRow?.version,
				originalFilename: documentRow?.originalFilename,
				title,
				forceSave,
			});
			const nextMarkdown = markdownFromDocumentRow(savedDoc, markdown);
			setDocumentRow(savedDoc);
			setTitle(savedDoc.title);
			setMarkdown(nextMarkdown);
			setBaseSnapshot({
				title: savedDoc.title,
				markdown: nextMarkdown,
				version: savedDoc.version,
			});
			setSelection(null);
			setSaved(true);
			setRecoverableDraft(null);
			setRecoverableDraftSource(null);
			setAlternateRecoverableDraft(null);
			setAlternateRecoverableSource(null);
			resetSyncRuntime();
			resetSyncBaseline(nextMarkdown, savedDoc.version);
			if (draftScopeId) {
				clearCompanionDocumentSurfaceDraft(draftScopeId);
			}
			void deleteEwaCompanionDocumentServerDraft(savedDoc.id || id)
				.then(() => {
					setServerDraft(null);
				})
				.catch((err) => {
					ewaCompanionDegradeDebug(
						'document_server_draft_delete',
						'discard recoverable server draft failed',
						err
					);
				});
		} catch (err) {
			if (err instanceof EwaCompanionDocumentSaveConflictError) {
				setSaveConflict(err.conflict);
				setError(
					t('ewaCompanion.documentSurfaceVersionConflict', {
						expected: err.conflict.expectedVersion,
						current: err.conflict.currentVersion,
					})
				);
				return;
			}
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const restoreServerVersionFromConflict = () => {
		const serverDoc = saveConflict?.serverDocument;
		if (!serverDoc) return;
		const nextMarkdown = markdownFromDocumentRow(serverDoc, '');
		setDocumentRow(serverDoc);
		setTitle(serverDoc.title);
		setMarkdown(nextMarkdown);
		setBaseSnapshot({
			title: serverDoc.title,
			markdown: nextMarkdown,
			version: serverDoc.version,
		});
		setSelection(null);
		setSaved(false);
		setError(null);
		clearSaveConflict();
		setRecoverableDraft(null);
		setRecoverableDraftSource(null);
		setAlternateRecoverableDraft(null);
		setAlternateRecoverableSource(null);
		resetSyncRuntime();
		setServerDraft(null);
		resetSyncBaseline(nextMarkdown, serverDoc.version);
		if (draftScopeId) {
			clearCompanionDocumentSurfaceDraft(draftScopeId);
		}
		if (surfacePayload.documentId) {
			void deleteEwaCompanionDocumentServerDraft(
				surfacePayload.documentId
			).catch((err) => {
				ewaCompanionDegradeDebug(
					'document_server_draft_delete',
					'close surface server draft cleanup failed',
					err
				);
			});
		}
	};
	const parseWarnings =
		documentRow?.parseWarnings.length && documentRow.parseWarnings
			? documentRow.parseWarnings
			: surfacePayload.parseWarnings;
	const saveDisabled =
		!surfacePayload.documentId ||
		documentRow?.canSave === false ||
		saving ||
		loading;
	const transformActionDisabled =
		aiBusy || loading || !(selection?.text || markdown.trim());

	return {
		t,
		ru,
		effectiveActionsHost,
		surfacePayload,
		companionDisplayName,
		companionPrincipalId,
		onDraftPrompt,
		textareaRef,
		documentRow,
		title,
		setTitle,
		markdown,
		setMarkdown,
		baseSnapshot,
		selection,
		prompt,
		setPrompt,
		aiResult,
		loading,
		aiBusy,
		policyBusy,
		policyWarnings,
		documentStructure,
		documentStructureLoading,
		documentStructureError,
		saving,
		error,
		setError,
		saved,
		setSaved,
		recoverableDraft,
		recoverableDraftSource,
		alternateRecoverableDraft,
		alternateRecoverableSource,
		draftCompareOpen,
		setDraftCompareOpen,
		footerDetailsOpen,
		setFooterDetailsOpen,
		previewOpen,
		setPreviewOpen,
		structurePanelOpen,
		setStructurePanelOpen,
		showDiscussHint,
		setShowDiscussHint,
		policyBlocked,
		setPolicyBlocked,
		saveConflict,
		clearSaveConflict,
		hasUnsavedChanges,
		serverDraft,
		serverDraftSyncError,
		serverDraftSyncHint,
		serverDraftSyncActionVisible,
		serverDraftSyncActionDisabled,
		serverDraftSyncActionLabel,
		runServerDraftSyncNow,
		offlineDraftOnly,
		recoverableDraftTime,
		handleBackToChat,
		restoreRecoverableDraft,
		discardRecoverableDraft,
		syncSelection,
		loadDocumentStructure,
		selectDocumentStructureSection,
		stopAiTransform,
		runAi,
		applyAiResult,
		saveDocument,
		restoreServerVersionFromConflict,
		parseWarnings,
		saveDisabled,
		transformActionDisabled,
		markDocumentDiscussHintSeen,
	};
}

export type CompanionDocumentEditorModeViewModel = ReturnType<
	typeof useCompanionDocumentEditorMode
>;
