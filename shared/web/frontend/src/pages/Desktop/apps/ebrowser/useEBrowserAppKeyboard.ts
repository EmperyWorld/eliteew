/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EBrowser chrome keyboard shortcuts (Ctrl/Cmd L T W F +/− 0).
 */

import { useEffect, type RefObject } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	return target.isContentEditable;
}

export function useEBrowserAppKeyboard(args: {
	enabled: boolean;
	opened: boolean;
	addressInputRef: RefObject<HTMLInputElement | null>;
	findInputRef: RefObject<HTMLInputElement | null>;
	findOpen: boolean;
	onOpenFind: () => void;
	onCloseFind: () => void;
	onNewTab: () => void;
	onCloseActiveTab: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onZoomReset: () => void;
}): void {
	useEffect(() => {
		if (!args.enabled) return;
		const onKey = (e: KeyboardEvent) => {
			const mod = e.ctrlKey || e.metaKey;
			if (!mod) {
				if (e.key === 'Escape' && args.findOpen) {
					e.preventDefault();
					args.onCloseFind();
				}
				return;
			}
			const key = e.key.toLowerCase();
			const inFindInput =
				args.findInputRef.current != null &&
				e.target === args.findInputRef.current;

			// Dual-flag: while typing the find query, only Ctrl/Cmd+F (and Esc) apply.
			if (inFindInput && key !== 'f') {
				return;
			}

			if (key === 'f' && args.opened) {
				e.preventDefault();
				args.onOpenFind();
				return;
			}
			if (key === 'l') {
				e.preventDefault();
				args.addressInputRef.current?.focus();
				args.addressInputRef.current?.select();
				return;
			}
			if (key === 't') {
				e.preventDefault();
				args.onNewTab();
				return;
			}
			if (key === 'w' && args.opened) {
				e.preventDefault();
				args.onCloseActiveTab();
				return;
			}
			if (isEditableTarget(e.target)) {
				return;
			}
			if ((key === '=' || key === '+') && args.opened) {
				e.preventDefault();
				args.onZoomIn();
				return;
			}
			if (key === '-' && args.opened) {
				e.preventDefault();
				args.onZoomOut();
				return;
			}
			if (key === '0' && args.opened) {
				e.preventDefault();
				args.onZoomReset();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [
		args.enabled,
		args.opened,
		args.findOpen,
		args.addressInputRef,
		args.findInputRef,
		args.onOpenFind,
		args.onCloseFind,
		args.onNewTab,
		args.onCloseActiveTab,
		args.onZoomIn,
		args.onZoomOut,
		args.onZoomReset,
	]);
}
