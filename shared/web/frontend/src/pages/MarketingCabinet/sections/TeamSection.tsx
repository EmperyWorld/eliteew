/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Project team roster — members, invites, lead transfer, MC module permissions.
 *
 * Invariants:
 * - Large member lists use windowing unless an access panel is open.
 *
 * Related:
 * - MarketingCabinetTeamMemberList.tsx, TeamMemberCard.tsx
 */
import type {
	MutationLike,
	QueryLike,
} from '../marketingCabinetPage/marketingCabinetComposeHosts';
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { Friend } from '@/features/friends/types';
import { FriendPicker } from '@/features/friends/components/FriendPicker';
import {
	FriendAvatar,
	getFriendDisplayName,
} from '@/features/friends/components/FriendAvatar';
import { cn } from '@/utils/cn';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { MarketingCabinetTeamMemberList } from '../components/MarketingCabinetTeamMemberList';
import { FieldLabel } from '../components/FieldLabel';
import { LoadingGrid } from '../components/LoadingGrid';
import { MarketingCabinetSelect } from '../components/MarketingCabinetSelect';
import { SectionPanel } from '../components/SectionPanel';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import type {
	MarketingProject,
	MarketingProjectMember,
	MarketingProjectMembersListResponse,
} from '../marketingCabinetApi';
import type { TeamAccessDraft } from '../utils/teamMemberMcPermissions';
import { extractApiErrorMessage } from '../utils';

export interface TeamSectionProps {
	selectedProjectId: string | null;
	selectedProject: MarketingProject | null;
	projectMembersInfiniteQuery: QueryLike<{
		pages: MarketingProjectMembersListResponse[];
		pageParams: unknown[];
	}>;
	projectMembersTotal: number;
	isProjectLead: boolean;
	sortedTeamMembers: MarketingProjectMember[];
	user: {
		id?: string | null;
		username?: string | null;
		profile?: { avatar_url?: string | null };
	} | null;
	teamAccessMemberId: string | null;
	setTeamAccessMemberId: React.Dispatch<React.SetStateAction<string | null>>;
	teamAccessDraft: TeamAccessDraft | null;
	setTeamAccessDraft: React.Dispatch<
		React.SetStateAction<TeamAccessDraft | null>
	>;
	teamAccessModuleSlugs: string[];
	friendMetaForMemberUserId: (memberUserId: string) =>
		| Friend
		| undefined
		| {
				id: string;
				username: string | null;
				avatar_url: string | null;
				full_name: string | null;
		  };
	labelForMemberUserId: (memberUserId: string) => string;
	removeProjectMemberMutation: MutationLike;
	updateMemberPermissionsMutation: MutationLike;
	addProjectMemberMutation: MutationLike;
	transferProjectLeadMutation: MutationLike;
	friendsListQuery: QueryLike<Friend[]>;
	friendsEligibleForTeam: Friend[];
	teamInviteUserId: string | null;
	setTeamInviteUserId: React.Dispatch<React.SetStateAction<string | null>>;
	teamInviteRole: string;
	setTeamInviteRole: React.Dispatch<React.SetStateAction<string>>;
	projectTeamRoleInviteOptions: Array<{ value: string; label: string }>;
	transferLeadToUserId: string;
	setTransferLeadToUserId: React.Dispatch<React.SetStateAction<string>>;
	transferLeadSelectOptions: Array<{ value: string; label: string }>;
	setTeamRemoveConfirm: React.Dispatch<
		React.SetStateAction<{
			memberId: string;
			displayName: string;
		} | null>
	>;
	setTeamTransferConfirm: React.Dispatch<
		React.SetStateAction<{
			newLeadUserId: string;
			displayName: string;
		} | null>
	>;
}

export function TeamSection({
	selectedProjectId,
	selectedProject,
	projectMembersInfiniteQuery,
	projectMembersTotal,
	isProjectLead,
	sortedTeamMembers,
	user,
	teamAccessMemberId,
	setTeamAccessMemberId,
	teamAccessDraft,
	setTeamAccessDraft,
	teamAccessModuleSlugs,
	friendMetaForMemberUserId,
	labelForMemberUserId,
	removeProjectMemberMutation,
	updateMemberPermissionsMutation,
	addProjectMemberMutation,
	transferProjectLeadMutation,
	friendsListQuery,
	friendsEligibleForTeam,
	teamInviteUserId,
	setTeamInviteUserId,
	teamInviteRole,
	setTeamInviteRole,
	projectTeamRoleInviteOptions,
	transferLeadToUserId,
	setTransferLeadToUserId,
	transferLeadSelectOptions,
	setTeamRemoveConfirm,
	setTeamTransferConfirm,
}: TeamSectionProps) {
	const { t } = useTranslation('marketing');
	const { checkboxControl } = useMarketingShellClasses();
	const teamMembersTruncated = projectMembersTotal > sortedTeamMembers.length;
	const teamMembersHasMore = projectMembersInfiniteQuery.hasNextPage ?? false;

	return (
		<div className="mc-section-root mx-auto min-w-0">
			<SectionPanel
				title={t('cabinetPage.setup.teamTitle')}
				description={t('cabinetPage.setup.teamDescription')}
				helpBlockId="setup.team"
			>
				{!selectedProjectId ? (
					<DesktopAppEmptyState
						title={t('cabinetPage.setup.teamPickProjectTitle')}
						description={t('cabinetPage.setup.teamPickProjectDescription')}
					/>
				) : projectMembersInfiniteQuery.isLoading ? (
					<LoadingGrid />
				) : projectMembersInfiniteQuery.isError ? (
					<DesktopAppErrorState
						message={extractApiErrorMessage(
							projectMembersInfiniteQuery.error,
							t('cabinetPage.setup.teamLoadError')
						)}
						onAction={() => void projectMembersInfiniteQuery.refetch()}
					/>
				) : (
					<div
						className={cn(
							'space-y-4',
							isProjectLead &&
								'xl:grid xl:grid-cols-[1fr_min(22rem)] xl:items-start xl:gap-6'
						)}
					>
						<div className="min-w-0 space-y-4">
							{!isProjectLead ? (
								<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
									{t('cabinetPage.setup.teamReadOnlyHint')}
								</p>
							) : (
								<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
									{t('cabinetPage.setup.teamAccessIntro')}
								</p>
							)}
							{sortedTeamMembers.length > 0 ? (
								<p className="text-xs font-medium text-(--desktop-text-secondary)">
									{teamMembersTruncated
										? t('cabinetPage.listFetchSummaryTruncated', {
												shown: sortedTeamMembers.length,
												total: projectMembersTotal,
											})
										: t('cabinetPage.setup.teamMemberCount', {
												count: sortedTeamMembers.length,
											})}
								</p>
							) : null}
							<div className="space-y-2">
								{sortedTeamMembers.length > 0 ? (
									<>
										<MarketingCabinetTeamMemberList
											members={sortedTeamMembers}
											selectedProjectId={selectedProjectId}
											selectedProject={selectedProject}
											isProjectLead={isProjectLead}
											user={user}
											teamAccessMemberId={teamAccessMemberId}
											setTeamAccessMemberId={setTeamAccessMemberId}
											teamAccessDraft={teamAccessDraft}
											setTeamAccessDraft={setTeamAccessDraft}
											teamAccessModuleSlugs={teamAccessModuleSlugs}
											friendMetaForMemberUserId={friendMetaForMemberUserId}
											labelForMemberUserId={labelForMemberUserId}
											removeProjectMemberMutation={removeProjectMemberMutation}
											updateMemberPermissionsMutation={
												updateMemberPermissionsMutation
											}
											setTeamRemoveConfirm={setTeamRemoveConfirm}
											checkboxControl={checkboxControl}
										/>
										{teamMembersHasMore ? (
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="sm"
												className="w-full"
												disabled={
													projectMembersInfiniteQuery.isFetchingNextPage
												}
												onClick={() => {
													const fetchNext =
														projectMembersInfiniteQuery.fetchNextPage;
													if (fetchNext) void fetchNext();
												}}
											>
												{projectMembersInfiniteQuery.isFetchingNextPage ? (
													<ArrowPathIcon
														className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
														strokeWidth={DESKTOP_LUCIDE.stroke}
													/>
												) : null}
												{t('cabinetPage.setup.teamLoadMoreMembers')}
											</DesktopAppButton>
										) : null}
									</>
								) : (
									<DesktopAppEmptyState
										title={t('cabinetPage.setup.teamEmptyTitle')}
										description={t('cabinetPage.setup.teamEmptyDescription')}
									/>
								)}
							</div>
						</div>
						{isProjectLead ? (
							<div className="min-w-0 space-y-4 xl:sticky xl:top-2">
								<DesktopAppSurface variant="soft" className="space-y-3 p-3">
									<DesktopAppSectionLabel>
										{t('cabinetPage.setup.teamInviteTitle')}
									</DesktopAppSectionLabel>
									<FieldLabel label={t('cabinetPage.setup.teamInviteFriend')}>
										<FriendPicker
											className="max-h-40 overflow-y-auto rounded-md border border-(--desktop-border-subtle)/50 p-1"
											title={t('cabinetPage.setup.teamInvitePickerTitle')}
											friends={friendsEligibleForTeam}
											loading={friendsListQuery.isLoading}
											error={
												friendsListQuery.isError
													? (friendsListQuery.error?.message ?? null)
													: null
											}
											emptyMessage={t(
												'cabinetPage.setup.teamInvitePickerEmpty'
											)}
											onPick={(friend) => {
												setTeamInviteUserId(friend.id);
											}}
										/>
									</FieldLabel>
									{teamInviteUserId ? (
										<div
											className={cn(
												'flex items-center gap-2',
												DESKTOP_TYPOGRAPHY.meta
											)}
										>
											{(() => {
												const f = friendsListQuery.data?.find(
													(x) => x.id === teamInviteUserId
												);
												return (
													<FriendAvatar
														className="h-8! w-8! text-[11px]"
														avatarUrl={f?.avatar_url}
														username={f?.username}
														fullName={f?.full_name}
														alt=""
													/>
												);
											})()}
											<span className="min-w-0 leading-snug">
												{t('cabinetPage.setup.teamInviteSelected', {
													name: (() => {
														const f = friendsListQuery.data?.find(
															(x) => x.id === teamInviteUserId
														);
														return f
															? getFriendDisplayName(f.username, f.full_name)
															: teamInviteUserId;
													})(),
												})}
											</span>
										</div>
									) : null}
									<FieldLabel label={t('cabinetPage.setup.teamInviteRole')}>
										<MarketingCabinetSelect
											value={teamInviteRole}
											onChange={(v) => setTeamInviteRole(v)}
											options={projectTeamRoleInviteOptions}
											aria-label={t('cabinetPage.setup.teamInviteRole')}
										/>
									</FieldLabel>
									<DesktopAppButton
										type="button"
										variant="accent"
										size="sm"
										disabled={
											!teamInviteUserId ||
											addProjectMemberMutation.isPending ||
											!selectedProjectId
										}
										onClick={() => {
											if (!selectedProjectId || !teamInviteUserId) return;
											addProjectMemberMutation.mutate({
												projectId: selectedProjectId,
												userId: teamInviteUserId,
												role: teamInviteRole,
											});
										}}
									>
										{addProjectMemberMutation.isPending ? (
											<ArrowPathIcon
												className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										) : (
											<PlusIcon
												className="h-4 w-4"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										)}
										{t('cabinetPage.setup.teamAddMember')}
									</DesktopAppButton>
								</DesktopAppSurface>
								<DesktopAppSurface variant="soft" className="space-y-3 p-3">
									<DesktopAppSectionLabel>
										{t('cabinetPage.setup.teamTransferTitle')}
									</DesktopAppSectionLabel>
									<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
										{t('cabinetPage.setup.teamTransferDescription')}
									</p>
									<FieldLabel label={t('cabinetPage.setup.teamTransferSelect')}>
										<MarketingCabinetSelect
											value={transferLeadToUserId}
											onChange={setTransferLeadToUserId}
											options={transferLeadSelectOptions}
											aria-label={t('cabinetPage.setup.teamTransferSelect')}
										/>
									</FieldLabel>
									<DesktopAppButton
										type="button"
										variant="accent"
										size="sm"
										disabled={
											!transferLeadToUserId ||
											transferProjectLeadMutation.isPending ||
											!selectedProjectId
										}
										onClick={() => {
											if (!selectedProjectId || !transferLeadToUserId) return;
											const transferPick = transferLeadSelectOptions.find(
												(o) => o.value === transferLeadToUserId
											);
											const nm =
												transferPick?.label?.split(' · ')[0]?.trim() ??
												transferLeadToUserId;
											setTeamTransferConfirm({
												newLeadUserId: transferLeadToUserId,
												displayName: nm,
											});
										}}
									>
										{transferProjectLeadMutation.isPending ? (
											<ArrowPathIcon
												className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										) : null}
										{t('cabinetPage.setup.teamTransferSubmit')}
									</DesktopAppButton>
								</DesktopAppSurface>
							</div>
						) : null}
					</div>
				)}
			</SectionPanel>
		</div>
	);
}
