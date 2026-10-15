/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Document-level keyboard shortcuts for FAQ focus, composer focus, and modal dismiss.
 *
 * Invariants:
 * - Shortcuts skip when focus is in INPUT, TEXTAREA, or contentEditable.
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - assistantChatConstants.ts ASSISTANT_SHORTCUTS_PANEL_ITEMS
 */
import * as React from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.isContentEditable)
	);
}

export type UseAssistantKeyboardShortcutsInput = {
	faqCount: number;
	/** Wide WebView `#/mobile-handbook` — no document-level `/` or Ctrl+. shortcuts. */
	embeddedMobileLayout?: boolean;
	faqSearchInputRef: React.RefObject<HTMLInputElement | null>;
	inputRef: React.RefObject<HTMLTextAreaElement | null>;
	setFaqMobileOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
	clearConfirmOpen: boolean;
	onDismissClearConfirm: () => void;
};

export function useAssistantKeyboardShortcuts({
	faqCount,
	embeddedMobileLayout = false,
	faqSearchInputRef,
	inputRef,
	setFaqMobileOpen,
	clearConfirmOpen,
	onDismissClearConfirm,
}: UseAssistantKeyboardShortcutsInput): void {
	React.useEffect(() => {
		if (!clearConfirmOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onDismissClearConfirm();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [clearConfirmOpen, onDismissClearConfirm]);

	React.useEffect(() => {
		if (embeddedMobileLayout || faqCount === 0) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
			if (isEditableTarget(e.target)) return;
			e.preventDefault();
			setFaqMobileOpen(true);
			faqSearchInputRef.current?.focus();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [embeddedMobileLayout, faqCount, setFaqMobileOpen, faqSearchInputRef]);

	React.useEffect(() => {
		if (embeddedMobileLayout) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== '.' || !(e.ctrlKey || e.metaKey)) return;
			if (isEditableTarget(e.target)) return;
			e.preventDefault();
			inputRef.current?.focus();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [embeddedMobileLayout, inputRef]);
}
