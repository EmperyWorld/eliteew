/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zustand slice for Ultimate Doc Editor store (fileops).
 *
 * Invariants:
 * - Actions use helpers from `editorStoreHelpers.ts`; no direct React.
 *
 * Related:
 * - `store/editorStore.ts`
 */

import type { StateCreator } from 'zustand';
import type { EditorStore } from '../editorStore';
import { apiClient } from '../../../../services/api/client';
import { log } from '../../../../utils/logger';
import type { UltimateDocument } from '../../types/editor.types';
import { EDITOR_API_BASE } from '../editorStoreHelpers';

export const createEditorFileOpsSlice =
	(): StateCreator<EditorStore, [], [], Partial<EditorStore>> =>
	(set, get, _api) => ({
		uploadFile: async (file: File) => {
			set({
				isLoading: true,
				isLoadingDocument: true,
				error: undefined,
			});
			try {
				const formData = new FormData();
				formData.append('file', file);
				const res = await apiClient.post<{
					document_id: string;
					title: string;
					content: string;
					metadata?: Record<string, unknown>;
				}>(`${EDITOR_API_BASE}/upload`, formData, {
					headers: { 'Content-Type': 'multipart/form-data' },
				});
				const data = res.data as {
					document_id: string;
					title: string;
					content: string;
					metadata?: Record<string, unknown>;
				};
				const document: UltimateDocument = {
					id: data.document_id,
					user_id: '',
					title: data.title ?? 'Без названия',
					content: typeof data.content === 'string' ? data.content : '',
					content_type: 'html',
					metadata: data.metadata ?? {},
					tags: [],
					is_public: false,
					access_level: 'private',
					word_count: 0,
					character_count: data.content?.length ?? 0,
					version_number: 1,
					created_at: '',
					updated_at: '',
					last_accessed_at: '',
				};
				set({
					currentDocument: document,
					documentSource: 'doc_editor',
					isLoading: false,
					isLoadingDocument: false,
				});
			} catch (error: unknown) {
				const errorObj = error as { status?: number; message?: string };
				if (errorObj?.status === 404 || errorObj?.message?.includes('404')) {
					log.warn('EditorStore', 'Upload endpoint not available (404)');
					set({
						isLoading: false,
						isLoadingDocument: false,
						error: undefined,
					});
				} else {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					set({
						error: errorMessage,
						isLoading: false,
						isLoadingDocument: false,
					});
				}
			}
		},

		importDocument: async (
			file: File,
			_options?: { enhanceLegacyDoc?: boolean }
		) => {
			try {
				const formData = new FormData();
				formData.append('file', file);
				const res = await apiClient.post<{
					document_id: string;
					title: string;
					content: string;
					metadata?: {
						tika_metadata?: { word_count?: number };
						mime_type?: string;
					};
				}>(`${EDITOR_API_BASE}/upload?parse=true`, formData, {
					headers: { 'Content-Type': 'multipart/form-data' },
				});
				const data = res.data;
				return {
					id: data.document_id,
					title: data.title,
					content: data.content,
					word_count: data.metadata?.tika_metadata?.word_count || 0,
					character_count: data.content?.length || 0,
					mime_type: data.metadata?.mime_type || file.type,
					metadata: data.metadata ?? {},
				};
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				throw new Error(errorMessage || 'Import failed');
			}
		},

		exportDocument: async (
			format: 'pdf' | 'docx' | 'html' | 'txt' | 'md' | 'xlsx'
		) => {
			const { currentDocument } = get();
			if (!currentDocument) {
				return;
			}

			set({ isLoading: true, error: undefined });
			try {
				const response = await apiClient.post(
					`${EDITOR_API_BASE}/export/${currentDocument.id}?format=${format}`,
					undefined,
					{ responseType: 'blob' }
				);
				if (response.status !== 200 || !response.data) {
					throw new Error('Export failed');
				}

				const blob = response.data as Blob;
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				const titleBase = (currentDocument.title || 'document').trim();
				const extPattern = new RegExp(`\\.${format}$`, 'i');
				a.download = `${extPattern.test(titleBase) ? titleBase.replace(extPattern, '') : titleBase}.${format}`;
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);
				set({ isLoading: false });
			} catch (error: unknown) {
				const errorObj = error as { status?: number; message?: string };
				if (errorObj?.status === 404 || errorObj?.message?.includes('404')) {
					log.warn('EditorStore', 'Export endpoint not available (404)');
					set({ isLoading: false, error: undefined });
				} else {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					set({ error: errorMessage, isLoading: false });
				}
			}
		},

		performOCR: async (file: File, language: string) => {
			try {
				const formData = new FormData();
				formData.append('file', file);
				formData.append('language', language);
				const res = await apiClient.post<{
					success?: boolean;
					error?: string;
					text?: string;
					confidence?: number;
					processing_time?: number;
				}>(`${EDITOR_API_BASE}/ocr`, formData, {
					headers: { 'Content-Type': 'multipart/form-data' },
				});
				const result = res.data;

				if (result.success === false) {
					throw new Error(result.error || 'OCR processing failed');
				}

				const text = (result.text || '').trim();
				if (!text) {
					throw new Error('OCR не вернул текст');
				}

				return {
					fileName: file.name,
					success: true,
					text,
					confidence: result.confidence,
					language,
					processingTime: result.processing_time,
				};
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				return {
					fileName: file.name,
					success: false,
					error: errorMessage || 'OCR processing failed',
				};
			}
		},
	});
