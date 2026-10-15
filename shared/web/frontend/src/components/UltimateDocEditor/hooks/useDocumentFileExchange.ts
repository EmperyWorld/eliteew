/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Integrates Unified Content file exchange with Ultimate Doc Editor load/save,
 * versioning, and document identity tracking.
 *
 * Invariants:
 * - Downloaded text/HTML is normalized and sanitized before it enters editor state.
 * - Office binaries (doc/docx/odt/rtf) go through convert/upload, never Blob.text().
 * - Active load requests are abortable and stale request ids never update current content.
 *
 * Related:
 * - src/components/UltimateDocEditor/utils/unifiedContentLoadRouting.ts
 * - src/components/UltimateDocEditor/chrome/UltimateDocEditorMainGrid.tsx
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { sanitizeUserHtml } from '@/utils/sanitizeUserHtml';
import { apiClient } from '../../../services/api';
import { contentApi } from '../../../services/contentApi';
import { UNIFIED_CONTENT_BLOB_UPDATED_EVENT } from '../../../services/unifiedContentEvents';
import { useFileUpload } from '../../../hooks/useFileUpload';
import { useFileData } from '../../../hooks/useFileData';
import { log } from '../../../utils/logger';
import {
	telemetryDocEditorLoadFinish,
	telemetryDocEditorLoadStart,
} from '../../../pages/Desktop/utils/desktopTelemetry';
import { buildUnifiedEditorSavePayload } from '../utils/unifiedContentEditorSave';
import {
	resolveUnifiedLoadBodyKind,
	resolvedUnifiedContentStorageName,
	isUnifiedOfficeDocumentFormat,
} from '../utils/unifiedContentLoadRouting';
import { convertUploadedFileViaDocEditor } from '../utils/convertUploadedFileViaDocEditor';
import { prepareOfficeHtmlForTipTap } from '../utils/prepareOfficeHtmlForTipTap';
import {
	type FileId,
	ContentType,
	VisibilityLevel,
	createFileId,
} from '../../../types/fileExchange';

// ============================================================================
// TYPES
// ============================================================================

interface DocumentContent {
	html: string;
	/** Исходный Markdown при загрузке .md — для режима «исходник» без HTML→MD roundtrip */
	markdownSource?: string;
	/** Отображаемое имя (часто без расширения) */
	title: string;
	/** Имя файла в хранилище с расширением — для save/replace и определения .md */
	storageFileName: string;
	fileSize: number;
	contentType: ContentType;
	canEdit?: boolean;
	/** Unified content owner (`user_id`) — SSOT for collab invite ownership, not session user. */
	ownerUserId?: string;
}

export type DocumentLoadErrorCode =
	| 'not_found'
	| 'forbidden'
	| 'network'
	| 'unknown';

interface UseDocumentFileExchangeResult {
	// Current document
	currentFileId: FileId | null;
	currentContent: DocumentContent | null;
	loading: boolean;
	error: string | null;
	errorCode: DocumentLoadErrorCode | null;

	// Actions
	loadDocumentById: (
		fileId: FileId,
		options?: { requestId?: string }
	) => Promise<void>;
	uploadDocument: (file: File, tags?: string[]) => Promise<FileId>;
	saveCurrentDocument: (content: string) => Promise<void>;
	createNewDocument: (title: string, content: string) => Promise<FileId>;

	// File upload state
	uploading: boolean;
	uploadProgress: number;

	// Helpers
	clearDocument: () => void;
	clearLoadError: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing documents with Unified Content API integration
 *
 * @example
 * ```tsx
 * const {
 *   currentFileId,
 *   currentContent,
 *   loadDocumentById,
 *   uploadDocument,
 *   saveCurrentDocument,
 * } = useDocumentFileExchange();
 *
 * // Load existing document
 * await loadDocumentById(createFileId("abc123"));
 *
 * // Upload new document
 * const fileId = await uploadDocument(file, ['draft', 'article']);
 *
 * // Save changes
 * await saveCurrentDocument(editorContent);
 * ```
 */
export const useDocumentFileExchange = (): UseDocumentFileExchangeResult => {
	// State
	const [currentFileId, setCurrentFileId] = useState<FileId | null>(null);
	const [currentContent, setCurrentContent] = useState<DocumentContent | null>(
		null
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [errorCode, setErrorCode] = useState<DocumentLoadErrorCode | null>(
		null
	);
	const activeLoadRequestIdRef = useRef(0);
	const activeLoadAbortControllerRef = useRef<AbortController | null>(null);

	// File upload hook
	const {
		uploadFile,
		uploading,
		progress: uploadProgress,
		error: uploadError,
	} = useFileUpload();

	// File data hook for current document
	const { loading: metadataLoading } = useFileData(currentFileId);

	/**
	 * Loads document content by FileId
	 */
	const loadDocumentById = useCallback(
		async (fileId: FileId, options?: { requestId?: string }): Promise<void> => {
			const requestIdFromContext =
				typeof options?.requestId === 'string' && options.requestId.trim()
					? options.requestId.trim()
					: undefined;
			const telemetryStartMark = telemetryDocEditorLoadStart(
				'unifiedContent',
				requestIdFromContext
			);
			activeLoadRequestIdRef.current += 1;
			const requestId = activeLoadRequestIdRef.current;
			activeLoadAbortControllerRef.current?.abort();
			const abortController = new AbortController();
			activeLoadAbortControllerRef.current = abortController;
			setLoading(true);
			setError(null);
			setErrorCode(null);

			try {
				// Fetch file metadata first
				const metadataResponse = await apiClient.get(
					`/api/v1/content/${fileId}`,
					{ signal: abortController.signal }
				);
				if (requestId !== activeLoadRequestIdRef.current) {
					telemetryDocEditorLoadFinish(
						'unifiedContent',
						'canceled',
						telemetryStartMark,
						requestIdFromContext
					);
					return;
				}
				const fileData = metadataResponse.data as {
					name?: string;
					original_filename?: string | null;
					file_size?: number;
					content_type?: ContentType;
					mime_type?: string;
					can_edit?: boolean;
					is_owner?: boolean;
					user_id?: string;
				};
				const canEdit =
					typeof fileData?.can_edit === 'boolean'
						? fileData.can_edit
						: typeof fileData?.is_owner === 'boolean'
							? fileData.is_owner
							: undefined;
				const ownerUserId =
					typeof fileData?.user_id === 'string' && fileData.user_id.trim()
						? fileData.user_id.trim()
						: undefined;

				// Download actual file content
				const downloadResponse = await apiClient.get(
					`/api/v1/content/${fileId}/download`,
					{
						responseType: 'blob',
						signal: abortController.signal,
					}
				);
				if (requestId !== activeLoadRequestIdRef.current) {
					telemetryDocEditorLoadFinish(
						'unifiedContent',
						'canceled',
						telemetryStartMark,
						requestIdFromContext
					);
					return;
				}

				const blob = downloadResponse.data as Blob;
				const fileMeta = {
					content_type: fileData.content_type,
					mime_type: fileData.mime_type,
					name: fileData.name,
					original_filename: fileData.original_filename,
				};
				const storageFileName = resolvedUnifiedContentStorageName(fileMeta);

				let htmlContent: string;
				let loadedMarkdownSource: string | undefined;
				if (isUnifiedOfficeDocumentFormat(fileMeta)) {
					try {
						htmlContent = await convertUploadedFileViaDocEditor(
							blob,
							storageFileName,
							'html',
							fileData.mime_type
						);
					} catch (convertErr) {
						log.error(
							'DocumentFileExchange',
							'Office convert/upload failed',
							convertErr instanceof Error ? convertErr : undefined,
							convertErr
						);
						htmlContent =
							'<p class="text-red-500">Не удалось преобразовать документ Word/ODT. Проверьте, что stack4 (Tika) доступен, или скачайте файл.</p>';
					}
				} else {
					const bodyText = await blob.text();
					const loadKind = resolveUnifiedLoadBodyKind(fileMeta, bodyText);
					htmlContent = bodyText;
					if (loadKind === 'plain_paragraphs') {
						htmlContent = `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`;
					} else if (loadKind === 'markdown_to_html') {
						loadedMarkdownSource = bodyText;
						const { renderMarkdownToHTML } = await import(
							'../utils/renderMarkdownToHtml'
						);
						htmlContent = renderMarkdownToHTML(bodyText);
					} else if (loadKind === 'html_as_is') {
						if (!bodyText.trim().startsWith('<')) {
							htmlContent = `<p>${bodyText}</p>`;
						}
					} else {
						htmlContent = `<p class="text-red-500">Неподдерживаемый формат файла. Редактор поддерживает HTML, текст и Word (doc/docx/odt/rtf).</p>`;
					}
				}
				htmlContent = sanitizeUserHtml(prepareOfficeHtmlForTipTap(htmlContent));

				if (requestId === activeLoadRequestIdRef.current) {
					setCurrentContent({
						html: htmlContent,
						markdownSource: loadedMarkdownSource,
						title: fileData.name ?? 'Без названия',
						storageFileName,
						fileSize: fileData.file_size ?? 0,
						contentType: fileData.content_type ?? ContentType.DOCUMENT,
						canEdit,
						ownerUserId,
					});

					setCurrentFileId(fileId);
					setError(null);
					setErrorCode(null);
					telemetryDocEditorLoadFinish(
						'unifiedContent',
						'success',
						telemetryStartMark,
						requestIdFromContext
					);
				}

				log.info('DocumentFileExchange', 'Loaded document', String(fileId));
			} catch (err: unknown) {
				const maybeAxiosLike = err as {
					name?: string;
					code?: string;
					message?: string;
					response?: { status?: number };
				};
				if (
					maybeAxiosLike?.name === 'CanceledError' ||
					maybeAxiosLike?.code === 'ERR_CANCELED'
				) {
					telemetryDocEditorLoadFinish(
						'unifiedContent',
						'canceled',
						telemetryStartMark,
						requestIdFromContext
					);
					return;
				}
				if (requestId !== activeLoadRequestIdRef.current) {
					telemetryDocEditorLoadFinish(
						'unifiedContent',
						'canceled',
						telemetryStartMark,
						requestIdFromContext
					);
					return;
				}
				const message = err instanceof Error ? err.message : String(err);
				const status = maybeAxiosLike?.response?.status;
				const nextErrorCode: DocumentLoadErrorCode =
					status === 404
						? 'not_found'
						: status === 403
							? 'forbidden'
							: status == null
								? 'network'
								: 'unknown';
				log.error(
					'DocumentFileExchange',
					'Failed to load document',
					err instanceof Error ? err : new Error(message)
				);
				setErrorCode(nextErrorCode);
				setError(
					nextErrorCode === 'not_found'
						? 'Document was not found'
						: nextErrorCode === 'forbidden'
							? 'Access denied to this document'
							: nextErrorCode === 'network'
								? 'Network error while loading document'
								: 'Failed to load document'
				);
				setCurrentContent(null);
				telemetryDocEditorLoadFinish(
					'unifiedContent',
					nextErrorCode,
					telemetryStartMark,
					requestIdFromContext
				);
			} finally {
				if (requestId === activeLoadRequestIdRef.current) {
					setLoading(false);
					activeLoadAbortControllerRef.current = null;
				}
			}
		},
		[]
	);

	/**
	 * Uploads a new document file
	 */
	const uploadDocument = useCallback(
		async (file: File, tags: string[] = []): Promise<FileId> => {
			try {
				const result = await uploadFile(file, {
					tags: [...tags, 'document'],
					visibility: VisibilityLevel.PRIVATE,
					contentType: ContentType.DOCUMENT,
				});

				// Load the newly uploaded document
				await loadDocumentById(result.id);

				log.info(
					'DocumentFileExchange',
					'Uploaded document',
					String(result.id)
				);
				return result.id;
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				log.error(
					'DocumentFileExchange',
					'Upload failed',
					err instanceof Error ? err : new Error(message)
				);
				throw err;
			}
		},
		[uploadFile, loadDocumentById]
	);

	/**
	 * Saves current document content in place (same unified content id).
	 */
	const saveCurrentDocument = useCallback(
		async (content: string): Promise<void> => {
			if (!currentFileId) {
				throw new Error('No document loaded');
			}

			setLoading(true);
			setError(null);

			try {
				let storageName =
					currentContent?.storageFileName ||
					currentContent?.title ||
					'document.html';
				let storedMime: string | null | undefined;
				try {
					const metaResp = await apiClient.get(
						`/api/v1/content/${currentFileId}`
					);
					const fd = metaResp.data as {
						name?: string;
						original_filename?: string | null;
						mime_type?: string | null;
					};
					storageName = resolvedUnifiedContentStorageName({
						name: fd.name,
						original_filename: fd.original_filename,
					});
					storedMime = fd.mime_type;
				} catch {
					// сеть / гонка: сохраняем с последним известным именем из состояния
				}

				const { bytes, mime, logicalHtml } = buildUnifiedEditorSavePayload(
					content,
					storageName,
					{ storedMimeType: storedMime }
				);
				const blob = new Blob([bytes], { type: mime });
				const file = new File([blob], storageName, { type: mime });

				const result = await contentApi.replaceContentFile(
					String(currentFileId),
					file
				);

				// Same logical document id (replace in place)
				if (String(result.id) !== String(currentFileId)) {
					setCurrentFileId(createFileId(String(result.id)));
				}

				// Update local state
				if (currentContent) {
					const nextStorage =
						result.original_filename?.trim() ||
						result.name?.trim() ||
						storageName ||
						currentContent.storageFileName;
					setCurrentContent({
						...currentContent,
						html: logicalHtml,
						fileSize: blob.size,
						storageFileName: nextStorage,
					});
				}

				log.info(
					'DocumentFileExchange',
					'Saved document (replace in place)',
					String(result.id)
				);

				if (typeof window !== 'undefined') {
					window.dispatchEvent(
						new CustomEvent(UNIFIED_CONTENT_BLOB_UPDATED_EVENT, {
							detail: {
								contentId: String(result.id),
								updated_at: result.updated_at,
								file_size: result.file_size ?? null,
							},
						})
					);
				}
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				log.error(
					'DocumentFileExchange',
					'Save failed',
					err instanceof Error ? err : new Error(message)
				);
				setError('Failed to save document');
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[currentFileId, currentContent]
	);

	/**
	 * Creates a new document with initial content
	 */
	const createNewDocument = useCallback(
		async (title: string, content: string): Promise<FileId> => {
			try {
				// Create HTML file blob
				const blob = new Blob([content], { type: 'text/html' });
				const file = new File([blob], `${title}.html`, { type: 'text/html' });

				// Upload as new document
				return await uploadDocument(file, ['new', 'draft']);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				log.error(
					'DocumentFileExchange',
					'Create failed',
					err instanceof Error ? err : new Error(message)
				);
				throw err;
			}
		},
		[uploadDocument]
	);

	/**
	 * Clears current document state
	 */
	const clearDocument = useCallback((): void => {
		setCurrentFileId(null);
		setCurrentContent(null);
		setError(null);
		setErrorCode(null);
	}, []);

	const clearLoadError = useCallback((): void => {
		setError(null);
		setErrorCode(null);
	}, []);

	// Update error state from upload hook
	useEffect(() => {
		if (uploadError) {
			setError(uploadError);
		}
	}, [uploadError]);

	useEffect(
		() => () => {
			activeLoadAbortControllerRef.current?.abort();
		},
		[]
	);

	return {
		// Current document
		currentFileId,
		currentContent,
		loading: loading || metadataLoading,
		error,
		errorCode,

		// Actions
		loadDocumentById,
		uploadDocument,
		saveCurrentDocument,
		createNewDocument,

		// Upload state
		uploading,
		uploadProgress,

		// Helpers
		clearDocument,
		clearLoadError,
	};
};
