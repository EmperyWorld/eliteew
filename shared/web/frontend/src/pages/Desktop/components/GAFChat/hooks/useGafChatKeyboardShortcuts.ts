/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Global GAF Chat keyboard shortcuts: Alt+arrow chat nav, Ctrl+F/K/G, Escape clears reply/search.
 *
 * Invariants:
 * - Shortcuts are suppressed while modals, voice recording, or focused text fields block navigation.
 *
 * Related:
 * - GAFChatApp.tsx · useGafChatThreadSearch.ts
 */
import {
	useCallback,
	useEffect,
	type Dispatch,
	type MutableRefObject,
	type RefObject,
	type SetStateAction,
} from 'react';
import type { GafPendingComposerAttachment } from '../gafChatComposerTypes';
import type { GAFChatListItem, GAFMessageItem } from '../types';

export function useGafChatKeyboardShortcuts(options: {
	user: unknown;
	isDesktopWindowActive: boolean;
	selectedChatId: string | null;
	setSelectedChatId: Dispatch<SetStateAction<string | null>>;
	filteredChatsRef: MutableRefObject<GAFChatListItem[]>;
	selectedChatIdRef: MutableRefObject<string | null>;
	chatListRowRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	threadSearchInputRef: RefObject<HTMLInputElement | null>;
	sidebarSearchInputRef: RefObject<HTMLInputElement | null>;
	editMessageTextareaRef: RefObject<HTMLTextAreaElement | null>;
	localAttachInputRef: RefObject<HTMLInputElement | null>;
	threadSearchNavRef: MutableRefObject<{
		trimmed: string;
		matchCount: number;
		goPrev: () => void;
		goNext: () => void;
	}>;
	threadSearchQueryRef: MutableRefObject<string>;
	setThreadSearchQuery: (value: string) => void;
	setInputText: Dispatch<SetStateAction<string>>;
	setReplyingTo: Dispatch<SetStateAction<GAFMessageItem | null>>;
	replyingToRef: MutableRefObject<GAFMessageItem | null>;
	pendingAttachmentsRef: MutableRefObject<GafPendingComposerAttachment[]>;
	setPendingAttachments: Dispatch<
		SetStateAction<GafPendingComposerAttachment[]>
	>;
	showNewChat: boolean;
	confirmKind: unknown;
	messageDeleteConfirm: unknown;
	editingMessage: unknown;
	showContentLibraryPicker: boolean;
	showAdminAppLinkPicker: boolean;
	isVoiceRecording: boolean;
	composerLocked: boolean;
	resolvingInitialUsername: boolean;
}) {
	const {
		user,
		isDesktopWindowActive,
		selectedChatId,
		setSelectedChatId,
		filteredChatsRef,
		selectedChatIdRef,
		chatListRowRefs,
		inputRef,
		threadSearchInputRef,
		sidebarSearchInputRef,
		editMessageTextareaRef,
		localAttachInputRef,
		threadSearchNavRef,
		threadSearchQueryRef,
		setThreadSearchQuery,
		setInputText,
		setReplyingTo,
		replyingToRef,
		pendingAttachmentsRef,
		setPendingAttachments,
		showNewChat,
		confirmKind,
		messageDeleteConfirm,
		editingMessage,
		showContentLibraryPicker,
		showAdminAppLinkPicker,
		isVoiceRecording,
		composerLocked,
		resolvingInitialUsername,
	} = options;

	// biome-ignore lint/correctness/useExhaustiveDependencies: ref.current reads are intentional stable refs
	const shouldRedirectTypingToComposer = useCallback(
		(activeEl: Element | null): boolean => {
			if (!activeEl) return true;
			if (inputRef.current && activeEl === inputRef.current) return false;
			if (
				threadSearchInputRef.current &&
				activeEl === threadSearchInputRef.current
			)
				return false;
			if (
				sidebarSearchInputRef.current &&
				activeEl === sidebarSearchInputRef.current
			)
				return false;
			if (
				editMessageTextareaRef.current &&
				activeEl === editMessageTextareaRef.current
			)
				return false;
			if (
				localAttachInputRef.current &&
				activeEl === localAttachInputRef.current
			)
				return false;
			const tag = activeEl.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
				return false;
			if (activeEl.closest('[contenteditable="true"]')) return false;
			if (activeEl.closest('[role="dialog"]')) return false;
			return true;
		},
		[]
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: ref.current reads are intentional stable refs
	const isFocusInChatTextField = useCallback((): boolean => {
		const activeEl = document.activeElement;
		if (!activeEl) return false;
		if (inputRef.current && activeEl === inputRef.current) return true;
		if (
			threadSearchInputRef.current &&
			activeEl === threadSearchInputRef.current
		)
			return true;
		if (
			sidebarSearchInputRef.current &&
			activeEl === sidebarSearchInputRef.current
		)
			return true;
		if (
			editMessageTextareaRef.current &&
			activeEl === editMessageTextareaRef.current
		)
			return true;
		if (localAttachInputRef.current && activeEl === localAttachInputRef.current)
			return true;
		const tag = activeEl.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
		if (activeEl.closest('[contenteditable="true"]')) return true;
		return false;
	}, []);

	useEffect(() => {
		if (!isDesktopWindowActive) return;

		const handleKeyDownCapture = (e: KeyboardEvent) => {
			if (
				!selectedChatId ||
				showNewChat ||
				composerLocked ||
				resolvingInitialUsername ||
				confirmKind ||
				messageDeleteConfirm ||
				editingMessage ||
				showContentLibraryPicker ||
				showAdminAppLinkPicker ||
				isVoiceRecording
			) {
				return;
			}
			if (e.isComposing || e.key === 'Process') return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (e.key !== 'Backspace' && e.key.length !== 1) return;

			const activeEl = document.activeElement;
			if (!shouldRedirectTypingToComposer(activeEl)) return;

			if (
				activeEl instanceof HTMLButtonElement ||
				activeEl?.getAttribute('role') === 'button'
			) {
				if (e.key === ' ' || e.key === 'Enter') return;
			}
			if (
				activeEl instanceof HTMLAnchorElement &&
				activeEl.href &&
				e.key === 'Enter'
			) {
				return;
			}

			e.preventDefault();
			e.stopPropagation();

			const ta = inputRef.current;
			if (ta) {
				ta.focus({ preventScroll: true });
			}

			if (e.key === 'Backspace') {
				setInputText((prev) => prev.slice(0, -1));
			} else {
				setInputText((prev) => (prev + e.key).slice(0, 2000));
			}

			queueMicrotask(() => {
				const el = inputRef.current;
				if (el) {
					el.style.height = 'auto';
					el.style.height = `${el.scrollHeight}px`;
				}
			});
		};

		document.addEventListener('keydown', handleKeyDownCapture, true);
		return () =>
			document.removeEventListener('keydown', handleKeyDownCapture, true);
	}, [
		isDesktopWindowActive,
		selectedChatId,
		showNewChat,
		composerLocked,
		resolvingInitialUsername,
		confirmKind,
		messageDeleteConfirm,
		editingMessage,
		showContentLibraryPicker,
		showAdminAppLinkPicker,
		isVoiceRecording,
		shouldRedirectTypingToComposer,
		setInputText,
		inputRef,
	]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: keyboard handler reads stable search refs
	useEffect(() => {
		if (!user || !isDesktopWindowActive) return;
		const onKey = (e: KeyboardEvent) => {
			if (
				showNewChat ||
				confirmKind ||
				messageDeleteConfirm ||
				editingMessage ||
				showContentLibraryPicker ||
				showAdminAppLinkPicker ||
				isVoiceRecording
			) {
				return;
			}
			if (
				e.altKey &&
				!e.ctrlKey &&
				!e.metaKey &&
				(e.key === 'ArrowUp' || e.key === 'ArrowDown')
			) {
				if (isFocusInChatTextField()) return;
				const list = filteredChatsRef.current;
				if (list.length === 0) return;
				e.preventDefault();
				const cur = selectedChatIdRef.current;
				const idx = list.findIndex((c) => c.chat_id === cur);
				if (idx < 0) {
					if (e.key === 'ArrowDown') {
						setSelectedChatId(list[0].chat_id);
						requestAnimationFrame(() => chatListRowRefs.current[0]?.focus());
					} else {
						const last = list.length - 1;
						setSelectedChatId(list[last].chat_id);
						requestAnimationFrame(() => chatListRowRefs.current[last]?.focus());
					}
					return;
				}
				const delta = e.key === 'ArrowUp' ? -1 : 1;
				const next = idx + delta;
				if (next < 0 || next >= list.length) return;
				const nextId = list[next].chat_id;
				setSelectedChatId(nextId);
				requestAnimationFrame(() => chatListRowRefs.current[next]?.focus());
				return;
			}
			const mod = e.ctrlKey || e.metaKey;
			if (mod && e.key.toLowerCase() === 'f') {
				if (!selectedChatIdRef.current) return;
				e.preventDefault();
				threadSearchInputRef.current?.focus();
				return;
			}
			if (mod && e.key.toLowerCase() === 'g') {
				const nav = threadSearchNavRef.current;
				if (!nav.trimmed || nav.matchCount === 0) return;
				e.preventDefault();
				if (e.shiftKey) nav.goPrev();
				else nav.goNext();
				return;
			}
			if (e.key === 'Escape') {
				if (replyingToRef.current) {
					setReplyingTo(null);
					e.preventDefault();
					return;
				}
				if (pendingAttachmentsRef.current.length > 0) {
					setPendingAttachments([]);
					e.preventDefault();
					return;
				}
				if (threadSearchQueryRef.current.trim()) {
					setThreadSearchQuery('');
					e.preventDefault();
				}
				return;
			}
			if (mod && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				sidebarSearchInputRef.current?.focus();
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [
		user,
		isDesktopWindowActive,
		showNewChat,
		confirmKind,
		messageDeleteConfirm,
		editingMessage,
		showContentLibraryPicker,
		showAdminAppLinkPicker,
		isVoiceRecording,
		isFocusInChatTextField,
		setSelectedChatId,
		setReplyingTo,
		setPendingAttachments,
		setThreadSearchQuery,
	]);
}
