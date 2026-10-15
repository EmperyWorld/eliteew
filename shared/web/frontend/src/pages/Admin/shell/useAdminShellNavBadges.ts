/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lightweight counts for sidebar badges (feedback queue, users online).
 *
 * Related:
 * - `pages/Admin/shell/AdminShellSidebar.tsx`
 */

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/services/admin/api';
import { adminListFeedbackTickets } from '../../Desktop/services/productDesktopApi';
import { feedbackListPageTotal } from '../../Desktop/utils/feedbackPaged';
import { adminListSocialReports } from '../adminSocialReportsApi';

export type AdminShellNavBadges = {
	feedbackOpen: number | null;
	socialReportsOpen: number | null;
	usersOnline: number | null;
};

export function useAdminShellNavBadges(enabled: boolean): AdminShellNavBadges {
	const feedbackQ = useQuery({
		queryKey: ['admin', 'shell-badge', 'feedback-queue'],
		enabled,
		staleTime: 60_000,
		queryFn: async () => {
			const page = await adminListFeedbackTickets({ limit: 1, offset: 0 });
			return feedbackListPageTotal(page);
		},
	});

	const socialReportsQ = useQuery({
		queryKey: ['admin', 'shell-badge', 'social-reports-open'],
		enabled,
		staleTime: 60_000,
		queryFn: async () => {
			const page = await adminListSocialReports({
				status: 'open',
				limit: 1,
				offset: 0,
			});
			return page.total;
		},
	});

	const onlineQ = useQuery({
		queryKey: ['admin', 'shell-badge', 'users-online'],
		enabled,
		staleTime: 45_000,
		queryFn: async () => {
			const page = await adminApi.getUsersDirectory({
				online_only: true,
				page: 1,
				per_page: 1,
			});
			return page.total;
		},
	});

	return {
		feedbackOpen: feedbackQ.data ?? null,
		socialReportsOpen: socialReportsQ.data ?? null,
		usersOnline: onlineQ.data ?? null,
	};
}
