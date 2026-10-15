/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop-mountable Document Editor V2 entry component.
 * Adapts explicit launch payload into the isolated shell/core without replacing the legacy DocEditor app.
 *
 * Invariants:
 * - This component must never be used as the default `DocEditor` implementation.
 * - V2 create/save/draft calls use only `/api/v1/doc-editor-v2/*`; legacy editor APIs remain untouched.
 *
 * Related:
 * - src/features/documentEditorV2/DocEditorV2Shell.tsx
 * - documentation/product/DOCUMENT-EDITOR-V2.md
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PaperlessPickerPanel } from '@/components/Paperless/PaperlessPickerPanel';

import { DOC_EDITOR_V2_NS } from '@/i18n/namespaces';
import { telemetryDocEditorV2Action } from '@/pages/Desktop/utils/desktopTelemetry';
import {
	applyDocEditorV2EwaSuggestion,
	createDocEditorV2EwaSuggestion,
	createDocEditorV2Document,
	exportDocEditorV2Document,
	getDocEditorV2ConflictPayload,
	getDocEditorV2CollaborationState,
	getDocEditorV2Document,
	getDocEditorV2Structure,
	importDocEditorV2Document,
	putDocEditorV2Draft,
	updateDocEditorV2Document,
	type DocEditorV2CollaborationParticipant,
	type DocEditorV2DocumentResponse,
	type DocEditorV2SourceFormat,
	type DocEditorV2StructureItem,
	type DocEditorV2SuggestionResponse,
} from '@/services/documentEditorV2Api';
import {
	importPaperlessToDocEditorV2,
	type PaperlessDocumentItem,
} from '@/services/paperlessApi';

import { DocEditorV2Core } from './DocEditorV2Core';
import { DocEditorV2Shell } from './DocEditorV2Shell';
import {
	buildCreateRequest,
	buildDraftRequest,
	buildShellStateFromViewModel,
	buildUpdateRequest,
	documentToDraft,
	type DocEditorV2StateLabels,
	type DocEditorV2EditorDraft,
} from './docEditorV2State';
import { loadUnifiedContentForDocEditorV2 } from './docEditorV2UnifiedContentOpen';
import type { DocEditorV2SaveStatus } from './types';

function sourceFormatFromFile(file: File): DocEditorV2SourceFormat {
	const suffix = file.name.split('.').pop()?.toLowerCase() ?? '';
	if (suffix === 'md' || suffix === 'markdown') return 'markdown';
	if (suffix === 'html' || suffix === 'htm') return 'html';
	if (suffix === 'docx') return 'docx';
	if (suffix === 'doc') return 'doc';
	if (suffix === 'odt') return 'odt';
	if (suffix === 'rtf') return 'rtf';
	if (suffix === 'pdf') return 'pdf';
	return 'text';
}

function isTextLikeFormat(format: DocEditorV2SourceFormat): boolean {
	return format === 'markdown' || format === 'html' || format === 'text';
}

async function fileToBase64(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	let binary = '';
	for (const byte of new Uint8Array(buffer)) {
		binary += String.fromCharCode(byte);
	}
	return window.btoa(binary);
}

function downloadBase64File(
	filename: string,
	mimeType: string,
	contentBase64: string
) {
	const binary = window.atob(contentBase64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	const blob = new Blob([bytes], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

export interface DocEditorV2Props {
	initialDocumentId?: string | null;
	initialUnifiedContentId?: string | null;
	initialTitle?: string | null;
	onFallbackToLegacy?: () => void;
}

export function DocEditorV2({
	initialDocumentId,
	initialUnifiedContentId,
	initialTitle,
	onFallbackToLegacy,
}: DocEditorV2Props) {
	const { t } = useTranslation(DOC_EDITOR_V2_NS);
	const v2DocumentId = initialDocumentId?.trim() || null;
	const unifiedContentId = initialUnifiedContentId?.trim() || null;
	const title = initialTitle?.trim() || t('defaults.title');
	const stateLabels: DocEditorV2StateLabels = {
		collaboratorName: t('collaborators.names.collaborator'),
		defaultPreview: t('preview.defaultPlainText'),
		fidelityWarningDetail: t('warnings.fidelityDetail'),
		newVersionLabel: t('version.new'),
		ownerName: t('collaborators.names.owner'),
		untitledTitle: t('defaults.untitled'),
		viewerName: t('collaborators.names.viewer'),
		versionLabel: (version) => t('version.number', { version }),
	};
	const [document, setDocument] = useState<DocEditorV2DocumentResponse | null>(
		null
	);
	const [draft, setDraft] = useState<DocEditorV2EditorDraft>(() =>
		documentToDraft(null, title)
	);
	const [structureItems, setStructureItems] = useState<
		DocEditorV2StructureItem[]
	>([]);
	const [participants, setParticipants] = useState<
		DocEditorV2CollaborationParticipant[]
	>([]);
	const [suggestions, setSuggestions] = useState<
		DocEditorV2SuggestionResponse[]
	>([]);
	const [saveStatus, setSaveStatus] = useState<DocEditorV2SaveStatus>(
		v2DocumentId || unifiedContentId ? 'readonly' : 'draft'
	);
	const [conflictDocument, setConflictDocument] =
		useState<DocEditorV2DocumentResponse | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [showPaperlessPanel, setShowPaperlessPanel] = useState(false);

	useEffect(() => {
		let cancelled = false;

		async function hydrateDocumentSession(
			loadedDocument: DocEditorV2DocumentResponse,
			nextDraft: DocEditorV2EditorDraft
		) {
			if (cancelled) return;
			setDocument(loadedDocument);
			setDraft(nextDraft);
			setSaveStatus(
				loadedDocument.capabilities.can_edit ? 'synced' : 'readonly'
			);
			const [structure, collaboration] = await Promise.all([
				getDocEditorV2Structure(loadedDocument.document_id),
				getDocEditorV2CollaborationState(loadedDocument.document_id),
			]);
			if (cancelled) return;
			setStructureItems(structure.items ?? []);
			setParticipants(collaboration.participants ?? []);
			telemetryDocEditorV2Action('open', 'success');
		}

		if (!v2DocumentId && !unifiedContentId) {
			setDocument(null);
			setDraft(documentToDraft(null, title));
			setParticipants([]);
			setSuggestions([]);
			setStructureItems([]);
			setSaveStatus('draft');
			return;
		}

		setSaveStatus('readonly');
		setErrorMessage(null);
		telemetryDocEditorV2Action('open', 'start');

		if (unifiedContentId) {
			void (async () => {
				try {
					const [loadedDocumentResult, loadedFileResult] =
						await Promise.allSettled([
							getDocEditorV2Document(unifiedContentId),
							loadUnifiedContentForDocEditorV2(unifiedContentId, {
								fallbackTitle: title,
							}),
						]);

					if (cancelled) return;

					const loadedDocument =
						loadedDocumentResult.status === 'fulfilled'
							? loadedDocumentResult.value
							: null;
					const loadedFile =
						loadedFileResult.status === 'fulfilled'
							? loadedFileResult.value
							: null;

					if (!loadedFile && !loadedDocument) {
						const fileError =
							loadedFileResult.status === 'rejected'
								? loadedFileResult.reason
								: null;
						const docError =
							loadedDocumentResult.status === 'rejected'
								? loadedDocumentResult.reason
								: null;
						throw fileError ?? docError ?? new Error(t('errors.failedToLoad'));
					}

					const metadataDraft = loadedDocument
						? documentToDraft(loadedDocument, title)
						: documentToDraft(null, title);
					const nextDraft: DocEditorV2EditorDraft = loadedFile
						? {
								title: loadedFile.title || metadataDraft.title,
								contentHtml: loadedFile.contentHtml,
								plainText: loadedFile.plainText,
							}
						: metadataDraft;

					if (loadedDocument) {
						await hydrateDocumentSession(loadedDocument, nextDraft);
						return;
					}

					setDocument(null);
					setDraft(nextDraft);
					setStructureItems([]);
					setParticipants([]);
					setSaveStatus('draft');
					telemetryDocEditorV2Action('open', 'success');
				} catch (error: unknown) {
					if (cancelled) return;
					telemetryDocEditorV2Action('open', 'error');
					setErrorMessage(
						error instanceof Error ? error.message : t('errors.failedToLoad')
					);
					setSaveStatus('conflict');
				}
			})();

			return () => {
				cancelled = true;
			};
		}

		void (async () => {
			try {
				const loadedDocument = await getDocEditorV2Document(
					v2DocumentId as string
				);
				await hydrateDocumentSession(
					loadedDocument,
					documentToDraft(loadedDocument, title)
				);
			} catch (error: unknown) {
				if (cancelled) return;
				telemetryDocEditorV2Action('open', 'error');
				setErrorMessage(
					error instanceof Error ? error.message : t('errors.failedToLoad')
				);
				setSaveStatus('conflict');
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [unifiedContentId, v2DocumentId, title, t]);

	const canEdit = document?.capabilities.can_edit ?? true;
	const canSaveDraft = Boolean(document?.document_id);

	async function refreshStructure(nextDocument: DocEditorV2DocumentResponse) {
		try {
			const [structure, collaboration] = await Promise.all([
				getDocEditorV2Structure(nextDocument.document_id),
				getDocEditorV2CollaborationState(nextDocument.document_id),
			]);
			setStructureItems(structure.items ?? []);
			setParticipants(collaboration.participants ?? []);
		} catch {
			setStructureItems([]);
			setParticipants([]);
		}
	}

	async function handleSave(forceSave = false) {
		setSaveStatus('saving');
		setErrorMessage(null);
		setConflictDocument(null);
		telemetryDocEditorV2Action(document ? 'save' : 'create', 'start');
		try {
			const savedDocument = document
				? await updateDocEditorV2Document(
						document.document_id,
						buildUpdateRequest(document, draft, forceSave, stateLabels)
					)
				: await createDocEditorV2Document(
						buildCreateRequest(draft, stateLabels)
					);
			setDocument(savedDocument);
			setDraft(documentToDraft(savedDocument, title));
			setSaveStatus(
				savedDocument.capabilities.can_edit ? 'synced' : 'readonly'
			);
			telemetryDocEditorV2Action(document ? 'save' : 'create', 'success');
			await refreshStructure(savedDocument);
		} catch (error: unknown) {
			const conflict = getDocEditorV2ConflictPayload(error);
			if (conflict) {
				telemetryDocEditorV2Action('save', 'conflict');
				setConflictDocument(conflict.server_document);
				setSaveStatus('conflict');
				setErrorMessage(
					t('errors.saveConflict', { version: conflict.current_version })
				);
				return;
			}
			setSaveStatus('draft');
			telemetryDocEditorV2Action(document ? 'save' : 'create', 'error');
			setErrorMessage(
				error instanceof Error ? error.message : t('errors.saveFailed')
			);
		}
	}

	async function handleSaveDraft() {
		if (!document) return;
		setErrorMessage(null);
		telemetryDocEditorV2Action('draft', 'start');
		try {
			await putDocEditorV2Draft(
				document.document_id,
				buildDraftRequest(document, draft, stateLabels)
			);
			setSaveStatus('draft');
			telemetryDocEditorV2Action('draft', 'success');
		} catch (error: unknown) {
			telemetryDocEditorV2Action('draft', 'error');
			setErrorMessage(
				error instanceof Error ? error.message : t('errors.draftSaveFailed')
			);
		}
	}

	async function handleRequestEwaSuggestion() {
		if (!document) {
			setErrorMessage(t('errors.saveBeforeEwa'));
			return;
		}
		setErrorMessage(null);
		telemetryDocEditorV2Action('ewa_suggest', 'start');
		try {
			const selectedText = draft.plainText.slice(
				0,
				Math.min(500, draft.plainText.length)
			);
			const suggestion = await createDocEditorV2EwaSuggestion(
				document.document_id,
				{
					action: 'rewrite_selection',
					instruction: t('ewa.defaultRewriteInstruction'),
					selected_range: { start: 0, end: selectedText.length },
					selected_text: selectedText,
				}
			);
			setSuggestions((current) => [suggestion, ...current]);
			telemetryDocEditorV2Action('ewa_suggest', 'success');
		} catch (error: unknown) {
			telemetryDocEditorV2Action('ewa_suggest', 'error');
			setErrorMessage(
				error instanceof Error ? error.message : t('errors.ewaSuggestionFailed')
			);
		}
	}

	async function handleApplySuggestion(suggestionId: string) {
		if (!document) return;
		setSaveStatus('saving');
		setErrorMessage(null);
		telemetryDocEditorV2Action('ewa_apply', 'start');
		try {
			const result = await applyDocEditorV2EwaSuggestion(
				document.document_id,
				suggestionId,
				{ expected_version: document.version, force_save: false }
			);
			setDocument(result.document);
			setDraft(documentToDraft(result.document, title));
			setSuggestions((current) =>
				current.map((suggestion) =>
					suggestion.id === result.suggestion.id
						? result.suggestion
						: suggestion
				)
			);
			setSaveStatus(
				result.document.capabilities.can_edit ? 'synced' : 'readonly'
			);
			telemetryDocEditorV2Action('ewa_apply', 'success');
			await refreshStructure(result.document);
		} catch (error: unknown) {
			const conflict = getDocEditorV2ConflictPayload(error);
			if (conflict) {
				telemetryDocEditorV2Action('ewa_apply', 'conflict');
				setConflictDocument(conflict.server_document);
				setSaveStatus('conflict');
				setErrorMessage(
					t('errors.ewaApplyConflict', {
						version: conflict.current_version,
					})
				);
				return;
			}
			setSaveStatus('draft');
			telemetryDocEditorV2Action('ewa_apply', 'error');
			setErrorMessage(
				error instanceof Error ? error.message : t('errors.ewaApplyFailed')
			);
		}
	}

	async function handleImportFile(file: File) {
		setErrorMessage(null);
		telemetryDocEditorV2Action('import', 'start');
		try {
			const sourceFormat = sourceFormatFromFile(file);
			const imported = await importDocEditorV2Document({
				filename: file.name,
				source_format: sourceFormat,
				mime_type: file.type || null,
				content_text: isTextLikeFormat(sourceFormat) ? await file.text() : null,
				content_base64: isTextLikeFormat(sourceFormat)
					? null
					: await fileToBase64(file),
			});
			setDocument(imported.document);
			setDraft(documentToDraft(imported.document, title));
			setSaveStatus(
				imported.document.capabilities.can_edit ? 'synced' : 'readonly'
			);
			telemetryDocEditorV2Action('import', 'success');
			await refreshStructure(imported.document);
		} catch (error: unknown) {
			telemetryDocEditorV2Action('import', 'error');
			setErrorMessage(
				error instanceof Error ? error.message : t('errors.importFailed')
			);
		}
	}

	async function handlePaperlessImport(item: PaperlessDocumentItem) {
		setErrorMessage(null);
		telemetryDocEditorV2Action('import', 'start');
		try {
			const payload = await importPaperlessToDocEditorV2(item.id);
			const importedDocument = payload.document as
				| DocEditorV2DocumentResponse
				| undefined;
			if (!importedDocument) {
				throw new Error(t('errors.importFailed'));
			}
			setDocument(importedDocument);
			setDraft(documentToDraft(importedDocument, title));
			setSaveStatus(
				importedDocument.capabilities.can_edit ? 'synced' : 'readonly'
			);
			telemetryDocEditorV2Action('import', 'success');
			await refreshStructure(importedDocument);
		} catch (error: unknown) {
			telemetryDocEditorV2Action('import', 'error');
			setErrorMessage(
				error instanceof Error ? error.message : t('errors.importFailed')
			);
			throw error;
		}
	}

	async function handleExportMarkdown() {
		if (!document) {
			setErrorMessage(t('errors.exportBeforeSave'));
			return;
		}
		setErrorMessage(null);
		telemetryDocEditorV2Action('export', 'start');
		try {
			const exported = await exportDocEditorV2Document(document.document_id, {
				export_format: 'markdown',
			});
			downloadBase64File(
				exported.filename,
				exported.mime_type,
				exported.content_base64
			);
			telemetryDocEditorV2Action('export', 'success');
		} catch (error: unknown) {
			telemetryDocEditorV2Action('export', 'error');
			setErrorMessage(
				error instanceof Error ? error.message : t('errors.exportFailed')
			);
		}
	}

	const shellState = buildShellStateFromViewModel(
		{
			document,
			draft,
			saveStatus,
			conflictDocument,
			structureItems,
			participants,
			suggestions,
			errorMessage,
		},
		stateLabels
	);

	return (
		<>
			<DocEditorV2Shell
				state={shellState}
				editorCanvas={
					<DocEditorV2Core
						draft={draft}
						saveStatus={saveStatus}
						canEdit={canEdit}
						canSaveDraft={canSaveDraft}
						errorMessage={
							conflictDocument
								? t('errors.serverVersionAvailable', {
										message: errorMessage ?? '',
										version: conflictDocument.version,
									})
								: errorMessage
						}
						onDraftChange={(nextDraft) => {
							setDraft(nextDraft);
							setSaveStatus(document ? 'draft' : 'draft');
						}}
						onSave={() => {
							void handleSave(false);
						}}
						onSaveDraft={() => {
							void handleSaveDraft();
						}}
						onForceSave={
							document
								? () => {
										void handleSave(true);
									}
								: undefined
						}
					/>
				}
				onRequestEwaSuggestion={() => {
					void handleRequestEwaSuggestion();
				}}
				onApplySuggestion={(suggestionId) => {
					void handleApplySuggestion(suggestionId);
				}}
				onImportFile={(file) => {
					void handleImportFile(file);
				}}
				onOpenPaperless={() => setShowPaperlessPanel(true)}
				onExportMarkdown={() => {
					void handleExportMarkdown();
				}}
				onFallbackToLegacy={onFallbackToLegacy}
			/>
			<PaperlessPickerPanel
				isOpen={showPaperlessPanel}
				onClose={() => setShowPaperlessPanel(false)}
				onImport={handlePaperlessImport}
			/>
		</>
	);
}

export default DocEditorV2;
