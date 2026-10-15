/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mounts SSO session-replace modal and registers prompt handler for HTTP/Socket coordinator.
 *
 * Invariants:
 * - Handler unregistered on unmount; only one in-flight modal prompt at a time.
 *
 * Related:
 * - contexts/AuthContext.tsx, services/auth/ssoSessionReplaceConfirmBridge.ts
 */

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
	registerSessionReplacePromptHandler,
	unregisterSessionReplacePromptHandler,
} from '@/services/auth/ssoSessionReplaceConfirmBridge';
import { SsoSessionReplaceConfirmDialog } from './SsoSessionReplaceConfirmDialog';

export function SsoSessionReplaceConfirmHost(): ReactNode {
	const [open, setOpen] = useState(false);
	const [resolving, setResolving] = useState(false);
	const pendingRef = useRef<((confirmed: boolean) => void) | null>(null);

	const resolvePrompt = useCallback((confirmed: boolean): void => {
		const resolve = pendingRef.current;
		pendingRef.current = null;
		setOpen(false);
		setResolving(false);
		resolve?.(confirmed);
	}, []);

	const requestPrompt = useCallback((): Promise<boolean> => {
		if (pendingRef.current) {
			return new Promise<boolean>((resolve) => {
				const prior = pendingRef.current;
				pendingRef.current = (confirmed) => {
					prior?.(confirmed);
					resolve(confirmed);
				};
			});
		}
		return new Promise<boolean>((resolve) => {
			pendingRef.current = resolve;
			setOpen(true);
		});
	}, []);

	useEffect(() => {
		registerSessionReplacePromptHandler(requestPrompt);
		return (): void => {
			unregisterSessionReplacePromptHandler();
			if (pendingRef.current) {
				pendingRef.current(false);
				pendingRef.current = null;
			}
		};
	}, [requestPrompt]);

	if (typeof document === 'undefined') {
		return null;
	}

	return createPortal(
		<SsoSessionReplaceConfirmDialog
			open={open}
			resolving={resolving}
			onCancel={() => resolvePrompt(false)}
			onConfirm={() => {
				setResolving(true);
				resolvePrompt(true);
			}}
		/>,
		document.body
	);
}
