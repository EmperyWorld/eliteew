/**
 * Вкладки документов (embedded doc_editor): смена с flush + сброс коллаба, закрытие с confirm и dirty. Волна 6.4.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { telemetryDocEditorTabSwitch } from '@/pages/Desktop/utils/desktopTelemetry';
import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import type { StoreApi } from 'zustand';

import type { DocEditorDestructiveConfirmPayload } from './useDocEditorDestructiveConfirm';
import type { EditorStore } from '../store/editorStore';

export interface UseDocEditorDocTabsOrchestrationParams {
	editorStoreApi: StoreApi<EditorStore>;
	flushPendingEditorHtmlToStore: () => void;
	removeDocTab: (tabId: string) => void;
	switchDocTab: (tabId: string) => Promise<void>;
	collaborationEnabledForEditor: boolean;
	currentDocumentId: string | undefined;
	documentSource: string | null;
	openTargetRequestId: string | undefined;
	disconnectCollabSession: () => void;
	requestDestructiveConfirm: (
		payload: DocEditorDestructiveConfirmPayload
	) => Promise<boolean>;
}

export interface UseDocEditorDocTabsOrchestrationResult {
	handleRemoveDocTab: (tid: string) => void | Promise<void>;
	handleSwitchDocTab: (tid: string) => void | Promise<void>;
}

export function useDocEditorDocTabsOrchestration(
	params: UseDocEditorDocTabsOrchestrationParams
): UseDocEditorDocTabsOrchestrationResult {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const {
		editorStoreApi,
		flushPendingEditorHtmlToStore,
		removeDocTab,
		switchDocTab,
		collaborationEnabledForEditor,
		currentDocumentId,
		documentSource,
		openTargetRequestId,
		disconnectCollabSession,
		requestDestructiveConfirm,
	} = params;

	const handleRemoveDocTab = useCallback(
		async (tid: string) => {
			const st = editorStoreApi.getState();
			const dirty =
				tid === st.currentDocument?.id
					? st.isDirty
					: Boolean(st.docTabSessions[tid]?.isDirty);
			if (dirty) {
				const ok = await requestDestructiveConfirm({
					title: t('destructiveConfirm.closeTabTitle'),
					message: t('destructiveConfirm.closeTabMessage'),
					confirmLabel: t('destructiveConfirm.closeTab'),
					cancelLabel: t('destructiveConfirm.cancel'),
					variant: 'danger',
				});
				if (!ok) return;
			}
			if (tid === st.currentDocument?.id) {
				flushPendingEditorHtmlToStore();
			}
			removeDocTab(tid);
		},
		[
			editorStoreApi,
			flushPendingEditorHtmlToStore,
			removeDocTab,
			requestDestructiveConfirm,
			t,
		]
	);

	const handleSwitchDocTab = useCallback(
		async (tid: string) => {
			if (tid === currentDocumentId) return;
			if (collaborationEnabledForEditor) {
				const ok = await requestDestructiveConfirm({
					title: t('destructiveConfirm.switchDocCollabTitle'),
					message: t('destructiveConfirm.switchDocCollabMessage'),
					confirmLabel: t('destructiveConfirm.continue'),
					cancelLabel: t('destructiveConfirm.cancel'),
					variant: 'warning',
				});
				if (!ok) return;
			}
			telemetryDocEditorTabSwitch({
				fromTargetType:
					documentSource === 'unified_content' ? 'unifiedContent' : 'docEditor',
				toTargetType: 'docEditor',
				requestId: openTargetRequestId,
			});
			flushPendingEditorHtmlToStore();
			disconnectCollabSession();
			void switchDocTab(tid);
		},
		[
			flushPendingEditorHtmlToStore,
			switchDocTab,
			collaborationEnabledForEditor,
			currentDocumentId,
			documentSource,
			openTargetRequestId,
			disconnectCollabSession,
			requestDestructiveConfirm,
			t,
		]
	);

	return { handleRemoveDocTab, handleSwitchDocTab };
}
