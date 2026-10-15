/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n-relative time formatter factory for comment thread timestamps.
 *
 * Related:
 * - useCommentsReviewCompose.ts, CommentsReviewThreadCard.tsx
 */

import type { TFunction } from 'i18next';

export function createFormatCommentRelativeTime(t: TFunction) {
	return (date: Date): string => {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / (1000 * 60));
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return t('comments.relative.daysAgo', { count: days });
		}
		if (hours > 0) {
			return t('comments.relative.hoursAgo', { count: hours });
		}
		if (minutes > 0) {
			return t('comments.relative.minutesAgo', { count: minutes });
		}
		return t('comments.relative.justNow');
	};
}
