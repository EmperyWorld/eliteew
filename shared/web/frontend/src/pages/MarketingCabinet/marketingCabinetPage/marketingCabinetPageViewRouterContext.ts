/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * View-router context type and builder for MarketingCabinetPage atomization.
 *
 * Invariants:
 * - Shape matches pre-atomization activeView branch props exactly.
 *
 * Related:
 * - MarketingCabinetPageViewRouter.tsx, useMarketingCabinetPageCompose.ts
 */

import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import type { Friend } from '@/features/friends/types';
import type { UserProfileResponse } from '@/types/profile';
import type {
	MarketingAiRunDetailResponse,
	MarketingCompany,
	MarketingCompetitor,
	MarketingContentItem,
	MarketingJobStory,
	MarketingListResponse,
	MarketingOption,
	MarketingProject,
	MarketingProjectDashboard,
	MarketingProjectMember,
	MarketingProjectMembersListResponse,
	MarketingResearch,
	MarketingSwot,
	MarketingValueProposition,
} from '@/pages/MarketingCabinet/marketingCabinetApi';
import type {
	ChatTimelineMessage,
	CompanyFormState,
	CompetitorFormState,
	JobStoryFormState,
	ProjectFormState,
	ResearchFormState,
	SwotManualFormState,
	ValuePropFormState,
} from '@/pages/MarketingCabinet/marketingCabinetPageTypes';
import type { TeamAccessDraft } from '@/pages/MarketingCabinet/utils/teamMemberMcPermissions';

import type { MutationLike, QueryLike } from './marketingCabinetComposeHosts';

export type { MutationLike, QueryLike } from './marketingCabinetComposeHosts';

/**
 * Composition-boundary callbacks — bivariant (same trick as React.EventHandler)
 * so concrete FormEvent/Dispatch handlers assign without `as any`.
 */
type LooseFn = {
	// biome-ignore lint/suspicious/noExplicitAny: bag/compose seam — bivariant callback host
	bivarianceHack(...args: any[]): any;
}['bivarianceHack'];

type FriendMeta =
	| Friend
	| undefined
	| {
			id: string;
			username: string | null;
			avatar_url: string | null;
			full_name: string | null;
	  };

type ResearchTypeOption = { id: string; label: string };

export type MarketingCabinetPageViewRouterContext = {
	t: TFunction<'marketing'>;
	activeView: string;
	setActiveView: LooseFn;
	selectedProjectId: string | null;
	selectedProject: MarketingProject | null;
	selectedCompanyId: string | null;
	selectedCompany: MarketingCompany | null;
	focusedEntityId: string | null;
	setFocusedEntityId: LooseFn;
	allowMarketingWrite: boolean;
	projectDashboardQuery: QueryLike<MarketingProjectDashboard>;
	latestSwot: MarketingSwot | null;
	handleOverviewNavigate: LooseFn;
	exitOverviewDashboardToCardGrid: () => void;
	companiesQuery: QueryLike<MarketingCompany[]>;
	companies: MarketingCompany[];
	filteredCompanies: MarketingCompany[];
	setSelectedCompanyId: LooseFn;
	companySearch: string;
	setCompanySearch: LooseFn;
	debouncedCompanySearch: string;
	editingCompany: MarketingCompany | null;
	setEditingCompany: LooseFn;
	creatingCompany: boolean;
	setCreatingCompany: LooseFn;
	companyForm: CompanyFormState;
	setCompanyForm: LooseFn;
	companySizeSelectOptions: Array<{ value: string; label: string }>;
	createCompanyMutation: MutationLike;
	updateCompanyMutation: MutationLike;
	handleCreateCompany: LooseFn;
	friendsListQuery: QueryLike<Friend[]>;
	friendMetaForMemberUserId: (memberUserId: string) => FriendMeta;
	canManageSelectedCompany: boolean;
	setDeleteModal: LooseFn;
	requestSetSelectedProjectId: LooseFn;
	projectsPageCompanyOptions: Array<{ value: string; label: string }>;
	projectSearch: string;
	setProjectSearch: LooseFn;
	debouncedProjectSearch: string;
	filteredProjects: MarketingProject[];
	projects: MarketingProject[];
	projectsQuery: QueryLike<MarketingProject[]>;
	editingProject: MarketingProject | null;
	setEditingProject: LooseFn;
	creatingProject: boolean;
	setCreatingProject: LooseFn;
	projectForm: ProjectFormState;
	setProjectForm: LooseFn;
	projectCategorySelectOptions: Array<{ value: string; label: string }>;
	projectFormPriorityOptions: Array<{ value: string; label: string }>;
	createProjectMutation: MutationLike;
	updateProjectMutation: MutationLike;
	handleCreateProject: LooseFn;
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
	setTeamAccessMemberId: LooseFn;
	teamAccessDraft: TeamAccessDraft | null;
	setTeamAccessDraft: LooseFn;
	teamAccessModuleSlugs: string[];
	labelForMemberUserId: (memberUserId: string) => string;
	removeProjectMemberMutation: MutationLike;
	updateMemberPermissionsMutation: MutationLike;
	addProjectMemberMutation: MutationLike;
	transferProjectLeadMutation: MutationLike;
	friendsEligibleForTeam: Friend[];
	teamInviteUserId: string | null;
	setTeamInviteUserId: LooseFn;
	teamInviteRole: string;
	setTeamInviteRole: LooseFn;
	projectTeamRoleInviteOptions: Array<{ value: string; label: string }>;
	transferLeadToUserId: string;
	setTransferLeadToUserId: LooseFn;
	transferLeadSelectOptions: Array<{ value: string; label: string }>;
	setTeamRemoveConfirm: LooseFn;
	setTeamTransferConfirm: LooseFn;
	jobStorySearch: string;
	setJobStorySearch: LooseFn;
	debouncedJobStorySearch: string;
	allJobStories: MarketingJobStory[];
	filteredJobStories: MarketingJobStory[];
	jobStoriesQuery: QueryLike<MarketingListResponse<MarketingJobStory>>;
	selectedJobStoryIds: string[];
	setSelectedJobStoryIds: LooseFn;
	handleCopyAllJobs: LooseFn;
	handleExportJobs: LooseFn;
	handleCopySingleJob: LooseFn;
	setJtbdContextMenu: LooseFn;
	createJobStoryMutation: MutationLike;
	extractJobStoriesMutation: MutationLike;
	jobStoryForm: JobStoryFormState;
	setJobStoryForm: LooseFn;
	jobStoryCategorySelectOptions: Array<{ value: string; label: string }>;
	jobStoryPrioritySelectOptions: Array<{ value: string; label: string }>;
	handleCreateJobStory: LooseFn;
	handleExtractJobStories: LooseFn;
	jobStoryExtractText: string;
	setJobStoryExtractText: LooseFn;
	jobStoryExtractCount: string;
	setJobStoryExtractCount: LooseFn;
	jobStoryExtractRunId: string | null;
	jobStoryExtractRunQuery: QueryLike<MarketingAiRunDetailResponse>;
	setEditingJobStory: LooseFn;
	jtbdVpOpsUrlTick: number;
	setJtbdVpOpsUrlTick: Dispatch<SetStateAction<number>>;
	valuePropSearch: string;
	setValuePropSearch: LooseFn;
	debouncedValuePropSearch: string;
	filteredValuePropositions: MarketingValueProposition[];
	valuePropositions: MarketingValueProposition[];
	valuePropsQuery: QueryLike<MarketingListResponse<MarketingValueProposition>>;
	handleCopyAllValueProps: LooseFn;
	handleExportValueProps: LooseFn;
	handleCopySingleValueProp: LooseFn;
	valuePropForm: ValuePropFormState;
	setValuePropForm: LooseFn;
	valuePropInlineStatusOptions: Array<{ value: string; label: string }>;
	handleCreateValueProp: LooseFn;
	createValuePropMutation: MutationLike;
	updateValuePropMutation: MutationLike;
	swotItems: MarketingSwot[];
	swotQuery: QueryLike<MarketingListResponse<MarketingSwot>>;
	handleCopyAllSwot: LooseFn;
	handleExportSwot: LooseFn;
	handleCopySingleSwot: LooseFn;
	generateSwotMutation: MutationLike;
	swotGenerateRunId: string | null;
	swotGenerateRunQuery: QueryLike<MarketingAiRunDetailResponse>;
	swotGenerateContext: string;
	setSwotGenerateContext: LooseFn;
	setEditingSwot: LooseFn;
	swotManualForm: SwotManualFormState;
	setSwotManualForm: LooseFn;
	handleCreateSwot: LooseFn;
	createSwotMutation: MutationLike;
	competitors: MarketingCompetitor[];
	filteredCompetitors: MarketingCompetitor[];
	competitorsQuery: QueryLike<MarketingListResponse<MarketingCompetitor>>;
	competitorSearch: string;
	setCompetitorSearch: LooseFn;
	debouncedCompetitorSearch: string;
	handleCopyAllCompetitors: LooseFn;
	handleExportCompetitors: LooseFn;
	handleCopySingleCompetitor: LooseFn;
	setEditingCompetitor: LooseFn;
	competitorForm: CompetitorFormState;
	setCompetitorForm: LooseFn;
	competitorTypeSelectOptions: Array<{ value: string; label: string }>;
	handleCreateCompetitor: LooseFn;
	createCompetitorMutation: MutationLike;
	setResearchUrlTick: Dispatch<SetStateAction<number>>;
	researchSearch: string;
	setResearchSearch: LooseFn;
	debouncedResearchSearch: string;
	filteredResearches: MarketingResearch[];
	researchesQuery: QueryLike<MarketingListResponse<MarketingResearch>>;
	researchForm: ResearchFormState;
	setResearchForm: LooseFn;
	createResearchMutation: MutationLike;
	handleCreateResearch: LooseFn;
	handleExportResearches: LooseFn;
	canExportResearches: boolean;
	handleCopyAllResearches: LooseFn;
	contentQuery: QueryLike<MarketingListResponse<MarketingContentItem>>;
	contentItems: MarketingContentItem[];
	handleOpenContentManagerFromCabinet: () => void;
	researchTypes: ResearchTypeOption[] | MarketingOption[];
	runResearchAsyncMutation: MutationLike;
	researchRunTargetId: string | null;
	researchRunPollId: string | null;
	researchAiRunDetail: MarketingAiRunDetailResponse | null | undefined;
	readOnlyMarketing: boolean;
	chatMessages: ChatTimelineMessage[];
	chatDraft: string;
	setChatDraft: LooseFn;
	sendChatMutation: MutationLike;
	sendToolAgentChatMutation: MutationLike;
	handleSendChatMessage: LooseFn;
	handleSendToolAgentMessage: LooseFn;
	clearChatSession: () => void;
	selfProfileQuery: QueryLike<UserProfileResponse>;
};

/** Nested bags from compose + leaf fields (Cause A: not Record<string, unknown>). */
type ViewRouterRemappedKey =
	| 'companySizeSelectOptions'
	| 'createCompanyMutation'
	| 'updateCompanyMutation'
	| 'handleCreateCompany'
	| 'projectCategorySelectOptions'
	| 'projectFormPriorityOptions'
	| 'createProjectMutation'
	| 'updateProjectMutation'
	| 'handleCreateProject'
	| 'removeProjectMemberMutation'
	| 'updateMemberPermissionsMutation'
	| 'addProjectMemberMutation'
	| 'transferProjectLeadMutation'
	| 'projectTeamRoleInviteOptions'
	| 'handleCopyAllJobs'
	| 'handleExportJobs'
	| 'handleCopySingleJob'
	| 'createJobStoryMutation'
	| 'extractJobStoriesMutation'
	| 'jobStoryCategorySelectOptions'
	| 'jobStoryPrioritySelectOptions'
	| 'handleCreateJobStory'
	| 'handleExtractJobStories'
	| 'handleCopyAllValueProps'
	| 'handleExportValueProps'
	| 'handleCopySingleValueProp'
	| 'valuePropInlineStatusOptions'
	| 'handleCreateValueProp'
	| 'createValuePropMutation'
	| 'updateValuePropMutation'
	| 'handleCopyAllSwot'
	| 'handleExportSwot'
	| 'handleCopySingleSwot'
	| 'generateSwotMutation'
	| 'handleCreateSwot'
	| 'createSwotMutation'
	| 'handleCopyAllCompetitors'
	| 'handleExportCompetitors'
	| 'handleCopySingleCompetitor'
	| 'competitorTypeSelectOptions'
	| 'handleCreateCompetitor'
	| 'createCompetitorMutation'
	| 'createResearchMutation'
	| 'handleCreateResearch'
	| 'handleExportResearches'
	| 'handleCopyAllResearches'
	| 'runResearchAsyncMutation'
	| 'researchAiRunDetail'
	| 'chatMessages'
	| 'chatDraft'
	| 'setChatDraft'
	| 'sendChatMutation'
	| 'sendToolAgentChatMutation'
	| 'handleSendChatMessage'
	| 'handleSendToolAgentMessage'
	| 'clearChatSession';

export type MarketingCabinetViewRouterComposeDeps = Omit<
	MarketingCabinetPageViewRouterContext,
	ViewRouterRemappedKey
> & {
	formOptions: {
		companySizeSelectOptions: MarketingCabinetPageViewRouterContext['companySizeSelectOptions'];
		projectCategorySelectOptions: MarketingCabinetPageViewRouterContext['projectCategorySelectOptions'];
		projectFormPriorityOptions: MarketingCabinetPageViewRouterContext['projectFormPriorityOptions'];
		projectTeamRoleInviteOptions: MarketingCabinetPageViewRouterContext['projectTeamRoleInviteOptions'];
		jobStoryCategorySelectOptions: MarketingCabinetPageViewRouterContext['jobStoryCategorySelectOptions'];
		jobStoryPrioritySelectOptions: MarketingCabinetPageViewRouterContext['jobStoryPrioritySelectOptions'];
		valuePropInlineStatusOptions: MarketingCabinetPageViewRouterContext['valuePropInlineStatusOptions'];
		competitorTypeSelectOptions: MarketingCabinetPageViewRouterContext['competitorTypeSelectOptions'];
	};
	orgMutations: {
		createCompanyMutation: MarketingCabinetPageViewRouterContext['createCompanyMutation'];
		updateCompanyMutation: MarketingCabinetPageViewRouterContext['updateCompanyMutation'];
		createProjectMutation: MarketingCabinetPageViewRouterContext['createProjectMutation'];
		updateProjectMutation: MarketingCabinetPageViewRouterContext['updateProjectMutation'];
	};
	teamMutations: {
		removeProjectMemberMutation: MarketingCabinetPageViewRouterContext['removeProjectMemberMutation'];
		updateMemberPermissionsMutation: MarketingCabinetPageViewRouterContext['updateMemberPermissionsMutation'];
		addProjectMemberMutation: MarketingCabinetPageViewRouterContext['addProjectMemberMutation'];
		transferProjectLeadMutation: MarketingCabinetPageViewRouterContext['transferProjectLeadMutation'];
	};
	contentMutations: {
		createJobStoryMutation: MarketingCabinetPageViewRouterContext['createJobStoryMutation'];
		extractJobStoriesMutation: MarketingCabinetPageViewRouterContext['extractJobStoriesMutation'];
		createValuePropMutation: MarketingCabinetPageViewRouterContext['createValuePropMutation'];
		updateValuePropMutation: MarketingCabinetPageViewRouterContext['updateValuePropMutation'];
		generateSwotMutation: MarketingCabinetPageViewRouterContext['generateSwotMutation'];
		createSwotMutation: MarketingCabinetPageViewRouterContext['createSwotMutation'];
		createCompetitorMutation: MarketingCabinetPageViewRouterContext['createCompetitorMutation'];
		createResearchMutation: MarketingCabinetPageViewRouterContext['createResearchMutation'];
		runResearchAsyncMutation: MarketingCabinetPageViewRouterContext['runResearchAsyncMutation'];
	};
	sectionHandlers: {
		handleCreateCompany: MarketingCabinetPageViewRouterContext['handleCreateCompany'];
		handleCreateProject: MarketingCabinetPageViewRouterContext['handleCreateProject'];
		handleCopyAllJobs: MarketingCabinetPageViewRouterContext['handleCopyAllJobs'];
		handleExportJobs: MarketingCabinetPageViewRouterContext['handleExportJobs'];
		handleCopySingleJob: MarketingCabinetPageViewRouterContext['handleCopySingleJob'];
		handleCreateJobStory: MarketingCabinetPageViewRouterContext['handleCreateJobStory'];
		handleExtractJobStories: MarketingCabinetPageViewRouterContext['handleExtractJobStories'];
		handleCopyAllValueProps: MarketingCabinetPageViewRouterContext['handleCopyAllValueProps'];
		handleExportValueProps: MarketingCabinetPageViewRouterContext['handleExportValueProps'];
		handleCopySingleValueProp: MarketingCabinetPageViewRouterContext['handleCopySingleValueProp'];
		handleCreateValueProp: MarketingCabinetPageViewRouterContext['handleCreateValueProp'];
		handleCopyAllSwot: MarketingCabinetPageViewRouterContext['handleCopyAllSwot'];
		handleExportSwot: MarketingCabinetPageViewRouterContext['handleExportSwot'];
		handleCopySingleSwot: MarketingCabinetPageViewRouterContext['handleCopySingleSwot'];
		handleCreateSwot: MarketingCabinetPageViewRouterContext['handleCreateSwot'];
		handleCopyAllCompetitors: MarketingCabinetPageViewRouterContext['handleCopyAllCompetitors'];
		handleExportCompetitors: MarketingCabinetPageViewRouterContext['handleExportCompetitors'];
		handleCopySingleCompetitor: MarketingCabinetPageViewRouterContext['handleCopySingleCompetitor'];
		handleCreateCompetitor: MarketingCabinetPageViewRouterContext['handleCreateCompetitor'];
		handleCreateResearch: MarketingCabinetPageViewRouterContext['handleCreateResearch'];
		handleExportResearches: MarketingCabinetPageViewRouterContext['handleExportResearches'];
		handleCopyAllResearches: MarketingCabinetPageViewRouterContext['handleCopyAllResearches'];
	};
	chat: {
		chatMessages: MarketingCabinetPageViewRouterContext['chatMessages'];
		chatDraft: MarketingCabinetPageViewRouterContext['chatDraft'];
		setChatDraft: MarketingCabinetPageViewRouterContext['setChatDraft'];
		sendChatMutation: MarketingCabinetPageViewRouterContext['sendChatMutation'];
		sendToolAgentChatMutation: MarketingCabinetPageViewRouterContext['sendToolAgentChatMutation'];
		handleSendChatMessage: MarketingCabinetPageViewRouterContext['handleSendChatMessage'];
		handleSendToolAgentMessage: MarketingCabinetPageViewRouterContext['handleSendToolAgentMessage'];
		clearChatSession: MarketingCabinetPageViewRouterContext['clearChatSession'];
	};
	researchRunDetailQuery: QueryLike<MarketingAiRunDetailResponse>;
};
