/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure formatting helpers for Friends Directory search and list rows.
 * They keep localized relationship and activity summaries outside the UI orchestrator.
 *
 * Invariants:
 * - Invalid timestamps never produce a visible activity label.
 *
 * Related:
 * - ../components/FriendsDirectory.tsx
 * - ../components/directory/FriendsDirectorySearchSection.tsx
 */

import type { TFunction } from 'i18next';

import type { Friend, FriendSearchCandidate } from '../types';

type ActivityItem = Pick<
	Friend,
	| 'last_activity_at'
	| 'last_interaction_at'
	| 'activity_visible_to_current_user'
>;

export function formatRelativeTimestamp(
	value: string | null | undefined,
	formatter: Intl.RelativeTimeFormat
): string | null {
	if (!value) return null;
	const timestamp = new Date(value).getTime();
	if (!Number.isFinite(timestamp)) return null;

	const diffMinutes = Math.round((timestamp - Date.now()) / 60_000);
	if (Math.abs(diffMinutes) < 1) return formatter.format(0, 'second');
	if (Math.abs(diffMinutes) < 60)
		return formatter.format(diffMinutes, 'minute');

	const diffHours = Math.round(diffMinutes / 60);
	if (Math.abs(diffHours) < 24) return formatter.format(diffHours, 'hour');
	return formatter.format(Math.round(diffHours / 24), 'day');
}

export function getActivitySummary(
	item: ActivityItem,
	formatter: Intl.RelativeTimeFormat,
	t: TFunction
): string[] {
	const parts: string[] = [];
	const activity =
		item.activity_visible_to_current_user === false
			? null
			: formatRelativeTimestamp(item.last_activity_at, formatter);
	const interaction = formatRelativeTimestamp(
		item.last_interaction_at,
		formatter
	);

	if (activity) parts.push(`${t('friends.activityLabel')} ${activity}`);
	else if (item.activity_visible_to_current_user === false)
		parts.push(t('friends.activityHiddenBadge'));
	if (interaction)
		parts.push(`${t('friends.interactionLabel')} ${interaction}`);
	return parts;
}

export function getRelationshipFlagsSummary(
	item: Pick<FriendSearchCandidate, 'is_muted' | 'is_blocked'>,
	t: TFunction
): string[] {
	const parts: string[] = [];
	if (item.is_muted) parts.push(t('friends.mutedBadge'));
	if (item.is_blocked) parts.push(t('friends.blockedBadge'));
	return parts;
}

export function getCircleSummary(item: Pick<Friend, 'circles'>): string[] {
	return (item.circles ?? []).map((circle) => circle.name);
}
