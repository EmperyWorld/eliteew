/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Own selection, filtering, sorting, and deep-link focus state for Friends Directory.
 * Data fetching and relationship mutations remain outside this UI-state hook.
 *
 * Invariants:
 * - A focused friend must belong to the current visible directory list.
 * - Removed circles and friends clear stale UI selection.
 *
 * Related:
 * - ../components/FriendsDirectory.tsx
 * - ../components/directory/FriendsDirectoryCirclesSection.tsx
 */

import { useEffect, useMemo, useState } from 'react';

import { getFriendDisplayName } from '../components/FriendAvatar';
import type { Friend, FriendCircle } from '../types';

export type DirectorySmartFilter =
	| 'all'
	| 'favorites'
	| 'limited'
	| 'recent'
	| 'quiet';
export type DirectorySortMode = 'name' | 'recent';

interface UseFriendsDirectoryFiltersOptions {
	friends: Friend[];
	circles: FriendCircle[];
	initialFriendUserId: string | null;
	anonymousLabel: string;
}

export function useFriendsDirectoryFilters({
	friends,
	circles,
	initialFriendUserId,
	anonymousLabel,
}: UseFriendsDirectoryFiltersOptions) {
	const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
	const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
	const [directoryListFilter, setDirectoryListFilter] = useState('');
	const [directorySmartFilter, setDirectorySmartFilter] =
		useState<DirectorySmartFilter>('all');
	const [directorySortMode, setDirectorySortMode] =
		useState<DirectorySortMode>('name');
	const [bulkSelectedFriendIds, setBulkSelectedFriendIds] = useState<string[]>(
		[]
	);

	const selectedCircle = useMemo(
		() => circles.find((circle) => circle.id === selectedCircleId) ?? null,
		[circles, selectedCircleId]
	);
	const visibleFriends = useMemo(() => {
		const search = directoryListFilter.trim().toLowerCase();
		const scoped = selectedCircleId
			? friends.filter((friend) =>
					friend.circles?.some((circle) => circle.id === selectedCircleId)
				)
			: friends;
		const textFiltered = search
			? scoped.filter((friend) =>
					[friend.username, friend.full_name].some((value) =>
						value?.toLowerCase().includes(search)
					)
				)
			: scoped;
		const smartFiltered = textFiltered.filter((friend) => {
			switch (directorySmartFilter) {
				case 'favorites':
					return Boolean(friend.is_favorite);
				case 'limited':
					return Boolean(friend.is_muted || friend.is_blocked);
				case 'recent':
					return Boolean(friend.last_activity_at || friend.last_interaction_at);
				case 'quiet':
					return !friend.last_activity_at && !friend.last_interaction_at;
				default:
					return true;
			}
		});

		return [...smartFiltered].sort((left, right) => {
			if (directorySortMode === 'recent') {
				return (
					new Date(right.last_interaction_at ?? 0).getTime() -
					new Date(left.last_interaction_at ?? 0).getTime()
				);
			}
			return getFriendDisplayName(
				left.username,
				left.full_name,
				anonymousLabel
			).localeCompare(
				getFriendDisplayName(right.username, right.full_name, anonymousLabel),
				undefined,
				{ sensitivity: 'base' }
			);
		});
	}, [
		anonymousLabel,
		directoryListFilter,
		directorySmartFilter,
		directorySortMode,
		friends,
		selectedCircleId,
	]);
	const selectedFriend = useMemo(
		() =>
			visibleFriends.find((friend) => friend.id === selectedFriendId) ?? null,
		[selectedFriendId, visibleFriends]
	);
	const bulkSelectedFriends = useMemo(
		() => friends.filter((friend) => bulkSelectedFriendIds.includes(friend.id)),
		[bulkSelectedFriendIds, friends]
	);

	useEffect(() => {
		const hintedId = initialFriendUserId?.trim();
		if (hintedId && visibleFriends.some((friend) => friend.id === hintedId)) {
			setSelectedFriendId(hintedId);
			setSelectedCircleId(null);
			return;
		}
		if (!visibleFriends.length) {
			setSelectedFriendId(null);
			return;
		}
		if (!visibleFriends.some((friend) => friend.id === selectedFriendId)) {
			setSelectedFriendId(visibleFriends[0]?.id ?? null);
		}
	}, [initialFriendUserId, selectedFriendId, visibleFriends]);

	useEffect(() => {
		if (
			selectedCircleId &&
			!circles.some((circle) => circle.id === selectedCircleId)
		)
			setSelectedCircleId(null);
	}, [circles, selectedCircleId]);

	useEffect(() => {
		setBulkSelectedFriendIds((current) =>
			current.filter((id) => friends.some((friend) => friend.id === id))
		);
	}, [friends]);

	return {
		bulkSelectedFriendIds,
		bulkSelectedFriends,
		directoryListFilter,
		directorySmartFilter,
		directorySortMode,
		hasActiveFilter:
			Boolean(directoryListFilter.trim()) || directorySmartFilter !== 'all',
		selectedCircle,
		selectedCircleId,
		selectedFriend,
		selectedFriendId,
		setBulkSelectedFriendIds,
		setDirectoryListFilter,
		setDirectorySmartFilter,
		setDirectorySortMode,
		setSelectedCircleId,
		setSelectedFriendId,
		visibleFriends,
	};
}
