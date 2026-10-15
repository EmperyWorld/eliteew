/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell state hydration, refresh, and expansion PATCH pipeline for settings hook.
 *
 * Invariants:
 * - Online patches go through scheduleShellStateMutation({ source: 'expansion', merge }).
 * - Does not clear expansion error before refresh/patch completes (412 race).
 *
 * Related:
 * - desktopShellStateMutationPipeline.ts
 */

import {
	useCallback,
	useEffect,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';
import {
	fetchDesktopShellStateDeduplicated,
	isDesktopShellStateConflictError,
	isDesktopShellStateConflictMessage,
} from '../../services/desktopApi';
import { enqueueDesktopPersistShellPatch } from '../../utils/desktopPersistPatchQueue';
import {
	flushShellStatePipelineNow,
	scheduleShellStateMutation,
	setShellStatePipelineFlushFailureHook,
	subscribeShellStatePipeline,
} from '../../utils/desktopShellStateMutationPipeline';
import type { PersistedWindowState } from '../../types/desktop.types';
import type {
	DesktopAppCollection,
	DesktopAssistantContextAction,
	DesktopContentShortcut,
	DesktopWidgetsLayout,
	DesktopWindowLayoutPreset,
	DesktopWorkspaceProfile,
	DesktopUserVisualStylePreset,
} from '../../types/desktopExpansion.types';
import type {
	ExpansionShellState,
	ExpansionShellStatePatch,
} from '../../types/desktopShellStatePatch.types';
import { getWindowsArrayFromShellSnapshot } from '../../utils/desktopWindowsSnapshot';
import {
	DEFAULT_WIDGET_SLOTS,
	normalizeWidgetsLayout,
} from '../../utils/desktopWidgetLayoutUtils';
import { DEFAULT_ASSISTANT_ACTIONS } from './constants';
import {
	normalizeList,
	normalizeVisualStylePresets,
	normalizeWorkspaceProfiles,
} from './normalizers';

export type DesktopExpansionShellCore = {
	workspaceProfiles: DesktopWorkspaceProfile[];
	setWorkspaceProfiles: Dispatch<SetStateAction<DesktopWorkspaceProfile[]>>;
	sessionSnapshotWindows: PersistedWindowState[];
	windowLayoutPresets: DesktopWindowLayoutPreset[];
	setWindowLayoutPresets: Dispatch<SetStateAction<DesktopWindowLayoutPreset[]>>;
	widgetsLayout: DesktopWidgetsLayout;
	setWidgetsLayout: Dispatch<SetStateAction<DesktopWidgetsLayout>>;
	appCollections: DesktopAppCollection[];
	setAppCollections: Dispatch<SetStateAction<DesktopAppCollection[]>>;
	contentShortcuts: DesktopContentShortcut[];
	setContentShortcuts: Dispatch<SetStateAction<DesktopContentShortcut[]>>;
	assistantContextActions: DesktopAssistantContextAction[];
	setAssistantContextActions: Dispatch<
		SetStateAction<DesktopAssistantContextAction[]>
	>;
	visualStylePresets: DesktopUserVisualStylePreset[];
	setVisualStylePresets: Dispatch<
		SetStateAction<DesktopUserVisualStylePreset[]>
	>;
	isLoading: boolean;
	isSaving: boolean;
	error: string | null;
	patchExpansion: (patch: ExpansionShellStatePatch) => Promise<void>;
	refresh: () => Promise<void>;
};

export function useDesktopExpansionShellCore(params: {
	isOnline: boolean;
	persistSubjectKey: string | null;
}): DesktopExpansionShellCore {
	const { isOnline, persistSubjectKey } = params;

	const [workspaceProfiles, setWorkspaceProfiles] = useState<
		DesktopWorkspaceProfile[]
	>([]);
	const [sessionSnapshotWindows, setSessionSnapshotWindows] = useState<
		PersistedWindowState[]
	>([]);
	const [windowLayoutPresets, setWindowLayoutPresets] = useState<
		DesktopWindowLayoutPreset[]
	>([]);
	const [widgetsLayout, setWidgetsLayout] = useState<DesktopWidgetsLayout>({
		slots: DEFAULT_WIDGET_SLOTS,
		perWorkspace: false,
	});
	const [appCollections, setAppCollections] = useState<DesktopAppCollection[]>(
		[]
	);
	const [contentShortcuts, setContentShortcuts] = useState<
		DesktopContentShortcut[]
	>([]);
	const [assistantContextActions, setAssistantContextActions] = useState<
		DesktopAssistantContextAction[]
	>(DEFAULT_ASSISTANT_ACTIONS);
	const [visualStylePresets, setVisualStylePresets] = useState<
		DesktopUserVisualStylePreset[]
	>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const applyShellState = useCallback((state: ExpansionShellState) => {
		setWorkspaceProfiles(normalizeWorkspaceProfiles(state.workspace_profiles));
		setSessionSnapshotWindows(
			getWindowsArrayFromShellSnapshot(state.windows_snapshot)
		);
		setWindowLayoutPresets(
			normalizeList<DesktopWindowLayoutPreset>(
				state.window_layout_presets
			).slice(0, 24)
		);
		setWidgetsLayout(normalizeWidgetsLayout(state.widgets_layout));
		setAppCollections(
			normalizeList<DesktopAppCollection>(state.app_collections).slice(0, 24)
		);
		setContentShortcuts(
			normalizeList<DesktopContentShortcut>(state.content_shortcuts).slice(
				0,
				48
			)
		);
		const actions = normalizeList<DesktopAssistantContextAction>(
			state.assistant_context_actions
		);
		setAssistantContextActions(
			actions.length > 0 ? actions : DEFAULT_ASSISTANT_ACTIONS
		);
		setVisualStylePresets(
			normalizeVisualStylePresets(state.visual_style_presets)
		);
	}, []);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const state =
				(await fetchDesktopShellStateDeduplicated()) as ExpansionShellState;
			applyShellState(state);
			setError(null);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'desktop shell-state failed'
			);
		} finally {
			setIsLoading(false);
		}
	}, [applyShellState]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		return subscribeShellStatePipeline((snapshot) => {
			if (snapshot.phase === 'conflict' && snapshot.lastConflict) {
				setError(snapshot.lastConflict.message);
				return;
			}
			if (snapshot.phase === 'idle' && !snapshot.lastConflict) {
				setError((prev) =>
					prev != null && isDesktopShellStateConflictMessage(prev) ? null : prev
				);
			}
		});
	}, []);

	useEffect(() => {
		setShellStatePipelineFlushFailureHook(({ sources, error: flushError }) => {
			if (!sources.includes('expansion')) return;
			const message =
				flushError instanceof Error
					? flushError.message
					: 'desktop shell-state failed';
			setError(message);
		});
		return () => setShellStatePipelineFlushFailureHook(null);
	}, []);

	const patchExpansion = useCallback(
		async (patch: ExpansionShellStatePatch) => {
			setIsSaving(true);
			const patchRecord = patch as Record<string, unknown>;

			try {
				if (persistSubjectKey && !isOnline) {
					enqueueDesktopPersistShellPatch(persistSubjectKey, patchRecord);
					return;
				}

				scheduleShellStateMutation({
					source: 'expansion',
					merge: () => patchRecord,
				});
				await flushShellStatePipelineNow();
				const next =
					(await fetchDesktopShellStateDeduplicated()) as ExpansionShellState;
				applyShellState(next);
				setError(null);
			} catch (err) {
				if (isDesktopShellStateConflictError(err)) {
					return;
				}
				if (persistSubjectKey) {
					enqueueDesktopPersistShellPatch(persistSubjectKey, patchRecord);
				}
				const message =
					err instanceof Error ? err.message : 'desktop shell-state failed';
				setError(message);
			} finally {
				setIsSaving(false);
			}
		},
		[applyShellState, isOnline, persistSubjectKey]
	);

	return {
		workspaceProfiles,
		setWorkspaceProfiles,
		sessionSnapshotWindows,
		windowLayoutPresets,
		setWindowLayoutPresets,
		widgetsLayout,
		setWidgetsLayout,
		appCollections,
		setAppCollections,
		contentShortcuts,
		setContentShortcuts,
		assistantContextActions,
		setAssistantContextActions,
		visualStylePresets,
		setVisualStylePresets,
		isLoading,
		isSaving,
		error,
		patchExpansion,
		refresh,
	};
}
