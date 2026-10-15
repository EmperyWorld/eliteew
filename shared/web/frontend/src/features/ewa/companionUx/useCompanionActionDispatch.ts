/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companion SPA action dispatch + actions tray state (U8.3 slice 7 extract from `EwaCompanionChatPanel`).
 *
 * Invariants:
 * - Tray keeps last 3 undo cards; blocked/failed wire actions become notice rows without desktop side effects.
 * - Undo reverses open/close/focus/minimize via desktop deep-link helpers.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionActionsTray.tsx
 * - src/features/ewa/companionActionTrayUi.ts
 * - src/features/ewa/companionUx/useCompanionEmbeddedDocumentSurface.ts
 */

import { useCallback, useRef, useState } from 'react';

import {
	readCompanionActionTaskRunId,
	shouldShowOutcomeBadge,
	stampCompanionActionsWithTaskRunId,
} from '@/features/ewa/companionActionsTray';
import { dispatchCompanionMusicPlayTrackAction } from '@/features/ewa/companionActionDispatch';
import type {
	CompanionActionKind,
	CompanionActionRecord,
} from '@/features/ewa/companionActionTrayUi';
import type { ContentManagerInitialFilterSnapshot } from '@/pages/Desktop/types/desktop.types';
import {
	dispatchDocEditorCompanionSetBody,
	type DesktopOpenAppDetail,
	requestCloseDesktopAppLatest,
	requestFocusDesktopAppLatest,
	requestMinimizeDesktopAppLatest,
	requestOpenDesktopApp,
} from '@/pages/Desktop/utils/desktopDeepLink';
import type {
	CompanionChatAction,
	EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';
import type { CompanionEmbeddedDocumentSurfaceInput } from '@/features/ewa/companionUx/useCompanionEmbeddedDocumentSurface';
import { requestContentManagerLibraryRefresh } from '@/services/unifiedContentEvents';

export type OpenEmbeddedDocumentSurfaceInput =
	CompanionEmbeddedDocumentSurfaceInput;

export type UseCompanionActionDispatchOptions = {
	openEmbeddedDocumentSurface: (
		input: CompanionEmbeddedDocumentSurfaceInput
	) => void;
};

export function useCompanionActionDispatch({
	openEmbeddedDocumentSurface,
}: UseCompanionActionDispatchOptions) {
	const [actionRecords, setActionRecords] = useState<CompanionActionRecord[]>(
		[]
	);
	const [actionsExpanded, setActionsExpanded] = useState(false);
	const actionSeqRef = useRef(0);

	const dispatchActions = useCallback(
		(
			actions: CompanionChatAction[] | undefined,
			taskRun?: EwaCompanionTaskRun | null
		) => {
			if (!actions || actions.length === 0) return;
			const stamped = stampCompanionActionsWithTaskRunId(actions, taskRun);
			const additions: CompanionActionRecord[] = [];
			let openedContentManager = false;
			const pushTrayRecord = (
				record: Omit<CompanionActionRecord, 'id' | 'closed'>,
				sourceAction?: CompanionChatAction
			) => {
				const seq = actionSeqRef.current++;
				const taskRunId =
					record.taskRunId ??
					(sourceAction
						? readCompanionActionTaskRunId(sourceAction)
						: undefined);
				additions.push({
					id: `${record.kind}-${record.appComponent || 'notice'}-${Date.now()}-${seq}`,
					closed: false,
					...record,
					...(taskRunId ? { taskRunId } : {}),
				});
			};
			for (const action of stamped) {
				if (action.type === 'companion_action_notice') {
					pushTrayRecord(
						{
							kind: 'notice',
							appComponent: '',
							rationale: action.rationale,
							outcome: action.outcome ?? 'failed',
						},
						action
					);
					continue;
				}
				const actionOutcome = action.outcome;
				const skipDispatch =
					actionOutcome === 'blocked' || actionOutcome === 'failed';
				if (action.type === 'doc_editor_set_body') {
					if (!skipDispatch) {
						dispatchDocEditorCompanionSetBody({
							bodyHtml: action.body_html,
							...(action.unified_content_id?.trim()
								? { unifiedContentId: action.unified_content_id.trim() }
								: {}),
							...(action.rationale ? { rationale: action.rationale } : {}),
						});
						openEmbeddedDocumentSurface({
							unifiedContentId: action.unified_content_id,
							initialHtml: action.body_html,
							rationale: action.rationale,
						});
					} else {
						pushTrayRecord(
							{
								kind: 'notice',
								appComponent: action.app_component,
								rationale: action.rationale,
								outcome: actionOutcome,
							},
							action
						);
					}
					continue;
				}
				if (action.type === 'music_play_track') {
					const tid = action.unified_content_id?.trim();
					if (!tid) continue;
					if (!dispatchCompanionMusicPlayTrackAction(action)) {
						pushTrayRecord(
							{
								kind: 'notice',
								appComponent: 'MusicPlayer',
								rationale: action.rationale,
								outcome: actionOutcome,
							},
							action
						);
					}
					continue;
				}
				const component = action.app_component;
				if (!component) continue;
				let kind: CompanionActionKind;
				let unifiedContentId: string | undefined;
				let contentManagerFocusUnifiedContentId: string | undefined;
				let contentManagerInitialFilter:
					| ContentManagerInitialFilterSnapshot
					| undefined;

				if (action.type === 'open_app') {
					kind = 'open';
					const uc = action.unified_content_id?.trim();
					const cm = action.content_manager_focus_unified_content_id?.trim();
					const cfs =
						action.content_manager_initial_filter?.search_query?.trim();
					const cmFolder = action.content_manager_folder_item_id?.trim();
					const ewrpJobId = action.ewrp_job_id?.trim();
					if (!skipDispatch) {
						const detail: DesktopOpenAppDetail = { appComponent: component };
						if (uc) detail.unifiedContentId = uc;
						if (cm) detail.contentManagerFocusUnifiedContentId = cm;
						if (cmFolder) detail.contentManagerFolderItemId = cmFolder;
						if (ewrpJobId) detail.ewrpJobId = ewrpJobId;
						if (
							component.trim().toLowerCase() === 'contentmanagerpro' &&
							cfs &&
							detail.contentManagerInitialFilter === undefined
						) {
							const snap: ContentManagerInitialFilterSnapshot = {
								searchQuery: cfs.slice(0, 500),
							};
							detail.contentManagerInitialFilter = snap;
							contentManagerInitialFilter = snap;
						}
						const isDocEditor = component.trim().toLowerCase() === 'doceditor';
						/** Unified Workspace: with unified_content_id, stay in-companion unless open_on_desk. */
						const forceOpenOnDesk = Boolean(action.open_on_desk);
						const companionSurfaceOnly = Boolean(action.companion_surface_only);
						const skipDesktopOpen =
							isDocEditor &&
							!forceOpenOnDesk &&
							(Boolean(uc) || companionSurfaceOnly);
						if (!skipDesktopOpen) {
							requestOpenDesktopApp(detail);
						}
						if (component.trim().toLowerCase() === 'contentmanagerpro') {
							openedContentManager = true;
						}
						if (isDocEditor && uc) {
							openEmbeddedDocumentSurface({
								unifiedContentId: uc,
								rationale: action.rationale,
							});
						}
						unifiedContentId = uc;
						contentManagerFocusUnifiedContentId = cm;
					}
				} else if (action.type === 'close_app') {
					kind = 'close';
					if (!skipDispatch) {
						requestCloseDesktopAppLatest(component);
					}
				} else if (action.type === 'focus_app') {
					kind = 'focus';
					if (!skipDispatch) {
						requestFocusDesktopAppLatest(component);
					}
				} else if (action.type === 'minimize_app') {
					kind = 'minimize';
					if (!skipDispatch) {
						requestMinimizeDesktopAppLatest(component);
					}
				} else {
					continue;
				}
				pushTrayRecord(
					{
						kind: skipDispatch ? 'notice' : kind,
						appComponent: component,
						rationale: action.rationale,
						...(actionOutcome ? { outcome: actionOutcome } : {}),
						...(unifiedContentId ? { unifiedContentId } : {}),
						...(contentManagerFocusUnifiedContentId
							? { contentManagerFocusUnifiedContentId }
							: {}),
						...(contentManagerInitialFilter
							? { contentManagerInitialFilter }
							: {}),
					},
					action
				);
			}
			if (additions.length > 0) {
				setActionRecords((prev) => [...prev, ...additions].slice(-3));
			}
			if (openedContentManager) {
				queueMicrotask(() => requestContentManagerLibraryRefresh());
			}
		},
		[openEmbeddedDocumentSurface]
	);

	const handleUndoAction = useCallback((record: CompanionActionRecord) => {
		if (record.closed) return;
		if (
			record.kind === 'notice' ||
			record.kind === 'web_search' ||
			shouldShowOutcomeBadge(record.outcome)
		) {
			setActionRecords((prev) =>
				prev.map((row) =>
					row.id === record.id ? { ...row, closed: true } : row
				)
			);
			return;
		}
		if (record.kind === 'open') {
			requestCloseDesktopAppLatest(record.appComponent);
		} else if (record.kind === 'close') {
			const detail: DesktopOpenAppDetail = {
				appComponent: record.appComponent,
			};
			if (record.unifiedContentId?.trim())
				detail.unifiedContentId = record.unifiedContentId.trim();
			if (record.contentManagerFocusUnifiedContentId?.trim())
				detail.contentManagerFocusUnifiedContentId =
					record.contentManagerFocusUnifiedContentId.trim();
			if (record.contentManagerInitialFilter?.searchQuery?.trim())
				detail.contentManagerInitialFilter = {
					searchQuery: record.contentManagerInitialFilter.searchQuery.trim(),
				};
			requestOpenDesktopApp(detail);
		} else if (record.kind === 'focus') {
			requestMinimizeDesktopAppLatest(record.appComponent);
		} else {
			requestFocusDesktopAppLatest(record.appComponent);
		}
		setActionRecords((prev) =>
			prev.map((row) => (row.id === record.id ? { ...row, closed: true } : row))
		);
	}, []);

	return {
		actionRecords,
		setActionRecords,
		actionsExpanded,
		setActionsExpanded,
		dispatchActions,
		handleUndoAction,
	};
}
