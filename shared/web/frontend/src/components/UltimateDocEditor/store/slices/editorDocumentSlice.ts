/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * CRUD документов, конфликты версий и listDocuments для Ultimate Doc Editor store.
 *
 * Invariants:
 * - Actions используют хелперы из `editorStoreHelpers.ts`; без прямого React.
 *
 * Related:
 * - `store/editorStore.ts`, `store/editorStoreHelpers.ts`
 */

import { APIError, api } from '../../../../services/api/client';
import { log } from '../../../../utils/logger';
import {
	telemetryDocEditorLoadFinish,
	telemetryDocEditorLoadStart,
} from '../../../../pages/Desktop/utils/desktopTelemetry';
import type { EditorStore } from '../editorStore';
import type {
	ListDocumentsParams,
	UltimateDocument,
} from '../../types/editor.types';
import {
	EDITOR_API_BASE,
	apiFetch,
	extractDocumentVersionConflict,
	getDocumentsArrayFromResponse,
	mapDocEditorLoadStatus,
	normalizeDocument,
	parseDocumentListTotal,
} from '../editorStoreHelpers';

import type { StateCreator } from 'zustand';

export type EditorDocumentLoadGenRef = { current: number };

export const createEditorDocumentSlice =
	(
		loadGenRef: EditorDocumentLoadGenRef
	): StateCreator<EditorStore, [], [], Partial<EditorStore>> =>
	(set, get) => ({
		loadDocument: async (
			id: string,
			options?: { signal?: AbortSignal; requestId?: string }
		) => {
			const traceRequestId =
				typeof options?.requestId === 'string' && options.requestId.trim()
					? options.requestId.trim()
					: undefined;
			const telemetryStartMark = telemetryDocEditorLoadStart(
				'docEditor',
				traceRequestId
			);
			const gen = ++loadGenRef.current;
			set((state) => ({
				isLoading: true,
				isLoadingDocument: true,
				documentSource: null,
				error: undefined,
				...(state.currentDocument?.id !== id ? { currentDocument: null } : {}),
			}));
			try {
				// api.get returns response.data (backend returns document body directly, not { data: ... })
				const raw = await api.get<unknown>(
					`${EDITOR_API_BASE}/documents/${id}`,
					{ signal: options?.signal }
				);
				if (options?.signal?.aborted) {
					telemetryDocEditorLoadFinish(
						'docEditor',
						'canceled',
						telemetryStartMark,
						traceRequestId
					);
					return;
				}
				if (gen !== loadGenRef.current) {
					telemetryDocEditorLoadFinish(
						'docEditor',
						'canceled',
						telemetryStartMark,
						traceRequestId
					);
					return;
				}
				const document = normalizeDocument(raw);
				set((state) => {
					const did = document.id;
					const nextOrder =
						did && did !== 'temp' && !state.docTabOrder.includes(did)
							? [...state.docTabOrder, did]
							: state.docTabOrder;
					const nextTitles =
						did && did !== 'temp'
							? {
									...state.docTabTitles,
									[did]: document.title || 'Без названия',
								}
							: state.docTabTitles;
					return {
						currentDocument: document,
						documentSource: 'doc_editor',
						isLoading: false,
						isLoadingDocument: false,
						isDirty: false,
						docTabOrder: nextOrder,
						docTabTitles: nextTitles,
					};
				});
				telemetryDocEditorLoadFinish(
					'docEditor',
					'success',
					telemetryStartMark,
					traceRequestId
				);
			} catch (error: unknown) {
				if (options?.signal?.aborted) {
					telemetryDocEditorLoadFinish(
						'docEditor',
						'canceled',
						telemetryStartMark,
						traceRequestId
					);
					return;
				}
				if (gen !== loadGenRef.current) {
					telemetryDocEditorLoadFinish(
						'docEditor',
						'canceled',
						telemetryStartMark,
						traceRequestId
					);
					return;
				}
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				telemetryDocEditorLoadFinish(
					'docEditor',
					mapDocEditorLoadStatus(error),
					telemetryStartMark,
					traceRequestId
				);
				set({
					error: errorMessage,
					isLoading: false,
					isLoadingDocument: false,
				});
			}
		},

		createDocument: async (title: string, content = '') => {
			set({
				isLoading: true,
				isLoadingDocument: true,
				error: undefined,
			});
			try {
				const raw = await apiFetch(`${EDITOR_API_BASE}/documents`, {
					method: 'POST',
					body: JSON.stringify({
						title,
						content,
						content_type: 'html',
					}),
				});
				const document = normalizeDocument(raw);
				set({
					currentDocument: document,
					documentSource: 'doc_editor',
					isLoading: false,
					isLoadingDocument: false,
					isDirty: false,
					lastSaved: new Date(),
				});
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				set({
					error: errorMessage,
					isLoading: false,
					isLoadingDocument: false,
				});
			}
		},

		updateDocument: async (
			updates: Partial<UltimateDocument>,
			options?: { expectedVersion?: number | null; forceSave?: boolean }
		) => {
			const { currentDocument, documentSource } = get();
			if (!currentDocument || currentDocument.id === 'temp') {
				return;
			}
			if (documentSource === 'unified_content') {
				log.warn(
					'EditorStore',
					'updateDocument skipped: current document is Unified Content; use Content API save path'
				);
				return;
			}

			const docUrl = `${EDITOR_API_BASE}/documents/${currentDocument.id}`;

			const runPut = async (body: Record<string, unknown>): Promise<unknown> =>
				apiFetch(docUrl, {
					method: 'PUT',
					body: JSON.stringify(body),
				});

			set({ isSaving: true, error: undefined });
			try {
				const payload: Record<string, unknown> = { ...updates };
				if (options?.forceSave) {
					payload.force_save = true;
					delete payload.expected_version;
				} else if (typeof options?.expectedVersion === 'number') {
					payload.expected_version = options.expectedVersion;
				}
				let raw: unknown;
				try {
					raw = await runPut(payload);
				} catch (first: unknown) {
					const conflict =
						first instanceof APIError
							? extractDocumentVersionConflict(first)
							: null;
					if (conflict && !options?.forceSave) {
						const serverNorm = normalizeDocument(conflict.serverDocument);
						set({
							documentVersionConflict: {
								serverDocument: serverNorm,
								pendingUpdates: updates,
							},
							isSaving: false,
						});
						return;
					}
					throw first;
				}
				const updatedDoc = normalizeDocument(raw);
				set((state) => ({
					currentDocument: updatedDoc,
					documentSource: 'doc_editor',
					isSaving: false,
					isDirty: false,
					documentVersionConflict: null,
					lastSaved: new Date(),
					docTabTitles:
						updatedDoc.id && updatedDoc.id !== 'temp'
							? {
									...state.docTabTitles,
									[updatedDoc.id]: updatedDoc.title || 'Без названия',
								}
							: state.docTabTitles,
				}));
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				set({ error: errorMessage, isSaving: false });
			}
		},

		clearDocumentVersionConflict: () => set({ documentVersionConflict: null }),

		acceptDocumentVersionConflictServer: () =>
			set((state) => {
				if (!state.documentVersionConflict) {
					return {};
				}
				return {
					currentDocument: state.documentVersionConflict.serverDocument,
					documentVersionConflict: null,
					isDirty: false,
					isSaving: false,
				};
			}),

		retryDocumentVersionConflictForceOverwrite: async () => {
			const c = get().documentVersionConflict;
			if (!c) {
				return;
			}
			const pending = c.pendingUpdates;
			set({ documentVersionConflict: null });
			await get().updateDocument(pending, { forceSave: true });
		},

		saveDocumentVersionConflictAsCopy: async () => {
			const c = get().documentVersionConflict;
			const cur = get().currentDocument;
			if (!c || !cur || cur.id === 'temp') {
				return;
			}
			const titleBase = (cur.title || 'Без названия').trim();
			const content =
				typeof c.pendingUpdates.content === 'string'
					? c.pendingUpdates.content
					: cur.content || '<p></p>';
			set({ documentVersionConflict: null });
			await get().createDocument(`${titleBase} (копия)`, content);
		},

		deleteDocument: async (id: string) => {
			set({
				isLoading: true,
				isLoadingDocument: true,
				error: undefined,
			});
			try {
				await apiFetch(`${EDITOR_API_BASE}/documents/${id}`, {
					method: 'DELETE',
				});
				const {
					documents,
					currentDocument,
					documentSource,
					documentsTotal,
					docTabOrder,
					docTabSessions,
					docTabTitles,
				} = get();
				const hadDoc = documents.some((d) => d.id === id);
				const restSessions = { ...docTabSessions };
				delete restSessions[id];
				const restTitles = { ...docTabTitles };
				delete restTitles[id];
				set({
					documents: documents.filter((d) => d.id !== id),
					documentsTotal: hadDoc
						? Math.max(0, documentsTotal - 1)
						: documentsTotal,
					currentDocument: currentDocument?.id === id ? null : currentDocument,
					documentSource: currentDocument?.id === id ? null : documentSource,
					isLoading: false,
					isLoadingDocument: false,
					docTabOrder: docTabOrder.filter((x) => x !== id),
					docTabSessions: restSessions,
					docTabTitles: restTitles,
				});
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				set({
					error: errorMessage,
					isLoading: false,
					isLoadingDocument: false,
				});
			}
		},

		listDocuments: async (params: ListDocumentsParams = {}) => {
			const skip = params.skip ?? 0;
			const limit = params.limit ?? 50;
			const search = params.search?.trim() || undefined;
			const append = params.append ?? false;

			if (append) {
				set({ isLoadingMoreDocuments: true, error: undefined });
			} else {
				set({
					isLoading: true,
					error: undefined,
					isLoadingMoreDocuments: false,
				});
			}
			try {
				const qs = new URLSearchParams();
				qs.set('skip', String(skip));
				qs.set('limit', String(limit));
				if (search) {
					qs.set('search', search);
				}
				const listProfile = params.listProfile ?? 'compact';
				qs.set('list_profile', listProfile);
				const response = await apiFetch(
					`${EDITOR_API_BASE}/documents?${qs.toString()}`
				);
				const rawList = getDocumentsArrayFromResponse(response);
				const nextDocs = rawList.map((raw: unknown) => normalizeDocument(raw));
				const total = parseDocumentListTotal(response);

				if (append) {
					const prev = get().documents;
					const seen = new Set(prev.map((d) => d.id));
					const merged: UltimateDocument[] = [...prev];
					for (const d of nextDocs) {
						if (!seen.has(d.id)) {
							seen.add(d.id);
							merged.push(d);
						}
					}
					set({
						documents: merged,
						documentsTotal: total,
						isLoading: false,
						isLoadingMoreDocuments: false,
					});
				} else {
					set({
						documents: nextDocs,
						documentsTotal: total,
						isLoading: false,
						isLoadingMoreDocuments: false,
					});
				}
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				set({
					error: errorMessage,
					isLoading: false,
					isLoadingMoreDocuments: false,
				});
			}
		},
	});
