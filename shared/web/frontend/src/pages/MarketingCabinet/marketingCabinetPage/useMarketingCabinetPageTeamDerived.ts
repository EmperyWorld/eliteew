/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Team/member derived state for MarketingCabinetPage compose (labels, sorting, invite options).
 *
 * Invariants:
 * - Lead sort order matches pre-atomization MarketingCabinetPage.tsx.
 *
 * Related:
 * - useMarketingCabinetPageCompose.ts
 */

import { useCallback, useMemo } from 'react';
import type { TFunction } from 'i18next';
import { getFriendDisplayName } from '@/features/friends/components/FriendAvatar';
import { PROJECT_ENABLED_MODULES } from '@/pages/MarketingCabinet/constants';
import type {
	MarketingCompany,
	MarketingProject,
} from '@/pages/MarketingCabinet/marketingCabinetApi';
import type { useFriendsList } from '@/features/friends/hooks/useFriends';
import type { useMarketingCabinetFoundationQueries } from '@/pages/MarketingCabinet/hooks/useMarketingCabinetFoundationQueries';

type TeamDerivedInput = {
	t: TFunction<'marketing'>;
	user:
		| {
				id?: string;
				username?: string;
				profile?: { avatar_url?: string | null; display_name?: string | null };
		  }
		| null
		| undefined;
	selectedProject: MarketingProject | null;
	selectedCompany: MarketingCompany | null;
	friendsListQuery: ReturnType<typeof useFriendsList>;
	projectMembersInfiniteQuery: ReturnType<
		typeof useMarketingCabinetFoundationQueries
	>['projectMembersInfiniteQuery'];
	selfProfileQuery: ReturnType<
		typeof useMarketingCabinetFoundationQueries
	>['selfProfileQuery'];
};

export function useMarketingCabinetPageTeamDerived(input: TeamDerivedInput) {
	const {
		t,
		user,
		selectedProject,
		selectedCompany,
		friendsListQuery,
		projectMembersInfiniteQuery,
		selfProfileQuery,
	} = input;

	const teamAccessModuleSlugs = useMemo(() => {
		const raw = selectedProject?.enabled_modules;
		const list = raw?.length ? raw : PROJECT_ENABLED_MODULES;
		const order = new Map(PROJECT_ENABLED_MODULES.map((k, i) => [k, i]));
		return [...new Set(list)].sort(
			(a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999)
		);
	}, [selectedProject?.enabled_modules]);

	const isProjectLead = useMemo(() => {
		const lead = selectedProject?.created_by?.trim() ?? '';
		const uid = user?.id?.trim() ?? '';
		return Boolean(lead && uid && lead === uid);
	}, [selectedProject?.created_by, user?.id]);

	const canManageSelectedCompany = useMemo(() => {
		const uid = user?.id?.trim() ?? '';
		const owner = selectedCompany?.user_id?.trim() ?? '';
		return Boolean(uid && owner && uid === owner);
	}, [selectedCompany?.user_id, user?.id]);

	const labelForMemberUserId = useCallback(
		(memberUserId: string) => {
			const mid = memberUserId.trim();
			const f = friendsListQuery.data?.find((x) => x.id.trim() === mid);
			if (f) return getFriendDisplayName(f.username, f.full_name);
			if (mid === user?.id?.trim()) return t('cabinetPage.setup.teamYou');
			return memberUserId;
		},
		[friendsListQuery.data, user?.id, t]
	);

	const friendMetaForMemberUserId = useCallback(
		(memberUserId: string) => {
			const mid = memberUserId.trim();
			const fromFriends = friendsListQuery.data?.find(
				(x) => x.id.trim() === mid
			);
			if (fromFriends) return fromFriends;
			const uid = user?.id?.trim();
			if (uid && mid === uid) {
				const p = selfProfileQuery.data;
				return {
					id: uid,
					username: p?.username ?? user?.username ?? null,
					avatar_url: p?.avatar_url ?? user?.profile?.avatar_url ?? null,
					full_name: p?.full_name ?? user?.profile?.display_name ?? null,
				};
			}
			return undefined;
		},
		[friendsListQuery.data, user, selfProfileQuery.data]
	);

	const projectMembersItems = useMemo(
		() =>
			projectMembersInfiniteQuery.data?.pages.flatMap((page) => page.items) ??
			[],
		[projectMembersInfiniteQuery.data?.pages]
	);

	const projectMembersTotal =
		projectMembersInfiniteQuery.data?.pages[0]?.total ??
		projectMembersItems.length;

	const sortedTeamMembers = useMemo(() => {
		const leadId = selectedProject?.created_by?.trim() ?? '';
		return [...projectMembersItems].sort((a, b) => {
			const aKey = a.user_id === leadId || a.role === 'owner' ? 0 : 1;
			const bKey = b.user_id === leadId || b.role === 'owner' ? 0 : 1;
			if (aKey !== bKey) return aKey - bKey;
			return a.user_id.localeCompare(b.user_id);
		});
	}, [projectMembersItems, selectedProject?.created_by]);

	const friendsEligibleForTeam = useMemo(() => {
		const memberIds = new Set(projectMembersItems.map((m) => m.user_id));
		return (friendsListQuery.data ?? []).filter((f) => !memberIds.has(f.id));
	}, [friendsListQuery.data, projectMembersItems]);

	const transferLeadSelectOptions = useMemo(() => {
		const leadId = selectedProject?.created_by?.trim() ?? '';
		const opts = projectMembersItems
			.filter((m) => m.status === 'active' && m.user_id !== leadId)
			.map((m) => ({
				value: m.user_id,
				label: `${labelForMemberUserId(m.user_id)} · ${t(`cabinetPage.setup.teamRole.${m.role === 'owner' ? 'owner' : m.role}`)}`,
			}));
		return [
			{ value: '', label: t('cabinetPage.setup.teamTransferPlaceholder') },
			...opts,
		];
	}, [
		projectMembersItems,
		selectedProject?.created_by,
		labelForMemberUserId,
		t,
	]);

	return {
		teamAccessModuleSlugs,
		isProjectLead,
		canManageSelectedCompany,
		canExportResearches: isProjectLead,
		labelForMemberUserId,
		friendMetaForMemberUserId,
		projectMembersItems,
		projectMembersTotal,
		sortedTeamMembers,
		friendsEligibleForTeam,
		transferLeadSelectOptions,
	};
}
