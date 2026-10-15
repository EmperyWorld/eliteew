/**
 * Оркестрация совместного редактирования: Socket.IO/Yjs флаги, смена документа, уведомления.
 * Авто-подключение после загрузки — `useDocEditorCollaborationAutoJoinAfterLoad` (ниже по файлу редактора, где есть sync перед Yjs).
 */

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import type { StoreApi } from 'zustand';
import type { EditorStore } from '../store/editorStore';
import type { UltimateDocument } from '../types/editor.types';
import { useCollaboration } from './useCollaboration';

export interface UseDocEditorCollaborationSessionParams {
	notifySuccess: (title: string, message: string) => void;
	currentDocument: UltimateDocument | null | undefined;
	user: { id: string } | null | undefined;
}

export interface UseDocEditorCollaborationSessionResult {
	collabConnected: boolean;
	collabError: string | undefined;
	collabJoin: (
		documentId: string,
		options?: { ownerUserId?: string }
	) => Promise<void>;
	collabLeave: () => Promise<void>;
	collabUpdateCursor: (position: { line: number; column: number }) => void;
	collabKickParticipant: (targetSocketId: string) => void;
	collabMySocketId: string | null;
	collaborationEnabledByUser: boolean;
	setCollaborationEnabledByUser: Dispatch<SetStateAction<boolean>>;
	collabJoinedDocId: string | null;
	setCollabJoinedDocId: Dispatch<SetStateAction<string | null>>;
	collaborationEnabledForEditor: boolean;
	isCollabDocumentOwner: boolean;
	collaborationEnabledByUserRef: MutableRefObject<boolean>;
	collaborationEnabledForEditorRef: MutableRefObject<boolean>;
	collabYjsBootstrapRef: MutableRefObject<boolean>;
	handleCollaborationYjsFailed: () => void;
	autoJoinCollabFromInviteRef: MutableRefObject<boolean>;
}

export function useDocEditorCollaborationSession(
	params: UseDocEditorCollaborationSessionParams
): UseDocEditorCollaborationSessionResult {
	const { notifySuccess, currentDocument, user } = params;

	const [collaborationEnabledByUser, setCollaborationEnabledByUser] =
		useState(false);
	const [collabJoinedDocId, setCollabJoinedDocId] = useState<string | null>(
		null
	);

	const collabYjsBootstrapRef = useRef(false);
	const collaborationEnabledByUserRef = useRef(false);
	const collaborationEnabledForEditorRef = useRef(false);
	const prevDocumentIdRef = useRef<string | null>(null);
	const autoJoinCollabFromInviteRef = useRef(false);

	useEffect(() => {
		autoJoinCollabFromInviteRef.current = false;
	}, []);

	const collaborationEnabledForEditor = useMemo(
		() =>
			collaborationEnabledByUser &&
			!!currentDocument?.id &&
			collabJoinedDocId === currentDocument.id,
		[collaborationEnabledByUser, currentDocument?.id, collabJoinedDocId]
	);

	const isCollabDocumentOwner = useMemo(
		() =>
			Boolean(
				user?.id &&
					currentDocument?.user_id &&
					currentDocument.user_id === user.id
			),
		[user?.id, currentDocument?.user_id]
	);

	useEffect(() => {
		collaborationEnabledByUserRef.current = collaborationEnabledByUser;
	}, [collaborationEnabledByUser]);

	useEffect(() => {
		collaborationEnabledForEditorRef.current = collaborationEnabledForEditor;
	}, [collaborationEnabledForEditor]);

	const onDocEditorSessionEnded = useCallback(() => {
		setCollabJoinedDocId(null);
		setCollaborationEnabledByUser(false);
		collabYjsBootstrapRef.current = false;
		notifySuccess('Совместная сессия', 'Владелец документа завершил сессию.');
	}, [notifySuccess]);

	const onKickedFromDocument = useCallback(() => {
		setCollabJoinedDocId(null);
		setCollaborationEnabledByUser(false);
		collabYjsBootstrapRef.current = false;
		notifySuccess(
			'Совместная сессия',
			'Владелец отключил вас от редактирования.'
		);
	}, [notifySuccess]);

	const {
		isConnected: collabConnected,
		error: collabError,
		join: collabJoin,
		leave: collabLeave,
		updateCursor: collabUpdateCursor,
		kickParticipant: collabKickParticipant,
		mySocketId: collabMySocketId,
	} = useCollaboration({
		onDocEditorSessionEnded,
		onKickedFromDocument,
	});

	// Не подключаемся автоматически: только при ручном нажатии «Подключиться». При смене документа или восстановлении версии — отключаемся.
	useLayoutEffect(() => {
		const docId = currentDocument?.id ?? null;
		if (
			prevDocumentIdRef.current !== null &&
			prevDocumentIdRef.current !== docId
		) {
			setCollabJoinedDocId(null);
			void collabLeave();
			setCollaborationEnabledByUser(false);
			collabYjsBootstrapRef.current = false;
		}
		if (!docId) {
			setCollabJoinedDocId(null);
			void collabLeave();
			setCollaborationEnabledByUser(false);
		}
		if (!docId || !collaborationEnabledByUser) {
			collabYjsBootstrapRef.current = false;
		}
		prevDocumentIdRef.current = docId;
	}, [currentDocument?.id, collabLeave, collaborationEnabledByUser]);

	const handleCollaborationYjsFailed = useCallback(() => {
		setCollabJoinedDocId(null);
		void collabLeave();
		setCollaborationEnabledByUser(false);
	}, [collabLeave]);

	return {
		collabConnected,
		collabError,
		collabJoin,
		collabLeave,
		collabUpdateCursor,
		collabKickParticipant,
		collabMySocketId,
		collaborationEnabledByUser,
		setCollaborationEnabledByUser,
		collabJoinedDocId,
		setCollabJoinedDocId,
		collaborationEnabledForEditor,
		isCollabDocumentOwner,
		collaborationEnabledByUserRef,
		collaborationEnabledForEditorRef,
		collabYjsBootstrapRef,
		handleCollaborationYjsFailed,
		autoJoinCollabFromInviteRef,
	};
}

export interface UseDocEditorCollaborationAutoJoinAfterLoadParams {
	autoJoinCollaborationAfterLoad: boolean;
	loadError: unknown;
	isLoadingDocument: boolean;
	currentDocumentId: string | undefined;
	documentId: string | undefined;
	autoJoinCollabFromInviteRef: MutableRefObject<boolean>;
	collabYjsBootstrapRef: MutableRefObject<boolean>;
	setCollabJoinedDocId: Dispatch<SetStateAction<string | null>>;
	setCollaborationEnabledByUser: Dispatch<SetStateAction<boolean>>;
	syncEditorHtmlToStoreBeforeCollab: () => void;
	collabJoin: (
		documentId: string,
		options?: { ownerUserId?: string }
	) => Promise<void>;
	editorStoreApi: StoreApi<EditorStore>;
}

export function useDocEditorCollaborationAutoJoinAfterLoad(
	params: UseDocEditorCollaborationAutoJoinAfterLoadParams
): void {
	const {
		autoJoinCollaborationAfterLoad,
		loadError,
		isLoadingDocument,
		currentDocumentId,
		documentId,
		autoJoinCollabFromInviteRef,
		collabYjsBootstrapRef,
		setCollabJoinedDocId,
		setCollaborationEnabledByUser,
		syncEditorHtmlToStoreBeforeCollab,
		collabJoin,
		editorStoreApi,
	} = params;

	// Список зависимостей как в монолитном UltimateDocEditor до вынесения: не триггерить повтор на identity refs/setters.
	// biome-ignore lint/correctness/useExhaustiveDependencies: намеренно узкий список (см. волна 2.2)
	useEffect(() => {
		if (
			!autoJoinCollaborationAfterLoad ||
			autoJoinCollabFromInviteRef.current
		) {
			return;
		}
		if (loadError || isLoadingDocument) return;
		const cid = currentDocumentId;
		if (!cid || cid === 'temp') return;
		if (documentId && cid !== documentId) return;
		autoJoinCollabFromInviteRef.current = true;
		collabYjsBootstrapRef.current = true;
		syncEditorHtmlToStoreBeforeCollab();
		setCollabJoinedDocId(cid);
		setCollaborationEnabledByUser(true);
		queueMicrotask(() => {
			const ownerId = editorStoreApi.getState().currentDocument?.user_id;
			void collabJoin(cid, { ownerUserId: ownerId });
		});
	}, [
		autoJoinCollaborationAfterLoad,
		loadError,
		isLoadingDocument,
		currentDocumentId,
		documentId,
		collabJoin,
		syncEditorHtmlToStoreBeforeCollab,
		editorStoreApi.getState,
	]);
}
