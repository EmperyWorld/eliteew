/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zustand slice for Ultimate Doc Editor store (collab).
 *
 * Invariants:
 * - Actions use helpers from `editorStoreHelpers.ts`; no direct React.
 *
 * Related:
 * - `store/editorStore.ts`
 */

import type { StateCreator } from 'zustand';
import type { EditorStore } from '../editorStore';

export const createEditorCollabSlice =
	(): StateCreator<EditorStore, [], [], Partial<EditorStore>> =>
	(set, _get, _api) => ({
		openCollabPanel: () => set({ collabPanelOpen: true }),
		closeCollabPanel: () => set({ collabPanelOpen: false }),

		joinCollaboration: async (_documentId: string) => {
			// Socket.IO join logic will be in useCollaboration hook
			set({ error: undefined });
		},

		leaveCollaboration: async () => {
			// Socket.IO leave logic will be in useCollaboration hook
			set({ activeCollaborators: [] });
		},
	});
