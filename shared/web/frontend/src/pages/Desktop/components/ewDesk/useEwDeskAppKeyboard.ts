/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk global keyboard shortcuts (search, j/k, r/s/u/l, hints).
 *
 * Invariants:
 * - List loads without post body; full Markdown fetched per selected id only.
 * - Desktop chrome header is toolbar-only (tagline + refresh); shell WindowTitleBar owns app title.
 *
 * Related:
 * - `pages/Desktop/components/EWDeskApp.tsx`
 * - `documentation/product/desktop/EWDESK-NEWS.md`
 */
import {
	useEffect,
	type Dispatch,
	type MutableRefObject,
	type RefObject,
	type SetStateAction,
} from 'react';
import type { CompanyNewsPostListItem } from '../../services/productDesktopApi';

export interface UseEwDeskAppKeyboardArgs {
	ewDeskRootRef: RefObject<HTMLDivElement | null>;
	searchInputRef: RefObject<HTMLInputElement | null>;
	selectedIdRef: MutableRefObject<string | null>;
	filteredPostsRef: MutableRefObject<CompanyNewsPostListItem[]>;
	listFeedRef: MutableRefObject<{ refetch: () => Promise<unknown> }>;
	focusOptionAtRef: MutableRefObject<(index: number) => void>;
	handleToggleStarByIdRef: MutableRefObject<(id: string) => void>;
	toggleSelectedReadStateRef: MutableRefObject<() => void>;
	copyPostLinkRef: MutableRefObject<(postId: string) => Promise<void>>;
	setShowKeyboardHints: Dispatch<SetStateAction<boolean>>;
	setSelectedId: Dispatch<SetStateAction<string | null>>;
}

export function useEwDeskAppKeyboard({
	ewDeskRootRef,
	searchInputRef,
	selectedIdRef,
	filteredPostsRef,
	listFeedRef,
	focusOptionAtRef,
	handleToggleStarByIdRef,
	toggleSelectedReadStateRef,
	copyPostLinkRef,
	setShowKeyboardHints,
	setSelectedId,
}: UseEwDeskAppKeyboardArgs): void {
	// Intentional mount-once listener: mutable refs carry latest handlers/state (same as pre-atomization).
	// biome-ignore lint/correctness/useExhaustiveDependencies: empty deps preserve original EWDeskApp keyboard effect
	useEffect(() => {
		const onKey = (e: KeyboardEvent): void => {
			const root = ewDeskRootRef.current;
			if (!root) return;
			if (!root.contains(document.activeElement)) return;

			const t = e.target as HTMLElement | null;
			const inTextField = Boolean(
				t?.closest('input, textarea, [contenteditable="true"]')
			);

			if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
				if (inTextField && t !== searchInputRef.current) {
					return;
				}
				e.preventDefault();
				searchInputRef.current?.focus();
				searchInputRef.current?.select();
				return;
			}
			if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
				if (inTextField) {
					return;
				}
				e.preventDefault();
				searchInputRef.current?.focus();
				searchInputRef.current?.select();
				return;
			}

			if (
				e.key === '?' &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				!e.shiftKey
			) {
				if (inTextField) return;
				e.preventDefault();
				setShowKeyboardHints((prev) => !prev);
				return;
			}

			/** Refresh feed (same as header button). */
			if (
				(e.key === 'r' || e.key === 'R') &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey
			) {
				if (inTextField) return;
				e.preventDefault();
				void listFeedRef.current.refetch();
				return;
			}

			/** Toggle starred for the currently selected post. */
			if (
				(e.key === 's' || e.key === 'S') &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey
			) {
				if (inTextField) return;
				const sid = selectedIdRef.current;
				if (!sid) return;
				e.preventDefault();
				handleToggleStarByIdRef.current(sid);
				return;
			}

			/** Toggle read/unread for the currently selected post. */
			if (
				(e.key === 'u' || e.key === 'U') &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey
			) {
				if (inTextField) return;
				if (!selectedIdRef.current) return;
				e.preventDefault();
				toggleSelectedReadStateRef.current();
				return;
			}

			/** Copy share link for the currently selected post. */
			if (
				(e.key === 'l' || e.key === 'L') &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey
			) {
				if (inTextField) return;
				const sid = selectedIdRef.current;
				if (!sid) return;
				e.preventDefault();
				void copyPostLinkRef.current(sid);
				return;
			}

			/** Next / previous in the current filtered list (vim-style), not in text fields. */
			if (
				(e.key === 'j' || e.key === 'J' || e.key === 'k' || e.key === 'K') &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey
			) {
				if (inTextField) return;
				const list = filteredPostsRef.current;
				if (list.length === 0) return;
				e.preventDefault();
				const down = e.key === 'j' || e.key === 'J';
				const cur = list.findIndex((p) => p.id === selectedIdRef.current);
				let nextIdx: number;
				if (down) {
					nextIdx = cur < 0 ? 0 : Math.min(cur + 1, list.length - 1);
				} else {
					nextIdx = cur < 0 ? list.length - 1 : Math.max(cur - 1, 0);
				}
				const nextPost = list[nextIdx];
				if (!nextPost) return;
				setSelectedId(nextPost.id);
				requestAnimationFrame(() => {
					focusOptionAtRef.current(nextIdx);
				});
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, []);
}
