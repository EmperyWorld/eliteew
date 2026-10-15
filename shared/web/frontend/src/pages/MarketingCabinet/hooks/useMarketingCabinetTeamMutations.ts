import { useMutation, useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { cabinetNotify } from '../cabinetNotify';
import { marketingCabinetApi } from '../marketingCabinetApi';
import { marketingCabinetProjectMembersInvalidationQueryKey } from '../marketingCabinetQueryOptions';
import type { TeamAccessDraft } from '../utils/teamMemberMcPermissions';

export type MarketingCabinetTeamMutationsDeps = {
	t: (key: string, options?: Record<string, unknown>) => string;
	queryClient: ReturnType<typeof useQueryClient>;
	invalidateMarketingData: () => Promise<void>;
	raiseErrorNotice: (error: unknown, fallback: string) => void;
	teamAccessOpenMemberIdRef: React.MutableRefObject<string | null>;
	setTeamAccessDraft: React.Dispatch<
		React.SetStateAction<TeamAccessDraft | null>
	>;
	setTeamAccessMemberId: React.Dispatch<React.SetStateAction<string | null>>;
	setTeamInviteUserId: React.Dispatch<React.SetStateAction<string | null>>;
	setTransferLeadToUserId: React.Dispatch<React.SetStateAction<string>>;
};

export function useMarketingCabinetTeamMutations(
	deps: MarketingCabinetTeamMutationsDeps
) {
	const {
		t,
		queryClient,
		invalidateMarketingData,
		raiseErrorNotice,
		teamAccessOpenMemberIdRef,
		setTeamAccessDraft,
		setTeamAccessMemberId,
		setTeamInviteUserId,
		setTransferLeadToUserId,
	} = deps;

	const addProjectMemberMutation = useMutation({
		mutationFn: (vars: { projectId: string; userId: string; role: string }) =>
			marketingCabinetApi.addProjectMember(vars.projectId, {
				user_id: vars.userId,
				role: vars.role,
				permissions: [],
			}),
		onSuccess: async (_data, vars) => {
			await queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectMembersInvalidationQueryKey(
					vars.projectId
				),
			});
			await invalidateMarketingData();
			setTeamInviteUserId(null);
			cabinetNotify.success(t('cabinetPage.notices.teamMemberAdded'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.teamMemberAddFailed')),
	});

	const removeProjectMemberMutation = useMutation({
		mutationFn: (vars: { projectId: string; memberId: string }) =>
			marketingCabinetApi.removeProjectMember(vars.projectId, vars.memberId),
		onSuccess: async (_data, vars) => {
			const closeAccess = teamAccessOpenMemberIdRef.current === vars.memberId;
			if (closeAccess) {
				setTeamAccessDraft(null);
			}
			setTeamAccessMemberId((cur) => (cur === vars.memberId ? null : cur));
			await queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectMembersInvalidationQueryKey(
					vars.projectId
				),
			});
			await invalidateMarketingData();
			cabinetNotify.success(t('cabinetPage.notices.teamMemberRemoved'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.teamMemberRemoveFailed')),
	});

	const transferProjectLeadMutation = useMutation({
		mutationFn: (vars: { projectId: string; newLeadUserId: string }) =>
			marketingCabinetApi.transferProjectLead(
				vars.projectId,
				vars.newLeadUserId
			),
		onSuccess: async (_project, vars) => {
			await queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectMembersInvalidationQueryKey(
					vars.projectId
				),
			});
			await invalidateMarketingData();
			setTransferLeadToUserId('');
			cabinetNotify.success(t('cabinetPage.notices.teamLeadTransferred'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.teamLeadTransferFailed')),
	});

	const updateMemberPermissionsMutation = useMutation({
		mutationFn: (vars: {
			projectId: string;
			memberId: string;
			permissions: string[];
		}) =>
			marketingCabinetApi.updateProjectMember(vars.projectId, vars.memberId, {
				permissions: vars.permissions,
			}),
		onSuccess: async (_data, vars) => {
			await queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectMembersInvalidationQueryKey(
					vars.projectId
				),
			});
			await invalidateMarketingData();
			setTeamAccessMemberId(null);
			setTeamAccessDraft(null);
			cabinetNotify.success(t('cabinetPage.notices.teamAccessUpdated'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.teamAccessUpdateFailed')),
	});

	return {
		addProjectMemberMutation,
		removeProjectMemberMutation,
		transferProjectLeadMutation,
		updateMemberPermissionsMutation,
	};
}
