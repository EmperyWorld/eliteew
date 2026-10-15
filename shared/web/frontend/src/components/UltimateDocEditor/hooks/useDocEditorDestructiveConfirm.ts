/**
 * Подтверждение деструктивных действий (замена window.confirm): desktop modal + Promise.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type DocEditorDestructiveConfirmVariant = 'danger' | 'warning';

export type DocEditorDestructiveConfirmPayload = {
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel: string;
	variant?: DocEditorDestructiveConfirmVariant;
};

export interface UseDocEditorDestructiveConfirmResult {
	requestDestructiveConfirm: (
		payload: DocEditorDestructiveConfirmPayload
	) => Promise<boolean>;
	destructiveConfirmOpen: boolean;
	destructiveConfirmPayload: DocEditorDestructiveConfirmPayload | null;
	resolveDestructiveConfirm: (ok: boolean) => void;
}

export function useDocEditorDestructiveConfirm(): UseDocEditorDestructiveConfirmResult {
	const [open, setOpen] = useState(false);
	const [payload, setPayload] =
		useState<DocEditorDestructiveConfirmPayload | null>(null);
	const pendingRef = useRef<((ok: boolean) => void) | null>(null);

	const requestDestructiveConfirm = useCallback(
		(next: DocEditorDestructiveConfirmPayload): Promise<boolean> => {
			return new Promise<boolean>((resolve) => {
				pendingRef.current = resolve;
				setPayload(next);
				setOpen(true);
			});
		},
		[]
	);

	const resolveDestructiveConfirm = useCallback((ok: boolean): void => {
		const r = pendingRef.current;
		pendingRef.current = null;
		setOpen(false);
		setPayload(null);
		r?.(ok);
	}, []);

	useEffect(() => {
		return () => {
			if (pendingRef.current) {
				pendingRef.current(false);
				pendingRef.current = null;
			}
		};
	}, []);

	return {
		requestDestructiveConfirm,
		destructiveConfirmOpen: open,
		destructiveConfirmPayload: payload,
		resolveDestructiveConfirm,
	};
}
