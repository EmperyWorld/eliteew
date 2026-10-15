/**
 * Действия шапки «Подключиться / Отключить» для коллаба + общий сброс сессии
 * (без flush HTML — его вызывает оркестратор там, где нужно). Волна 6.3.
 */

import {
	useCallback,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';

import type { UltimateDocument } from '../types/editor.types';

export interface UseDocEditorCollabHeaderActionsParams {
	currentDocument: UltimateDocument | null | undefined;
	setCollabJoinedDocId: Dispatch<SetStateAction<string | null>>;
	collabLeave: () => Promise<void>;
	setCollaborationEnabledByUser: Dispatch<SetStateAction<boolean>>;
	collabYjsBootstrapRef: MutableRefObject<boolean>;
	syncEditorHtmlToStoreBeforeCollab: () => void;
	collabJoin: (
		documentId: string,
		options?: { ownerUserId?: string }
	) => Promise<void>;
	/** Flush canonical save перед сбросом сессии (владелец + dirty). */
	onBeforeDisconnect?: () => void | Promise<void>;
}

export interface UseDocEditorCollabHeaderActionsResult {
	onCollabConnect: () => void;
	/** Сброс локального состояния коллаба (после опционального flush в оркестраторе). */
	disconnectCollabSession: () => void;
}

export function useDocEditorCollabHeaderActions(
	params: UseDocEditorCollabHeaderActionsParams
): UseDocEditorCollabHeaderActionsResult {
	const {
		currentDocument,
		setCollabJoinedDocId,
		collabLeave,
		setCollaborationEnabledByUser,
		collabYjsBootstrapRef,
		syncEditorHtmlToStoreBeforeCollab,
		collabJoin,
		onBeforeDisconnect,
	} = params;

	const disconnectCollabSession = useCallback(() => {
		void (async () => {
			try {
				await onBeforeDisconnect?.();
			} catch {
				// disconnect proceeds even if flush failed
			}
			setCollabJoinedDocId(null);
			await collabLeave();
			setCollaborationEnabledByUser(false);
		})();
	}, [
		onBeforeDisconnect,
		setCollabJoinedDocId,
		collabLeave,
		setCollaborationEnabledByUser,
	]);

	const onCollabConnect = useCallback(() => {
		const cid = currentDocument?.id;
		if (!cid) return;
		collabYjsBootstrapRef.current = true;
		syncEditorHtmlToStoreBeforeCollab();
		setCollabJoinedDocId(cid);
		setCollaborationEnabledByUser(true);
		void collabJoin(cid, {
			ownerUserId: currentDocument?.user_id,
		});
	}, [
		currentDocument?.id,
		currentDocument?.user_id,
		setCollabJoinedDocId,
		collabYjsBootstrapRef,
		syncEditorHtmlToStoreBeforeCollab,
		setCollaborationEnabledByUser,
		collabJoin,
	]);

	return { onCollabConnect, disconnectCollabSession };
}
