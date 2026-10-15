/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local UI state cluster for MarketingCabinetPage: forms, modals, team, sidebar, search.
 *
 * Invariants:
 * - Single SoT per page instance; consumed by useMarketingCabinetPageCompose only.
 *
 * Related:
 * - marketingCabinetPageTypes.ts, useMarketingCabinetPageCompose.ts
 */

import { useCallback, useRef, useState } from 'react';
import type {
	CompanyFormState,
	CompetitorFormState,
	JobStoryFormState,
	ProjectFormState,
	ResearchFormState,
	SwotManualFormState,
	ValuePropFormState,
} from '@/pages/MarketingCabinet/marketingCabinetPageTypes';
import type {
	MarketingCompany,
	MarketingCompetitor,
	MarketingJobStory,
	MarketingProject,
	MarketingSwot,
} from '@/pages/MarketingCabinet/marketingCabinetApi';
import type { MarketingCabinetSidebarNavLayoutMode } from '@/pages/MarketingCabinet/shell/MarketingCabinetSidebar';
import type { TeamAccessDraft } from '@/pages/MarketingCabinet/utils/teamMemberMcPermissions';
import {
	MARKETING_SIDEBAR_COMPACT_STORAGE_KEY,
	MARKETING_SIDEBAR_PINNED_STORAGE_KEY,
} from '@/pages/MarketingCabinet/marketingCabinetPageHelpers';

export function useMarketingCabinetPageLocalState() {
	const [selectedJobStoryIds, setSelectedJobStoryIds] = useState<string[]>([]);
	const [marketingGuideOpen, setMarketingGuideOpen] = useState(false);
	const openMarketingGuide = useCallback(() => setMarketingGuideOpen(true), []);
	const [foundationContextEngaged, setFoundationContextEngaged] =
		useState(false);
	const engageFoundationContext = useCallback(() => {
		setFoundationContextEngaged(true);
	}, []);
	const [toolbarContentEngaged, setToolbarContentEngaged] = useState(false);
	const engageToolbarContent = useCallback(() => {
		setToolbarContentEngaged(true);
	}, []);

	const previousProjectIdRef = useRef<string | null>(null);
	const skipFocusModuleTitleOnMountRef = useRef(true);

	const [deleteModal, setDeleteModal] = useState<{
		type:
			| 'company'
			| 'project'
			| 'job'
			| 'valueProp'
			| 'competitor'
			| 'research'
			| 'swot';
		id: string;
		name: string;
	} | null>(null);
	const [editingJobStory, setEditingJobStory] =
		useState<MarketingJobStory | null>(null);
	const [jtbdContextMenu, setJtbdContextMenu] = useState<{
		x: number;
		y: number;
		job: MarketingJobStory;
	} | null>(null);
	const jtbdMenuRef = useRef<HTMLDivElement>(null);
	const [editingSwot, setEditingSwot] = useState<MarketingSwot | null>(null);
	const [editingCompetitor, setEditingCompetitor] =
		useState<MarketingCompetitor | null>(null);
	const [editingCompany, setEditingCompany] = useState<MarketingCompany | null>(
		null
	);
	const [creatingCompany, setCreatingCompany] = useState(false);
	const [editingProject, setEditingProject] = useState<MarketingProject | null>(
		null
	);
	const [creatingProject, setCreatingProject] = useState(false);
	const [teamInviteUserId, setTeamInviteUserId] = useState<string | null>(null);
	const [teamInviteRole, setTeamInviteRole] = useState('member');
	const [teamAccessMemberId, setTeamAccessMemberId] = useState<string | null>(
		null
	);
	const [teamAccessDraft, setTeamAccessDraft] =
		useState<TeamAccessDraft | null>(null);
	const teamAccessOpenMemberIdRef = useRef<string | null>(null);
	const [teamRemoveConfirm, setTeamRemoveConfirm] = useState<{
		memberId: string;
		displayName: string;
	} | null>(null);
	const [teamTransferConfirm, setTeamTransferConfirm] = useState<{
		newLeadUserId: string;
		displayName: string;
	} | null>(null);
	const [transferLeadToUserId, setTransferLeadToUserId] = useState('');
	const [isSidebarHovered, setIsSidebarHovered] = useState(false);
	const [isSidebarFocusWithin, setIsSidebarFocusWithin] = useState(false);
	const [sidebarNavLayoutMode, setSidebarNavLayoutMode] =
		useState<MarketingCabinetSidebarNavLayoutMode>(() => {
			if (typeof window === 'undefined') return 'pinned_expanded';
			try {
				if (
					window.localStorage.getItem(MARKETING_SIDEBAR_COMPACT_STORAGE_KEY) ===
					'1'
				) {
					return 'icon_rail';
				}
				if (
					window.localStorage.getItem(MARKETING_SIDEBAR_PINNED_STORAGE_KEY) ===
					'1'
				) {
					return 'pinned_expanded';
				}
			} catch {
				/* localStorage unavailable */
			}
			return 'pinned_expanded';
		});
	const isSidebarPinned = sidebarNavLayoutMode === 'pinned_expanded';
	const isSidebarCompactLocked = sidebarNavLayoutMode === 'icon_rail';

	const [companyForm, setCompanyForm] = useState<CompanyFormState>({
		name: '',
		industry: '',
		website: '',
		description: '',
		size: 'small',
		representativeUserId: null,
		representativeDeferred: true,
	});
	const [projectForm, setProjectForm] = useState<ProjectFormState>({
		name: '',
		description: '',
		goals: '',
		key_tasks: '',
		category: 'marketing_campaign',
		priority: 'medium',
	});
	const [jobStoryForm, setJobStoryForm] = useState<JobStoryFormState>({
		title: '',
		situation: '',
		motivation: '',
		outcome: '',
		category: 'functional',
		priority: 'medium',
		importance_score: '',
		satisfaction_score: '',
		tags: '',
	});
	const [jobStoryExtractText, setJobStoryExtractText] = useState('');
	const [jobStoryExtractCount, setJobStoryExtractCount] = useState('6');
	const [jobStoryExtractRunId, setJobStoryExtractRunId] = useState<
		string | null
	>(null);
	const [jobStorySearch, setJobStorySearch] = useState('');
	const [valuePropForm, setValuePropForm] = useState<ValuePropFormState>({
		headline: '',
		subheadline: '',
		value_statement: '',
		proof_points: '',
		target_channels: '',
		status: 'draft',
	});
	const [swotGenerateContext, setSwotGenerateContext] = useState('');
	const [swotGenerateRunId, setSwotGenerateRunId] = useState<string | null>(
		null
	);
	const [researchRunPollId, setResearchRunPollId] = useState<string | null>(
		null
	);
	const [researchRunTargetId, setResearchRunTargetId] = useState<string | null>(
		null
	);
	const [swotManualForm, setSwotManualForm] = useState<SwotManualFormState>({
		title: '',
		executive_summary: '',
		strengths: '',
		weaknesses: '',
		opportunities: '',
		threats: '',
	});
	const [competitorForm, setCompetitorForm] = useState<CompetitorFormState>({
		name: '',
		website: '',
		description: '',
		competitor_type: 'direct',
		market_position: '',
		pricing_strategy: '',
		strengths: '',
		weaknesses: '',
	});
	const [researchSearch, setResearchSearch] = useState('');
	const [competitorSearch, setCompetitorSearch] = useState('');
	const [valuePropSearch, setValuePropSearch] = useState('');
	const [companySearch, setCompanySearch] = useState('');
	const [projectSearch, setProjectSearch] = useState('');
	const [researchForm, setResearchForm] = useState<ResearchFormState>({
		title: '',
		research_type: 'market',
		research_query: '',
		description: '',
		goals: '',
		priority: 'normal',
		status: 'draft',
		result_summary: '',
	});

	const contentScrollRef = useRef<HTMLElement | null>(null);
	const [showScrollTop, setShowScrollTop] = useState(false);

	return {
		selectedJobStoryIds,
		setSelectedJobStoryIds,
		marketingGuideOpen,
		setMarketingGuideOpen,
		openMarketingGuide,
		foundationContextEngaged,
		setFoundationContextEngaged,
		engageFoundationContext,
		toolbarContentEngaged,
		setToolbarContentEngaged,
		engageToolbarContent,
		previousProjectIdRef,
		skipFocusModuleTitleOnMountRef,
		deleteModal,
		setDeleteModal,
		editingJobStory,
		setEditingJobStory,
		jtbdContextMenu,
		setJtbdContextMenu,
		jtbdMenuRef,
		editingSwot,
		setEditingSwot,
		editingCompetitor,
		setEditingCompetitor,
		editingCompany,
		setEditingCompany,
		creatingCompany,
		setCreatingCompany,
		editingProject,
		setEditingProject,
		creatingProject,
		setCreatingProject,
		teamInviteUserId,
		setTeamInviteUserId,
		teamInviteRole,
		setTeamInviteRole,
		teamAccessMemberId,
		setTeamAccessMemberId,
		teamAccessDraft,
		setTeamAccessDraft,
		teamAccessOpenMemberIdRef,
		teamRemoveConfirm,
		setTeamRemoveConfirm,
		teamTransferConfirm,
		setTeamTransferConfirm,
		transferLeadToUserId,
		setTransferLeadToUserId,
		isSidebarHovered,
		setIsSidebarHovered,
		isSidebarFocusWithin,
		setIsSidebarFocusWithin,
		sidebarNavLayoutMode,
		setSidebarNavLayoutMode,
		isSidebarPinned,
		isSidebarCompactLocked,
		companyForm,
		setCompanyForm,
		projectForm,
		setProjectForm,
		jobStoryForm,
		setJobStoryForm,
		jobStoryExtractText,
		setJobStoryExtractText,
		jobStoryExtractCount,
		setJobStoryExtractCount,
		jobStoryExtractRunId,
		setJobStoryExtractRunId,
		jobStorySearch,
		setJobStorySearch,
		valuePropForm,
		setValuePropForm,
		swotGenerateContext,
		setSwotGenerateContext,
		swotGenerateRunId,
		setSwotGenerateRunId,
		researchRunPollId,
		setResearchRunPollId,
		researchRunTargetId,
		setResearchRunTargetId,
		swotManualForm,
		setSwotManualForm,
		competitorForm,
		setCompetitorForm,
		researchSearch,
		setResearchSearch,
		competitorSearch,
		setCompetitorSearch,
		valuePropSearch,
		setValuePropSearch,
		companySearch,
		setCompanySearch,
		projectSearch,
		setProjectSearch,
		researchForm,
		setResearchForm,
		contentScrollRef,
		showScrollTop,
		setShowScrollTop,
	};
}
