/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single project team member row + optional MC permissions editor panel.
 *
 * Invariants:
 * - Access panel only for project lead and non-lead rows.
 *
 * Related:
 * - TeamSection.tsx, MarketingCabinetTeamMemberList.tsx
 */
import type * as React from 'react';
import {
	AdjustmentsHorizontalIcon,
	ArrowPathIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { Friend } from '@/features/friends/types';
import { FriendAvatar } from '@/features/friends/components/FriendAvatar';
import { cn } from '@/utils/cn';

import {
	DesktopAppButton,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { localizeStatus } from '../locales';
import type {
	MarketingProject,
	MarketingProjectMember,
} from '../marketingCabinetApi';
import type { MutationLike } from '../marketingCabinetPage/marketingCabinetComposeHosts';
import { teamAccessSummaryText } from '../marketingCabinetPageHelpers';
import {
	arePermissionListsEqual,
	draftFromPermissions,
	getTeamAccessSummaryParts,
	permissionsFromDraft,
	type TeamAccessDraft,
} from '../utils/teamMemberMcPermissions';

export interface TeamMemberCardContextProps {
	selectedProjectId: string | null;
	selectedProject: MarketingProject | null;
	isProjectLead: boolean;
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
	setTeamRemoveConfirm: React.Dispatch<
		React.SetStateAction<{
			memberId: string;
			displayName: string;
		} | null>
	>;
	checkboxControl: string;
}

export function TeamMemberCard({
	member,
	selectedProjectId,
	selectedProject,
	isProjectLead,
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
	setTeamRemoveConfirm,
	checkboxControl,
}: TeamMemberCardContextProps & { member: MarketingProjectMember }) {
	const { t } = useTranslation('marketing');
	const leadId = selectedProject?.created_by?.trim() ?? '';
	const isLeadRow = member.user_id === leadId || member.role === 'owner';
	const roleLabelKey =
		member.role === 'owner'
			? 'owner'
			: ['admin', 'editor', 'member', 'viewer'].includes(member.role)
				? member.role
				: 'member';
	const accessOpen =
		isProjectLead &&
		!isLeadRow &&
		teamAccessMemberId === member.id &&
		Boolean(teamAccessDraft);
	const accessSummaryParts = getTeamAccessSummaryParts(
		member.permissions ?? [],
		teamAccessModuleSlugs
	);
	const accessSummaryLine = teamAccessSummaryText(t, accessSummaryParts);
	const memberFriend = friendMetaForMemberUserId(member.user_id);

	return (
		<div className="space-y-2">
			<div
				className={cn(
					'flex flex-wrap items-center justify-between gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/40 px-3 py-2',
					member.user_id.trim() === user?.id?.trim() &&
						'bg-(--desktop-surface-accent)/12 ring-1 ring-[rgb(var(--desktop-accent-rgb))]/40'
				)}
			>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-start gap-2.5">
						<FriendAvatar
							className="h-9! w-9! text-[11px]"
							avatarUrl={memberFriend?.avatar_url}
							username={memberFriend?.username}
							fullName={memberFriend?.full_name}
							alt=""
						/>
						<div className="min-w-0 flex-1">
							<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
								{labelForMemberUserId(member.user_id)}
								{isLeadRow
									? ` · ${t('cabinetPage.setup.teamLeadBadge')}`
									: null}
							</div>
							<div className={cn('truncate', DESKTOP_TYPOGRAPHY.meta)}>
								{t(`cabinetPage.setup.teamRole.${roleLabelKey}`)} ·{' '}
								{localizeStatus(member.status)}
							</div>
							<div
								className={cn(
									'mt-1 line-clamp-2 leading-snug',
									DESKTOP_TYPOGRAPHY.small
								)}
								title={accessSummaryLine}
							>
								{accessSummaryLine}
							</div>
						</div>
					</div>
				</div>
				{isProjectLead && !isLeadRow ? (
					<div className="flex shrink-0 items-center gap-1">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							active={accessOpen}
							disabled={
								removeProjectMemberMutation.isPending ||
								updateMemberPermissionsMutation.isPending
							}
							onClick={() => {
								if (teamAccessMemberId === member.id) {
									setTeamAccessMemberId(null);
									setTeamAccessDraft(null);
								} else {
									setTeamAccessMemberId(member.id);
									setTeamAccessDraft(
										draftFromPermissions(
											member.permissions ?? [],
											teamAccessModuleSlugs
										)
									);
								}
							}}
							aria-label={t('cabinetPage.setup.teamAccessOpenAria', {
								name: labelForMemberUserId(member.user_id),
							})}
						>
							<AdjustmentsHorizontalIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							{t('cabinetPage.setup.teamAccessOpen')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							disabled={removeProjectMemberMutation.isPending}
							onClick={() => {
								setTeamRemoveConfirm({
									memberId: member.id,
									displayName: labelForMemberUserId(member.user_id),
								});
							}}
							aria-label={t('cabinetPage.setup.teamRemoveMemberAria', {
								name: labelForMemberUserId(member.user_id),
							})}
						>
							<TrashIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					</div>
				) : null}
			</div>
			{accessOpen && teamAccessDraft ? (
				<DesktopAppSurface
					variant="soft"
					className="space-y-3 border border-(--desktop-border-subtle)/50 p-3"
				>
					<DesktopAppSectionLabel>
						{t('cabinetPage.setup.teamAccessPanelTitle')}
					</DesktopAppSectionLabel>
					<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
						{t('cabinetPage.setup.teamAccessPanelHint')}
					</p>
					<DesktopAppSectionLabel className="pt-1">
						{t('cabinetPage.setup.teamAccessShellSection')}
					</DesktopAppSectionLabel>
					<div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
						<label className="flex cursor-pointer items-start gap-2 text-sm text-(--desktop-text-secondary)">
							<input
								type="checkbox"
								className={checkboxControl}
								checked={teamAccessDraft.shell.overview}
								onChange={(e) => {
									const on = e.target.checked;
									setTeamAccessDraft((prev) =>
										prev
											? {
													...prev,
													shell: { ...prev.shell, overview: on },
												}
											: prev
									);
								}}
							/>
							<span>{t('cabinetPage.setup.teamAccessShellOverview')}</span>
						</label>
						<label className="flex cursor-pointer items-start gap-2 text-sm text-(--desktop-text-secondary)">
							<input
								type="checkbox"
								className={checkboxControl}
								checked={teamAccessDraft.shell.companies}
								onChange={(e) => {
									const on = e.target.checked;
									setTeamAccessDraft((prev) =>
										prev
											? {
													...prev,
													shell: { ...prev.shell, companies: on },
												}
											: prev
									);
								}}
							/>
							<span>{t('cabinetPage.setup.teamAccessShellCompanies')}</span>
						</label>
						<label className="flex cursor-pointer items-start gap-2 text-sm text-(--desktop-text-secondary)">
							<input
								type="checkbox"
								className={checkboxControl}
								checked={teamAccessDraft.shell.projects}
								onChange={(e) => {
									const on = e.target.checked;
									setTeamAccessDraft((prev) =>
										prev
											? {
													...prev,
													shell: { ...prev.shell, projects: on },
												}
											: prev
									);
								}}
							/>
							<span>{t('cabinetPage.setup.teamAccessShellProjects')}</span>
						</label>
					</div>
					{teamAccessModuleSlugs.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								disabled={updateMemberPermissionsMutation.isPending}
								onClick={() => {
									setTeamAccessDraft((prev) =>
										prev
											? {
													...prev,
													modules: Object.fromEntries(
														teamAccessModuleSlugs.map((s) => [s, true])
													),
													shell: {
														overview: true,
														companies: true,
														projects: true,
													},
												}
											: prev
									);
								}}
							>
								{t('cabinetPage.setup.teamAccessQuickAll')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								disabled={updateMemberPermissionsMutation.isPending}
								onClick={() => {
									setTeamAccessDraft((prev) =>
										prev
											? {
													...prev,
													modules: Object.fromEntries(
														teamAccessModuleSlugs.map((s) => [s, false])
													),
												}
											: prev
									);
								}}
							>
								{t('cabinetPage.setup.teamAccessQuickClear')}
							</DesktopAppButton>
						</div>
					) : null}
					{teamAccessModuleSlugs.length === 0 ? (
						<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
							{t('cabinetPage.setup.teamAccessNoModules')}
						</p>
					) : (
						<div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
							{teamAccessModuleSlugs.map((slug) => (
								<label
									key={slug}
									className="flex cursor-pointer items-start gap-2 text-sm text-(--desktop-text-secondary)"
								>
									<input
										type="checkbox"
										className={checkboxControl}
										checked={teamAccessDraft.modules[slug] ?? false}
										onChange={(e) => {
											const on = e.target.checked;
											setTeamAccessDraft((prev) =>
												prev
													? {
															...prev,
															modules: { ...prev.modules, [slug]: on },
														}
													: prev
											);
										}}
									/>
									<span>
										{t(`cabinetPage.setup.teamMcModule.${slug}`, {
											defaultValue: slug,
										})}
									</span>
								</label>
							))}
						</div>
					)}
					<label className="flex cursor-pointer items-start gap-2 text-sm text-(--desktop-text-secondary)">
						<input
							type="checkbox"
							className={checkboxControl}
							checked={teamAccessDraft.uploadVault}
							onChange={(e) => {
								const on = e.target.checked;
								setTeamAccessDraft((prev) =>
									prev ? { ...prev, uploadVault: on } : prev
								);
							}}
						/>
						<span>{t('cabinetPage.setup.teamAccessVault')}</span>
					</label>
					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							disabled={
								!selectedProjectId ||
								updateMemberPermissionsMutation.isPending ||
								arePermissionListsEqual(
									permissionsFromDraft(teamAccessModuleSlugs, teamAccessDraft),
									member.permissions ?? []
								)
							}
							onClick={() => {
								if (!selectedProjectId || !teamAccessDraft) return;
								updateMemberPermissionsMutation.mutate({
									projectId: selectedProjectId,
									memberId: member.id,
									permissions: permissionsFromDraft(
										teamAccessModuleSlugs,
										teamAccessDraft
									),
								});
							}}
						>
							{updateMemberPermissionsMutation.isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : null}
							{t('cabinetPage.setup.teamAccessSave')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							disabled={updateMemberPermissionsMutation.isPending}
							onClick={() => {
								setTeamAccessMemberId(null);
								setTeamAccessDraft(null);
							}}
						>
							{t('cabinetPage.setup.teamAccessClose')}
						</DesktopAppButton>
					</div>
				</DesktopAppSurface>
			) : null}
		</div>
	);
}
