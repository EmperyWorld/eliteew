/**
 * Leave guard (beforeunload), desktop window beforeClose, and unsaved close confirm.
 */

import type { BeforeCloseHandler } from '@/pages/Desktop/types/desktop.types';
import { telemetryDocEditorLeaveGuard } from '@/pages/Desktop/utils/desktopTelemetry';
import type { StoreApi } from 'zustand';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';
import type { EditorStore } from '../store/editorStore';
import {
	type DocEditorLeaveGuardDecision,
	resolveDocEditorLeaveGuardDecision,
} from '../utils/docEditorLeaveGuard';

export interface UseDocEditorLeaveAndCloseConfirmParams {
	editorStoreApi: StoreApi<EditorStore>;
	openTargetRequestId?: string;
	onClose?: () => void;
	flushPendingEditorHtmlToStore: () => void;
	registerBeforeClose?: (fn: BeforeCloseHandler) => void;
	unregisterBeforeClose?: () => void;
}

export interface UseDocEditorLeaveAndCloseConfirmResult {
	getLeaveGuardDecision: () => DocEditorLeaveGuardDecision;
	showCloseConfirm: boolean;
	isCloseConfirmSaving: boolean;
	setIsCloseConfirmSaving: Dispatch<SetStateAction<boolean>>;
	openDirectCloseConfirm: () => void;
	requestWindowCloseConfirm: () => Promise<boolean>;
	resolveCloseConfirm: (shouldClose: boolean) => void;
}

export function useDocEditorLeaveAndCloseConfirm(
	params: UseDocEditorLeaveAndCloseConfirmParams
): UseDocEditorLeaveAndCloseConfirmResult {
	const {
		editorStoreApi,
		openTargetRequestId,
		onClose,
		flushPendingEditorHtmlToStore,
		registerBeforeClose,
		unregisterBeforeClose,
	} = params;

	const [showCloseConfirm, setShowCloseConfirm] = useState(false);
	const [isCloseConfirmSaving, setIsCloseConfirmSaving] = useState(false);

	const closeConfirmResolverRef = useRef<((ok: boolean) => void) | null>(null);
	const closeConfirmModeRef = useRef<'direct' | 'window' | null>(null);
	const bypassNextBeforeCloseRef = useRef(false);
	const showCloseConfirmRef = useRef(false);
	const unregisterBeforeCloseRef = useRef<(() => void) | null>(null);

	const getLeaveGuardDecision = useCallback((): DocEditorLeaveGuardDecision => {
		const st = editorStoreApi.getState();
		return resolveDocEditorLeaveGuardDecision({
			isLoadingDocument: st.isLoadingDocument,
			isSaving: st.isSaving,
			hasCurrentDocument: Boolean(st.currentDocument),
			tabCount: st.docTabOrder.length,
			sessionCount: Object.keys(st.docTabSessions).length,
			hasAnyDocTabDirty: st.hasAnyDocTabDirty(),
		});
	}, [editorStoreApi]);

	useEffect(() => {
		const handler = (e: BeforeUnloadEvent): void => {
			const guard = getLeaveGuardDecision();
			if (!guard.shouldBlock) {
				return;
			}
			telemetryDocEditorLeaveGuard({
				channel: 'beforeunload',
				reason: guard.reason,
				blocked: true,
				requestId: openTargetRequestId,
			});
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	}, [getLeaveGuardDecision, openTargetRequestId]);

	const openDirectCloseConfirm = useCallback((): void => {
		if (showCloseConfirmRef.current) {
			return;
		}
		closeConfirmModeRef.current = 'direct';
		showCloseConfirmRef.current = true;
		setShowCloseConfirm(true);
	}, []);

	const requestWindowCloseConfirm = useCallback((): Promise<boolean> => {
		if (
			showCloseConfirmRef.current &&
			closeConfirmModeRef.current === 'window'
		) {
			return Promise.resolve(false);
		}

		closeConfirmModeRef.current = 'window';
		showCloseConfirmRef.current = true;
		setShowCloseConfirm(true);

		return new Promise<boolean>((resolve) => {
			closeConfirmResolverRef.current = resolve;
		});
	}, []);

	const resolveCloseConfirm = useCallback(
		(shouldClose: boolean): void => {
			const mode = closeConfirmModeRef.current;
			const resolver = closeConfirmResolverRef.current;

			closeConfirmModeRef.current = null;
			closeConfirmResolverRef.current = null;
			showCloseConfirmRef.current = false;
			setShowCloseConfirm(false);
			setIsCloseConfirmSaving(false);

			if (resolver) {
				resolver(shouldClose);
				return;
			}

			if (shouldClose && mode === 'direct' && onClose) {
				bypassNextBeforeCloseRef.current = true;
				onClose();
			}
		},
		[onClose]
	);

	useEffect(() => {
		return () => {
			if (closeConfirmResolverRef.current) {
				closeConfirmResolverRef.current(false);
				closeConfirmResolverRef.current = null;
			}
			closeConfirmModeRef.current = null;
			showCloseConfirmRef.current = false;
		};
	}, []);

	useEffect(() => {
		if (!showCloseConfirm) {
			return;
		}

		const handleEscape = (event: KeyboardEvent): void => {
			if (isCloseConfirmSaving) {
				return;
			}
			if (event.key === 'Escape') {
				resolveCloseConfirm(false);
			}
		};

		document.addEventListener('keydown', handleEscape, true);
		return (): void => {
			document.removeEventListener('keydown', handleEscape, true);
		};
	}, [showCloseConfirm, isCloseConfirmSaving, resolveCloseConfirm]);

	useEffect(() => {
		if (
			typeof registerBeforeClose !== 'function' ||
			typeof unregisterBeforeClose !== 'function'
		) {
			return;
		}
		const fn: BeforeCloseHandler = (): Promise<boolean> | boolean => {
			try {
				if (bypassNextBeforeCloseRef.current) {
					bypassNextBeforeCloseRef.current = false;
					return true;
				}
				flushPendingEditorHtmlToStore();
				const guard = getLeaveGuardDecision();
				if (!guard.shouldBlock) return true;
				telemetryDocEditorLeaveGuard({
					channel: 'window_close',
					reason: guard.reason,
					blocked: true,
					requestId: openTargetRequestId,
				});
				return requestWindowCloseConfirm();
			} catch {
				return true;
			}
		};
		registerBeforeClose(fn);
		unregisterBeforeCloseRef.current = unregisterBeforeClose;
		return () => {
			const unreg = unregisterBeforeCloseRef.current;
			unregisterBeforeCloseRef.current = null;
			queueMicrotask(() => {
				try {
					if (typeof unreg === 'function') unreg();
				} catch {
					// Игнорируем ошибки при размонтировании
				}
			});
		};
	}, [
		registerBeforeClose,
		unregisterBeforeClose,
		requestWindowCloseConfirm,
		flushPendingEditorHtmlToStore,
		getLeaveGuardDecision,
		openTargetRequestId,
	]);

	return {
		getLeaveGuardDecision,
		showCloseConfirm,
		isCloseConfirmSaving,
		setIsCloseConfirmSaving,
		openDirectCloseConfirm,
		requestWindowCloseConfirm,
		resolveCloseConfirm,
	};
}
