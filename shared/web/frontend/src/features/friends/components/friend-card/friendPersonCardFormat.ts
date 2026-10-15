/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Provides locale-aware formatting used by FriendPersonCard tab modules.
 *
 * Invariants:
 * - Invalid timestamps and file sizes remain omitted rather than rendered as invalid data.
 *
 * Related:
 * - ../FriendPersonCard.tsx
 * ---
 */

import type { TFunction } from 'i18next';

import type { SocialHubSharedContentItem } from '../../api/socialHubFeedApi';

export function createFriendCardFormatters(t: TFunction, language: string) {
	const relativeTimeFormatter = new Intl.RelativeTimeFormat(language, {
		numeric: 'auto',
	});

	const formatRelativeTimestamp = (value?: string | null): string | null => {
		if (!value) return null;
		const timestamp = new Date(value).getTime();
		if (!Number.isFinite(timestamp)) return null;
		const diffMinutes = Math.round((timestamp - Date.now()) / (1000 * 60));
		if (Math.abs(diffMinutes) < 1)
			return relativeTimeFormatter.format(0, 'second');
		if (Math.abs(diffMinutes) < 60)
			return relativeTimeFormatter.format(diffMinutes, 'minute');
		const diffHours = Math.round(diffMinutes / 60);
		if (Math.abs(diffHours) < 24)
			return relativeTimeFormatter.format(diffHours, 'hour');
		return relativeTimeFormatter.format(Math.round(diffHours / 24), 'day');
	};

	const formatCalendarDate = (value?: string | null): string | null => {
		if (!value) return null;
		const date = new Date(value);
		return Number.isFinite(date.getTime())
			? date.toLocaleDateString(language, {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				})
			: null;
	};

	const formatFileSize = (value?: number | null): string | null => {
		if (value == null || !Number.isFinite(value)) return null;
		if (value < 1024) return `${value} B`;
		const units = ['KB', 'MB', 'GB', 'TB'] as const;
		let size = value / 1024;
		let unitIndex = 0;
		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex += 1;
		}
		return `${new Intl.NumberFormat(language, {
			maximumFractionDigits: size >= 10 ? 0 : 1,
		}).format(size)} ${units[unitIndex]}`;
	};

	const getContentTypeLabel = (item: SocialHubSharedContentItem): string => {
		if (!item.content_type)
			return t('friends.personCardSharedContentTypeUnknown');
		const translated = t(`contentTypes.${item.content_type}`);
		return translated === `contentTypes.${item.content_type}`
			? item.content_type
			: translated;
	};

	return {
		formatRelativeTimestamp,
		formatCalendarDate,
		formatFileSize,
		getContentTypeLabel,
		getSharedDirectionLabel: (direction: string) =>
			direction === 'to_friend'
				? t('friends.personCardSharedDirectionToFriend')
				: t('friends.personCardSharedDirectionFromFriend'),
		getSharedReasonLabel: (reason: string) =>
			reason === 'friends_visibility'
				? t('friends.personCardSharedReasonFriends')
				: reason === 'friend_visibility'
					? t('friends.personCardSharedReasonFriendFlag')
					: t('friends.personCardSharedReasonDirect'),
	};
}
