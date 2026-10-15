/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk listbox option focus / arrow-key navigation helpers for the feed list.
 *
 * Invariants:
 * - Stable per-id ref callbacks so memoized rows are not invalidated each render.
 *
 * Related:
 * - `pages/Desktop/components/EWDeskApp.tsx`
 */
import * as React from 'react';
import type { CompanyNewsPostListItem } from '../../services/productDesktopApi';

export function useEwDeskAppOptionFocus(
	filteredPosts: CompanyNewsPostListItem[],
	selectedId: string | null,
	setSelectedId: React.Dispatch<React.SetStateAction<string | null>>
): {
	getOptionButtonRef: (id: string) => React.RefCallback<HTMLButtonElement>;
	focusOptionAt: (index: number) => void;
	focusOptionAtRef: React.MutableRefObject<(index: number) => void>;
	handleOptionKeyDown: (
		e: React.KeyboardEvent<HTMLButtonElement>,
		index: number
	) => void;
	getOptionTabIndex: (index: number) => number;
} {
	const optionRefsById = React.useRef<Map<string, HTMLButtonElement | null>>(
		new Map()
	);
	const optionRefCallbackById = React.useRef<
		Map<string, React.RefCallback<HTMLButtonElement>>
	>(new Map());

	const getOptionButtonRef = React.useCallback((id: string) => {
		let cb = optionRefCallbackById.current.get(id);
		if (!cb) {
			cb = (el: HTMLButtonElement | null) => {
				if (el) {
					optionRefsById.current.set(id, el);
				} else {
					optionRefsById.current.delete(id);
				}
			};
			optionRefCallbackById.current.set(id, cb);
		}
		return cb;
	}, []);

	React.useLayoutEffect(() => {
		const ids = new Set(filteredPosts.map((p) => p.id));
		for (const id of optionRefCallbackById.current.keys()) {
			if (!ids.has(id)) {
				optionRefCallbackById.current.delete(id);
			}
		}
	}, [filteredPosts]);

	const focusOptionAt = React.useCallback(
		(index: number): void => {
			const clamped = Math.max(
				0,
				Math.min(index, Math.max(0, filteredPosts.length - 1))
			);
			const id = filteredPosts[clamped]?.id;
			if (id) {
				optionRefsById.current.get(id)?.focus();
			}
		},
		[filteredPosts]
	);

	const focusOptionAtRef = React.useRef(focusOptionAt);
	focusOptionAtRef.current = focusOptionAt;

	React.useLayoutEffect(() => {
		if (!selectedId) return;
		const el = optionRefsById.current.get(selectedId);
		el?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
	}, [selectedId]);

	const handleOptionKeyDown = React.useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
			const len = filteredPosts.length;
			if (len === 0) return;
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				const next = Math.min(index + 1, len - 1);
				if (filteredPosts[next]) {
					setSelectedId(filteredPosts[next].id);
					focusOptionAt(next);
				}
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				const prev = Math.max(index - 1, 0);
				if (filteredPosts[prev]) {
					setSelectedId(filteredPosts[prev].id);
					focusOptionAt(prev);
				}
			} else if (e.key === 'Home') {
				e.preventDefault();
				if (filteredPosts[0]) {
					setSelectedId(filteredPosts[0].id);
					focusOptionAt(0);
				}
			} else if (e.key === 'End') {
				e.preventDefault();
				const last = len - 1;
				if (last >= 0 && filteredPosts[last]) {
					setSelectedId(filteredPosts[last].id);
					focusOptionAt(last);
				}
			}
		},
		[filteredPosts, focusOptionAt, setSelectedId]
	);

	const getOptionTabIndex = React.useCallback(
		(index: number): number => {
			if (filteredPosts[index]?.id === selectedId) return 0;
			if (!selectedId && index === 0) return 0;
			return -1;
		},
		[filteredPosts, selectedId]
	);

	return {
		getOptionButtonRef,
		focusOptionAt,
		focusOptionAtRef,
		handleOptionKeyDown,
		getOptionTabIndex,
	};
}
