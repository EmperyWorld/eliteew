/**
 * Ручное сохранение (unified file / canonical doc) + сценарий «сохранить и закрыть» из модалки leave.
 */

import type { StoreApi } from 'zustand';
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { emitDesktopFileOpened } from '@/pages/Desktop/hooks/useRecentFiles';
import type { EditorStore } from '../store/editorStore';
import {
	canPersistCanonicalDocument,
	type EditorActions,
	type UltimateDocument,
} from '../types/editor.types';
import type { DocEditorLeaveGuardDecision } from '../utils/docEditorLeaveGuard';

export interface UseDocEditorCanonicalSaveParams {
	flushPendingEditorHtmlToStore: () => void;
	resolveHtmlForSave: () => Promise<string>;
	currentFileId: string | null;
	payloadWantsUnifiedContent: boolean;
	notifyError: (title: string, message: string) => void;
	canPersistUnifiedContent: boolean;
	saveCurrentDocument: (html: string) => Promise<void>;
	editorStoreApi: StoreApi<EditorStore>;
	onSave?: (document: UltimateDocument) => void;
	currentDocument: UltimateDocument | null;
	collaborationEnabledForEditor: boolean;
	updateDocument: EditorActions['updateDocument'];
	isCloseConfirmSaving: boolean;
	setIsCloseConfirmSaving: Dispatch<SetStateAction<boolean>>;
	getLeaveGuardDecision: () => DocEditorLeaveGuardDecision;
	resolveCloseConfirm: (shouldClose: boolean) => void;
}

export interface UseDocEditorCanonicalSaveResult {
	handleSave: () => Promise<void>;
	handleSaveAndCloseConfirm: () => Promise<void>;
}

export function useDocEditorCanonicalSave(
	params: UseDocEditorCanonicalSaveParams
): UseDocEditorCanonicalSaveResult {
	const {
		flushPendingEditorHtmlToStore,
		resolveHtmlForSave,
		currentFileId,
		payloadWantsUnifiedContent,
		notifyError,
		canPersistUnifiedContent,
		saveCurrentDocument,
		editorStoreApi,
		onSave,
		currentDocument,
		collaborationEnabledForEditor,
		updateDocument,
		isCloseConfirmSaving,
		setIsCloseConfirmSaving,
		getLeaveGuardDecision,
		resolveCloseConfirm,
	} = params;

	const handleSave = useCallback(async (): Promise<void> => {
		flushPendingEditorHtmlToStore();
		const htmlContent = await resolveHtmlForSave();
		if (!currentFileId && payloadWantsUnifiedContent) {
			notifyError(
				'Файл загружается',
				'Подождите завершения загрузки файла перед сохранением.'
			);
			return;
		}
		if (currentFileId) {
			if (!canPersistUnifiedContent) {
				notifyError(
					'Сохранение недоступно',
					'У вас нет прав на перезапись этого файла.'
				);
				return;
			}
			await saveCurrentDocument(htmlContent);
			editorStoreApi.setState({ isDirty: false });
			const docAfter = editorStoreApi.getState().currentDocument;
			onSave?.({
				...(docAfter ?? currentDocument ?? {}),
				content: htmlContent,
			} as UltimateDocument);
			return;
		}
		const doc = editorStoreApi.getState().currentDocument;
		if (doc && doc.id !== 'temp') {
			if (!canPersistCanonicalDocument(doc)) {
				notifyError(
					'Сохранение недоступно',
					'Владелец не разрешил сохранять документ соавторам. Правки видны в сессии; в базу их сохранит владелец.'
				);
				return;
			}
			const useForceSave = !collaborationEnabledForEditor;
			await updateDocument(
				{ content: htmlContent },
				useForceSave
					? { forceSave: true }
					: {
							expectedVersion: doc.version ?? doc.version_number ?? null,
						}
			);
			const afterSave = editorStoreApi.getState();
			if (afterSave.documentVersionConflict) {
				notifyError(
					'Конфликт версий',
					'Документ изменился на сервере. Примите серверную версию или сохраните поверх через панель конфликта.'
				);
				return;
			}
			if (afterSave.error) {
				notifyError('Не удалось сохранить', afterSave.error);
				return;
			}
			if (afterSave.isDirty) {
				return;
			}
			const savedDoc = afterSave.currentDocument ?? doc;
			onSave?.({ ...savedDoc, content: htmlContent });
			emitDesktopFileOpened({
				id: savedDoc.id,
				name: savedDoc.title || 'Без названия',
				type: 'document',
				path: `/documents/${savedDoc.id}`,
			});
		}
	}, [
		flushPendingEditorHtmlToStore,
		resolveHtmlForSave,
		currentFileId,
		payloadWantsUnifiedContent,
		notifyError,
		canPersistUnifiedContent,
		saveCurrentDocument,
		editorStoreApi,
		onSave,
		currentDocument,
		collaborationEnabledForEditor,
		updateDocument,
	]);

	const handleSaveAndCloseConfirm = useCallback(async (): Promise<void> => {
		if (isCloseConfirmSaving) {
			return;
		}
		setIsCloseConfirmSaving(true);
		try {
			await handleSave();
			const guardAfterSave = getLeaveGuardDecision();
			if (guardAfterSave.shouldBlock) {
				setIsCloseConfirmSaving(false);
				return;
			}
			resolveCloseConfirm(true);
		} catch {
			setIsCloseConfirmSaving(false);
		}
	}, [
		isCloseConfirmSaving,
		setIsCloseConfirmSaving,
		handleSave,
		getLeaveGuardDecision,
		resolveCloseConfirm,
	]);

	return { handleSave, handleSaveAndCloseConfirm };
}
