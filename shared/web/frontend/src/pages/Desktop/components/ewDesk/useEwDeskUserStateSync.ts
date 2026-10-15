/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merge EWDesk read/starred markers between localStorage and server /news/my-state.
 *
 * Invariants:
 * - One-time local → server migration when server state is empty but local has data.
 * - PATCH /news/my-state invalidates news-counts always; feed only when unread/starred filters active.
 *
 * Related:
 * - EWDeskApp.tsx, ewDeskLocalState.ts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import {
	patchEwDeskNewsUserState,
	type CompanyNewsPostListItem,
} from '../../services/productDesktopApi';
import {
	loadEwDeskReadIds,
	loadEwDeskStarredIds,
	persistEwDeskReadIds,
	persistEwDeskStarredIds,
} from './ewDeskLocalState';
import { ewDeskFeedHasActiveUserScopedFilters } from './ewDeskNewsQueryInvalidation';
import {
	ewDeskNewsCountsQueryKey,
	ewDeskNewsInvalidationQueryKey,
	ewDeskNewsUserStateQueryKey,
	ewDeskNewsUserStateQueryOptions,
} from './ewDeskNewsQueryOptions';

export { ewDeskNewsUserStateQueryKey } from './ewDeskNewsQueryOptions';

export function useEwDeskUserStateSync(params: {
	enabled: boolean;
	posts: CompanyNewsPostListItem[];
	selectedId: string | null;
}): {
	readIds: Set<string>;
	starredIds: Set<string>;
	setReadIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	setStarredIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	markPostRead: (postId: string) => void;
	markPostUnread: (postId: string) => void;
	markAllRead: () => void;
	markFeedSeen: () => void;
} {
	const { enabled, posts, selectedId } = params;
	const queryClient = useQueryClient();
	const migratedRef = React.useRef(false);

	const [readIds, setReadIds] = React.useState<Set<string>>(loadEwDeskReadIds);
	const [starredIds, setStarredIds] =
		React.useState<Set<string>>(loadEwDeskStarredIds);

	const serverStateQuery = useQuery({
		...ewDeskNewsUserStateQueryOptions(),
		enabled,
	});

	const patchMutation = useMutation({
		mutationFn: patchEwDeskNewsUserState,
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ewDeskNewsUserStateQueryKey(),
			});
			void queryClient.invalidateQueries({
				queryKey: ewDeskNewsCountsQueryKey(),
			});
			if (ewDeskFeedHasActiveUserScopedFilters(queryClient)) {
				void queryClient.invalidateQueries({
					queryKey: ewDeskNewsInvalidationQueryKey(),
				});
			}
		},
	});

	const { mutate: patchUserState } = patchMutation;

	React.useEffect(() => {
		if (!enabled || !serverStateQuery.isSuccess || migratedRef.current) return;
		const server = serverStateQuery.data;
		const localRead = loadEwDeskReadIds();
		const localStarred = loadEwDeskStarredIds();
		const serverRead = new Set(server.read_post_ids);
		const serverStarred = new Set(server.starred_post_ids);

		if (
			serverRead.size === 0 &&
			serverStarred.size === 0 &&
			(localRead.size > 0 || localStarred.size > 0)
		) {
			migratedRef.current = true;
			const mergedRead = new Set([...localRead, ...serverRead]);
			const mergedStarred = new Set([...localStarred, ...serverStarred]);
			setReadIds(mergedRead);
			setStarredIds(mergedStarred);
			patchUserState({
				read_post_ids: [...mergedRead],
				starred_post_ids: [...mergedStarred],
			});
			return;
		}

		migratedRef.current = true;
		if (serverRead.size > 0) setReadIds(serverRead);
		if (serverStarred.size > 0) setStarredIds(serverStarred);
	}, [
		enabled,
		patchUserState,
		serverStateQuery.data,
		serverStateQuery.isSuccess,
	]);

	React.useEffect(() => {
		persistEwDeskReadIds(readIds);
	}, [readIds]);

	React.useEffect(() => {
		persistEwDeskStarredIds(starredIds);
	}, [starredIds]);

	const pendingReadPatchRef = React.useRef<Set<string>>(new Set());
	const readPatchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
		null
	);

	const flushReadPatch = React.useCallback(() => {
		if (!enabled || pendingReadPatchRef.current.size === 0) return;
		const ids = [...pendingReadPatchRef.current];
		pendingReadPatchRef.current.clear();
		patchUserState({ mark_read_ids: ids });
	}, [enabled, patchUserState]);

	const markPostRead = React.useCallback(
		(postId: string) => {
			setReadIds((prev) => {
				if (prev.has(postId)) return prev;
				const next = new Set(prev);
				next.add(postId);
				return next;
			});
			if (!enabled) return;
			pendingReadPatchRef.current.add(postId);
			if (readPatchTimerRef.current) clearTimeout(readPatchTimerRef.current);
			readPatchTimerRef.current = setTimeout(flushReadPatch, 400);
		},
		[enabled, flushReadPatch]
	);

	React.useEffect(() => {
		if (!selectedId) return;
		markPostRead(selectedId);
	}, [markPostRead, selectedId]);

	const markPostUnread = React.useCallback(
		(postId: string) => {
			setReadIds((prev) => {
				if (!prev.has(postId)) return prev;
				const next = new Set(prev);
				next.delete(postId);
				return next;
			});
			if (!enabled) return;
			patchUserState({ mark_unread_ids: [postId] });
		},
		[enabled, patchUserState]
	);

	const markAllRead = React.useCallback(() => {
		if (posts.length === 0) return;
		const allIds = posts.map((p) => p.id);
		setReadIds(new Set(allIds));
		if (!enabled) return;
		patchUserState({ mark_read_ids: allIds });
	}, [enabled, patchUserState, posts]);

	const markFeedSeen = React.useCallback(() => {
		if (!enabled || posts.length === 0) return;
		let latest: string | null = null;
		for (const p of posts) {
			if (!p.published_at) continue;
			if (!latest || p.published_at > latest) latest = p.published_at;
		}
		if (!latest) return;
		patchUserState({ last_seen_published_at: latest });
	}, [enabled, patchUserState, posts]);

	React.useEffect(() => {
		return () => {
			if (readPatchTimerRef.current) clearTimeout(readPatchTimerRef.current);
		};
	}, []);

	const setStarredIdsWithSync = React.useCallback<
		React.Dispatch<React.SetStateAction<Set<string>>>
	>(
		(action) => {
			setStarredIds((prev) => {
				const next = typeof action === 'function' ? action(prev) : action;
				if (enabled) {
					patchUserState({ starred_post_ids: [...next] });
				}
				return next;
			});
		},
		[enabled, patchUserState]
	);

	return {
		readIds,
		starredIds,
		setReadIds,
		setStarredIds: setStarredIdsWithSync,
		markPostRead,
		markPostUnread,
		markAllRead,
		markFeedSeen,
	};
}
