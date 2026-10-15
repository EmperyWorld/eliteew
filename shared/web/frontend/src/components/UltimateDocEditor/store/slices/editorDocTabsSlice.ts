/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Multi-tab сессии документов (snapshot/switch/add/remove) в Ultimate Doc Editor store.
 *
 * Invariants:
 * - Вкладки только для `documentSource === 'doc_editor'`; temp id не снапшотится.
 *
 * Related:
 * - `store/editorStore.ts`, `store/editorStoreHelpers.ts`
 */

import type { EditorStore } from '../editorStore';
import {
	buildDocTabSession,
	docTabSessionToStatePatch,
} from '../editorStoreHelpers';
import type { StateCreator } from 'zustand';

export const createEditorDocTabsSlice: StateCreator<
	EditorStore,
	[],
	[],
	Partial<EditorStore>
> = (set, get) => ({
	snapshotActiveDocTab: () => {
		const s = get();
		const id = s.currentDocument?.id;
		if (!id || id === 'temp' || s.documentSource !== 'doc_editor') {
			return;
		}
		set((st) => ({
			docTabSessions: {
				...st.docTabSessions,
				[id]: buildDocTabSession(st),
			},
		}));
	},

	applyDocTabSession: (documentId: string) => {
		const snap = get().docTabSessions[documentId];
		if (!snap) return;
		const rest = { ...get().docTabSessions };
		delete rest[documentId];
		set({ ...docTabSessionToStatePatch(snap), docTabSessions: rest });
	},

	clearDocTabSession: (documentId: string) => {
		set((st) => {
			const rest = { ...st.docTabSessions };
			delete rest[documentId];
			return { docTabSessions: rest };
		});
	},

	switchDocTab: async (documentId: string) => {
		const state = get();
		if (state.currentDocument?.id === documentId && !state.isLoadingDocument) {
			return;
		}
		get().snapshotActiveDocTab();
		const snap = get().docTabSessions[documentId];
		if (snap) {
			const rest = { ...get().docTabSessions };
			delete rest[documentId];
			set({
				...docTabSessionToStatePatch(snap),
				docTabSessions: rest,
			});
		} else {
			await get().loadDocument(documentId);
		}
	},

	addDocTab: async (documentId: string) => {
		get().snapshotActiveDocTab();
		set((s) => ({
			docTabOrder: s.docTabOrder.includes(documentId)
				? s.docTabOrder
				: [...s.docTabOrder, documentId],
		}));
		const snap = get().docTabSessions[documentId];
		if (snap) {
			const rest = { ...get().docTabSessions };
			delete rest[documentId];
			set({
				...docTabSessionToStatePatch(snap),
				docTabSessions: rest,
			});
		} else {
			await get().loadDocument(documentId);
		}
	},

	removeDocTab: (documentId: string) => {
		const { docTabOrder, docTabSessions, docTabTitles, currentDocument } =
			get();
		if (docTabOrder.length <= 1) {
			return;
		}
		if (!docTabOrder.includes(documentId)) {
			return;
		}
		const idx = docTabOrder.indexOf(documentId);
		const newOrder = docTabOrder.filter((x) => x !== documentId);
		const restSessions = { ...docTabSessions };
		delete restSessions[documentId];
		const restTitles = { ...docTabTitles };
		delete restTitles[documentId];
		const isActive = currentDocument?.id === documentId;
		if (!isActive) {
			set({
				docTabOrder: newOrder,
				docTabSessions: restSessions,
				docTabTitles: restTitles,
			});
			return;
		}
		const fallbackId = newOrder[idx] ?? newOrder[idx - 1] ?? newOrder[0];
		if (!fallbackId) {
			set({
				docTabOrder: [],
				docTabSessions: {},
				docTabTitles: {},
				currentDocument: null,
				documentSource: null,
				isDirty: false,
				activeCollaborators: [],
			});
			return;
		}
		const targetSnap = restSessions[fallbackId];
		set({
			docTabOrder: newOrder,
			docTabTitles: restTitles,
			docTabSessions: restSessions,
		});
		if (targetSnap) {
			const rest3 = { ...get().docTabSessions };
			delete rest3[fallbackId];
			set({
				...docTabSessionToStatePatch(targetSnap),
				docTabSessions: rest3,
			});
		} else {
			void get().loadDocument(fallbackId);
		}
	},

	setDocTabTitle: (documentId: string, title: string) => {
		set((s) => ({
			docTabTitles: { ...s.docTabTitles, [documentId]: title },
		}));
	},

	hasAnyDocTabDirty: (): boolean => {
		const s = get();
		if (s.isDirty) {
			return true;
		}
		return Object.values(s.docTabSessions).some((x) => x.isDirty);
	},

	initDocTabsFromWindowPayload: (payload: {
		documentIds?: string[];
		documentId?: string;
		activeDocumentId?: string;
		tabTitles?: Record<string, string>;
	}) => {
		const ids =
			payload.documentIds && payload.documentIds.length > 0
				? [...new Set(payload.documentIds)]
				: payload.documentId
					? [payload.documentId]
					: [];
		set({
			docTabOrder: ids,
			docTabTitles: payload.tabTitles ?? {},
		});
	},
});
