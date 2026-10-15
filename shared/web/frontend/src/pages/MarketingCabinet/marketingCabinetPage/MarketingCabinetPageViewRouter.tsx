/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Active-view branch router for MarketingCabinetPage — all 22 cabinet module views.
 *
 * Invariants:
 * - Branch props match pre-atomization MarketingCabinetPage.tsx behavior exactly.
 *
 * Related:
 * - useMarketingCabinetPageCompose.ts, marketingCabinetPageLazyImports.ts
 */

import { Suspense } from 'react';
import {
	DesktopAppErrorState,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { getFriendDisplayName } from '@/features/friends/components/FriendAvatar';
import { cabinetNotify } from '@/pages/MarketingCabinet/cabinetNotify';
import { EmptyProjectState } from '@/pages/MarketingCabinet/components/EmptyProjectState';
import { LoadingGrid } from '@/pages/MarketingCabinet/components/LoadingGrid';
import { projectHasImcCabinetSlug } from '@/pages/MarketingCabinet/constants';
import {
	localizePriority,
	localizeResearchTypeSafe,
	localizeStatus,
} from '@/pages/MarketingCabinet/locales';
import {
	copyToClipboard,
	extractApiErrorMessage,
} from '@/pages/MarketingCabinet/utils';
import {
	AIStudioView,
	AmkaView,
	AnalysisSection,
	CampaignsView,
	ChatView,
	ClientInteractionView,
	CompaniesSection,
	EvidenceView,
	FunnelView,
	ImcResearchView,
	JtbdSection,
	OperationsView,
	OverviewInteractiveDashboard,
	OverviewView,
	ProjectRagSourcesView,
	ProjectsSection,
	SegmentsView,
	TeamSection,
	ValuePropsSection,
} from './marketingCabinetPageLazyImports';
import type { MarketingCabinetPageViewRouterContext } from './marketingCabinetPageViewRouterContext';

export type { MarketingCabinetPageViewRouterContext };

type ViewRouterProps = {
	ctx: MarketingCabinetPageViewRouterContext;
};

export function MarketingCabinetPageViewRouter({ ctx }: ViewRouterProps) {
	const {
		t,
		activeView,
		setActiveView,
		selectedProjectId,
		selectedProject,
		selectedCompanyId,
		selectedCompany,
		focusedEntityId,
		setFocusedEntityId,
		allowMarketingWrite,
		projectDashboardQuery,
		latestSwot,
		handleOverviewNavigate,
		exitOverviewDashboardToCardGrid,
		companiesQuery,
		companies,
		filteredCompanies,
		setSelectedCompanyId,
		companySearch,
		setCompanySearch,
		debouncedCompanySearch,
		editingCompany,
		setEditingCompany,
		creatingCompany,
		setCreatingCompany,
		companyForm,
		setCompanyForm,
		companySizeSelectOptions,
		createCompanyMutation,
		updateCompanyMutation,
		handleCreateCompany,
		friendsListQuery,
		friendMetaForMemberUserId,
		canManageSelectedCompany,
		setDeleteModal,
		requestSetSelectedProjectId,
		projectsPageCompanyOptions,
		projectSearch,
		setProjectSearch,
		debouncedProjectSearch,
		filteredProjects,
		projects,
		projectsQuery,
		editingProject,
		setEditingProject,
		creatingProject,
		setCreatingProject,
		projectForm,
		setProjectForm,
		projectCategorySelectOptions,
		projectFormPriorityOptions,
		createProjectMutation,
		updateProjectMutation,
		handleCreateProject,
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
		labelForMemberUserId,
		removeProjectMemberMutation,
		updateMemberPermissionsMutation,
		addProjectMemberMutation,
		transferProjectLeadMutation,
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
		jobStorySearch,
		setJobStorySearch,
		debouncedJobStorySearch,
		allJobStories,
		filteredJobStories,
		jobStoriesQuery,
		selectedJobStoryIds,
		setSelectedJobStoryIds,
		handleCopyAllJobs,
		handleExportJobs,
		handleCopySingleJob,
		setJtbdContextMenu,
		createJobStoryMutation,
		extractJobStoriesMutation,
		jobStoryForm,
		setJobStoryForm,
		jobStoryCategorySelectOptions,
		jobStoryPrioritySelectOptions,
		handleCreateJobStory,
		handleExtractJobStories,
		jobStoryExtractText,
		setJobStoryExtractText,
		jobStoryExtractCount,
		setJobStoryExtractCount,
		jobStoryExtractRunId,
		jobStoryExtractRunQuery,
		setEditingJobStory,
		jtbdVpOpsUrlTick,
		setJtbdVpOpsUrlTick,
		valuePropSearch,
		setValuePropSearch,
		debouncedValuePropSearch,
		filteredValuePropositions,
		valuePropositions,
		valuePropsQuery,
		handleCopyAllValueProps,
		handleExportValueProps,
		handleCopySingleValueProp,
		valuePropForm,
		setValuePropForm,
		valuePropInlineStatusOptions,
		handleCreateValueProp,
		createValuePropMutation,
		updateValuePropMutation,
		swotItems,
		swotQuery,
		handleCopyAllSwot,
		handleExportSwot,
		handleCopySingleSwot,
		generateSwotMutation,
		swotGenerateRunId,
		swotGenerateRunQuery,
		swotGenerateContext,
		setSwotGenerateContext,
		setEditingSwot,
		swotManualForm,
		setSwotManualForm,
		handleCreateSwot,
		createSwotMutation,
		competitors,
		filteredCompetitors,
		competitorsQuery,
		competitorSearch,
		setCompetitorSearch,
		debouncedCompetitorSearch,
		handleCopyAllCompetitors,
		handleExportCompetitors,
		handleCopySingleCompetitor,
		setEditingCompetitor,
		competitorForm,
		setCompetitorForm,
		competitorTypeSelectOptions,
		handleCreateCompetitor,
		createCompetitorMutation,
		setResearchUrlTick,
		researchSearch,
		setResearchSearch,
		debouncedResearchSearch,
		filteredResearches,
		researchesQuery,
		researchForm,
		setResearchForm,
		createResearchMutation,
		handleCreateResearch,
		handleExportResearches,
		canExportResearches,
		handleCopyAllResearches,
		contentQuery,
		contentItems,
		handleOpenContentManagerFromCabinet,
		researchTypes,
		runResearchAsyncMutation,
		researchRunTargetId,
		researchRunPollId,
		researchAiRunDetail,
		readOnlyMarketing,
		chatMessages,
		chatDraft,
		setChatDraft,
		sendChatMutation,
		sendToolAgentChatMutation,
		handleSendChatMessage,
		handleSendToolAgentMessage,
		clearChatSession,
		selfProfileQuery,
	} = ctx;

	return (
		<>
			{activeView === 'overview' && (
				<Suspense fallback={<LoadingGrid />}>
					<OverviewView
						selectedProjectId={selectedProjectId}
						selectedProject={selectedProject}
						dashboard={projectDashboardQuery.data}
						isLoading={projectDashboardQuery.isLoading}
						isError={projectDashboardQuery.isError}
						error={projectDashboardQuery.error}
						refetch={projectDashboardQuery.refetch}
						latestSwot={latestSwot}
						extractApiErrorMessage={extractApiErrorMessage}
						onNavigate={handleOverviewNavigate}
						allowMarketingWrite={allowMarketingWrite}
					/>
				</Suspense>
			)}
			{activeView === 'overview_dashboard' && (
				<div className="min-w-0 w-full max-w-full overflow-x-hidden">
					{!selectedProjectId || !selectedProject ? (
						<EmptyProjectState
							title={t('overview.emptyTitle')}
							description={t('overview.emptyDescription')}
						/>
					) : projectDashboardQuery.isLoading ? (
						<LoadingGrid />
					) : projectDashboardQuery.isError ? (
						<DesktopAppSurface variant="soft" className="overflow-hidden p-0">
							<DesktopAppErrorState
								message={extractApiErrorMessage(
									projectDashboardQuery.error,
									t('overview.loadErrorDefault')
								)}
								onAction={() => void projectDashboardQuery.refetch()}
							/>
						</DesktopAppSurface>
					) : projectDashboardQuery.data ? (
						<Suspense fallback={<LoadingGrid />}>
							<OverviewInteractiveDashboard
								projectId={selectedProjectId}
								dashboard={projectDashboardQuery.data}
								allowMarketingWrite={allowMarketingWrite}
								onNavigate={handleOverviewNavigate}
								onExitToOverviewCards={exitOverviewDashboardToCardGrid}
								extractApiErrorMessage={extractApiErrorMessage}
								onRefetchProjectDashboard={() =>
									void projectDashboardQuery.refetch()
								}
								isProjectDashboardFetching={
									projectDashboardQuery.isFetching ?? false
								}
							/>
						</Suspense>
					) : (
						<EmptyProjectState
							title={t('overview.noDataTitle')}
							description={t('overview.noDataDescription')}
						/>
					)}
				</div>
			)}
			{activeView === 'companies' && (
				<Suspense fallback={<LoadingGrid />}>
					<CompaniesSection
						companiesQuery={companiesQuery}
						companies={companies}
						filteredCompanies={filteredCompanies}
						selectedCompanyId={selectedCompanyId}
						setSelectedCompanyId={setSelectedCompanyId}
						selectedCompany={selectedCompany}
						companySearch={companySearch}
						setCompanySearch={setCompanySearch}
						debouncedCompanySearch={debouncedCompanySearch}
						editingCompany={editingCompany}
						setEditingCompany={setEditingCompany}
						creatingCompany={creatingCompany}
						setCreatingCompany={setCreatingCompany}
						companyForm={companyForm}
						setCompanyForm={setCompanyForm}
						companySizeSelectOptions={companySizeSelectOptions}
						createCompanyMutation={createCompanyMutation}
						updateCompanyMutation={updateCompanyMutation}
						handleCreateCompany={handleCreateCompany}
						friendsListQuery={friendsListQuery}
						getFriendDisplayNameFn={getFriendDisplayName}
						friendMetaForMemberUserId={friendMetaForMemberUserId}
						canManageSelectedCompany={canManageSelectedCompany}
						setActiveView={setActiveView}
						setDeleteModal={setDeleteModal}
					/>
				</Suspense>
			)}
			{activeView === 'projects' && (
				<Suspense fallback={<LoadingGrid />}>
					<ProjectsSection
						companies={companies}
						setActiveView={setActiveView}
						selectedCompanyId={selectedCompanyId}
						setSelectedCompanyId={setSelectedCompanyId}
						onUserChangeSelectedProjectId={requestSetSelectedProjectId}
						projectsPageCompanyOptions={projectsPageCompanyOptions}
						selectedCompany={selectedCompany}
						projectSearch={projectSearch}
						setProjectSearch={setProjectSearch}
						debouncedProjectSearch={debouncedProjectSearch}
						filteredProjects={filteredProjects}
						projects={projects}
						projectsQuery={projectsQuery}
						canManageSelectedCompany={canManageSelectedCompany}
						allowMarketingWrite={allowMarketingWrite}
						editingProject={editingProject}
						setEditingProject={setEditingProject}
						creatingProject={creatingProject}
						setCreatingProject={setCreatingProject}
						projectForm={projectForm}
						setProjectForm={setProjectForm}
						projectCategorySelectOptions={projectCategorySelectOptions}
						projectFormPriorityOptions={projectFormPriorityOptions}
						createProjectMutation={createProjectMutation}
						updateProjectMutation={updateProjectMutation}
						handleCreateProject={handleCreateProject}
						selectedProjectId={selectedProjectId}
						selectedProject={selectedProject}
						setDeleteModal={setDeleteModal}
					/>
				</Suspense>
			)}
			{activeView === 'team' && (
				<Suspense fallback={<LoadingGrid />}>
					<TeamSection
						selectedProjectId={selectedProjectId}
						selectedProject={selectedProject}
						projectMembersInfiniteQuery={projectMembersInfiniteQuery}
						projectMembersTotal={projectMembersTotal}
						isProjectLead={isProjectLead}
						sortedTeamMembers={sortedTeamMembers}
						user={user}
						teamAccessMemberId={teamAccessMemberId}
						setTeamAccessMemberId={setTeamAccessMemberId}
						teamAccessDraft={teamAccessDraft}
						setTeamAccessDraft={setTeamAccessDraft}
						teamAccessModuleSlugs={teamAccessModuleSlugs}
						friendMetaForMemberUserId={friendMetaForMemberUserId}
						labelForMemberUserId={labelForMemberUserId}
						removeProjectMemberMutation={removeProjectMemberMutation}
						updateMemberPermissionsMutation={updateMemberPermissionsMutation}
						addProjectMemberMutation={addProjectMemberMutation}
						transferProjectLeadMutation={transferProjectLeadMutation}
						friendsListQuery={friendsListQuery}
						friendsEligibleForTeam={friendsEligibleForTeam}
						teamInviteUserId={teamInviteUserId}
						setTeamInviteUserId={setTeamInviteUserId}
						teamInviteRole={teamInviteRole}
						setTeamInviteRole={setTeamInviteRole}
						projectTeamRoleInviteOptions={projectTeamRoleInviteOptions}
						transferLeadToUserId={transferLeadToUserId}
						setTransferLeadToUserId={setTransferLeadToUserId}
						transferLeadSelectOptions={transferLeadSelectOptions}
						setTeamRemoveConfirm={setTeamRemoveConfirm}
						setTeamTransferConfirm={setTeamTransferConfirm}
					/>
				</Suspense>
			)}
			{activeView === 'jtbd' && (
				<Suspense fallback={<LoadingGrid />}>
					<JtbdSection
						selectedProjectId={selectedProjectId}
						selectedCompanyId={selectedCompanyId}
						jobStorySearch={jobStorySearch}
						setJobStorySearch={setJobStorySearch}
						debouncedJobStorySearch={debouncedJobStorySearch}
						allJobStories={allJobStories}
						filteredJobStories={filteredJobStories}
						jobStoriesQuery={jobStoriesQuery}
						selectedJobStoryIds={selectedJobStoryIds}
						setSelectedJobStoryIds={setSelectedJobStoryIds}
						allowMarketingWrite={allowMarketingWrite}
						handleCopyAllJobs={handleCopyAllJobs}
						handleExportJobs={handleExportJobs}
						handleCopySingleJob={handleCopySingleJob}
						setJtbdContextMenu={setJtbdContextMenu}
						createJobStoryMutation={createJobStoryMutation}
						extractJobStoriesMutation={extractJobStoriesMutation}
						jobStoryForm={jobStoryForm}
						setJobStoryForm={setJobStoryForm}
						jobStoryCategorySelectOptions={jobStoryCategorySelectOptions}
						jobStoryPrioritySelectOptions={jobStoryPrioritySelectOptions}
						handleCreateJobStory={handleCreateJobStory}
						handleExtractJobStories={handleExtractJobStories}
						jobStoryExtractText={jobStoryExtractText}
						setJobStoryExtractText={setJobStoryExtractText}
						jobStoryExtractCount={jobStoryExtractCount}
						setJobStoryExtractCount={setJobStoryExtractCount}
						jobStoryExtractRunId={jobStoryExtractRunId}
						jobStoryExtractRunQuery={jobStoryExtractRunQuery}
						setEditingJobStory={setEditingJobStory}
						setDeleteModal={setDeleteModal}
						jtbdOpsUrlEpoch={jtbdVpOpsUrlTick}
						onJtbdOpsUrlChange={() => setJtbdVpOpsUrlTick((n) => n + 1)}
					/>
				</Suspense>
			)}
			{activeView === 'value' && (
				<Suspense fallback={<LoadingGrid />}>
					<ValuePropsSection
						selectedProjectId={selectedProjectId}
						selectedCompanyId={selectedCompanyId}
						valuePropSearch={valuePropSearch}
						setValuePropSearch={setValuePropSearch}
						debouncedValuePropSearch={debouncedValuePropSearch}
						filteredValuePropositions={filteredValuePropositions}
						valuePropositions={valuePropositions}
						valuePropsQuery={valuePropsQuery}
						allowMarketingWrite={allowMarketingWrite}
						handleCopyAllValueProps={handleCopyAllValueProps}
						handleExportValueProps={handleExportValueProps}
						handleCopySingleValueProp={handleCopySingleValueProp}
						setDeleteModal={setDeleteModal}
						valuePropForm={valuePropForm}
						setValuePropForm={setValuePropForm}
						valuePropInlineStatusOptions={valuePropInlineStatusOptions}
						handleCreateValueProp={handleCreateValueProp}
						createValuePropMutation={createValuePropMutation}
						updateValuePropMutation={updateValuePropMutation}
						allJobStories={allJobStories}
						selectedJobStoryIds={selectedJobStoryIds}
						setSelectedJobStoryIds={setSelectedJobStoryIds}
						valuePropOpsUrlEpoch={jtbdVpOpsUrlTick}
						onValuePropOpsUrlChange={() => setJtbdVpOpsUrlTick((n) => n + 1)}
					/>
				</Suspense>
			)}
			{activeView === 'analysis' && (
				<Suspense fallback={<LoadingGrid />}>
					<AnalysisSection
						selectedProjectId={selectedProjectId}
						selectedCompanyId={selectedCompanyId}
						selectedCompany={selectedCompany}
						focusedEntityId={focusedEntityId}
						allowMarketingWrite={allowMarketingWrite}
						swotItems={swotItems}
						swotQuery={swotQuery}
						handleCopyAllSwot={handleCopyAllSwot}
						handleExportSwot={handleExportSwot}
						handleCopySingleSwot={handleCopySingleSwot}
						generateSwotMutation={generateSwotMutation}
						swotGenerateRunId={swotGenerateRunId}
						swotGenerateRunQuery={swotGenerateRunQuery}
						swotGenerateContext={swotGenerateContext}
						setSwotGenerateContext={setSwotGenerateContext}
						setEditingSwot={setEditingSwot}
						setDeleteModal={setDeleteModal}
						swotManualForm={swotManualForm}
						setSwotManualForm={setSwotManualForm}
						handleCreateSwot={handleCreateSwot}
						createSwotMutation={createSwotMutation}
						competitors={competitors}
						filteredCompetitors={filteredCompetitors}
						competitorsQuery={competitorsQuery}
						competitorSearch={competitorSearch}
						setCompetitorSearch={setCompetitorSearch}
						debouncedCompetitorSearch={debouncedCompetitorSearch}
						handleCopyAllCompetitors={handleCopyAllCompetitors}
						handleExportCompetitors={handleExportCompetitors}
						handleCopySingleCompetitor={handleCopySingleCompetitor}
						setEditingCompetitor={setEditingCompetitor}
						competitorForm={competitorForm}
						setCompetitorForm={setCompetitorForm}
						competitorTypeSelectOptions={competitorTypeSelectOptions}
						handleCreateCompetitor={handleCreateCompetitor}
						createCompetitorMutation={createCompetitorMutation}
						competitorOpsUrlEpoch={jtbdVpOpsUrlTick}
						onCompetitorOpsUrlChange={() => setJtbdVpOpsUrlTick((n) => n + 1)}
					/>
				</Suspense>
			)}
			{activeView === 'evidence' && (
				<Suspense fallback={<LoadingGrid />}>
					<EvidenceView
						selectedProjectId={selectedProjectId}
						selectedCompanyId={selectedCompanyId}
						allowMarketingWrite={allowMarketingWrite}
						onResearchListFiltersUrlChange={() =>
							setResearchUrlTick((n) => n + 1)
						}
						researchSearch={researchSearch}
						setResearchSearch={setResearchSearch}
						debouncedResearchSearch={debouncedResearchSearch}
						filteredResearches={filteredResearches}
						researches={researchesQuery.data?.items ?? []}
						researchesQuery={researchesQuery}
						researchForm={researchForm}
						setResearchForm={setResearchForm}
						createResearchMutation={createResearchMutation}
						onCreateResearch={handleCreateResearch}
						onExportResearches={handleExportResearches}
						canExportResearches={canExportResearches}
						onCopyResearches={handleCopyAllResearches}
						setDeleteModal={setDeleteModal}
						contentQuery={contentQuery}
						contentItems={contentItems}
						onOpenContentManager={handleOpenContentManagerFromCabinet}
						researchTypes={researchTypes}
						extractApiErrorMessage={extractApiErrorMessage}
						onStartResearchAiSynthesis={(researchId) =>
							runResearchAsyncMutation.mutate({ researchId })
						}
						researchAiRunTargetId={researchRunTargetId}
						researchAiRunPollId={researchRunPollId}
						researchAiRunStarting={runResearchAsyncMutation.isPending}
						researchAiRunDetail={researchAiRunDetail}
						focusedEntityId={focusedEntityId}
						onCopyResearchCard={(research) => {
							void (async () => {
								const text = `${research.title}\n${research.research_query || ''}\n${localizeResearchTypeSafe(research.research_type)} · ${localizePriority(research.priority)} · ${localizeStatus(research.status)}\n${research.result_summary || ''}`;
								const ok = await copyToClipboard(text);
								if (ok)
									cabinetNotify.success(t('evidenceView.researchCardCopied'));
								else cabinetNotify.error(t('toolbar.idCopyFailed'));
							})();
						}}
						onOpenImcResearch={
							projectHasImcCabinetSlug(
								selectedProject?.cabinet_modules ??
									selectedProject?.enabled_modules
							)
								? () => handleOverviewNavigate('imc', null)
								: undefined
						}
					/>
				</Suspense>
			)}
			{activeView === 'segments' && (
				<Suspense fallback={<LoadingGrid />}>
					<SegmentsView
						selectedProjectId={selectedProjectId}
						focusedEntityId={focusedEntityId}
						allowMarketingWrite={allowMarketingWrite}
					/>
				</Suspense>
			)}
			{activeView === 'campaigns' && (
				<Suspense fallback={<LoadingGrid />}>
					<CampaignsView
						selectedProjectId={selectedProjectId}
						focusedEntityId={focusedEntityId}
						allowMarketingWrite={allowMarketingWrite}
					/>
				</Suspense>
			)}
			{activeView === 'funnel' && (
				<Suspense fallback={<LoadingGrid />}>
					<FunnelView
						selectedProjectId={selectedProjectId}
						focusedEntityId={focusedEntityId}
						allowMarketingWrite={allowMarketingWrite}
					/>
				</Suspense>
			)}
			{activeView === 'tasks' && (
				<Suspense fallback={<LoadingGrid />}>
					<OperationsView
						selectedProjectId={selectedProjectId}
						section="tasks"
						focusedEntityId={focusedEntityId}
						allowMarketingWrite={allowMarketingWrite}
					/>
				</Suspense>
			)}
			{activeView === 'alerts' && (
				<Suspense fallback={<LoadingGrid />}>
					<OperationsView
						selectedProjectId={selectedProjectId}
						section="alerts"
						focusedEntityId={focusedEntityId}
						allowMarketingWrite={allowMarketingWrite}
					/>
				</Suspense>
			)}
			{activeView === 'ai_studio' && (
				<Suspense fallback={<LoadingGrid />}>
					<AIStudioView
						selectedProjectId={selectedProjectId}
						selectedCompanyId={selectedCompanyId}
						projectsForCompany={projects}
						focusedEntityId={focusedEntityId}
					/>
				</Suspense>
			)}
			{activeView === 'amka' && (
				<Suspense fallback={<LoadingGrid />}>
					<AmkaView
						selectedProjectId={selectedProjectId}
						selectedCompanyId={selectedCompanyId}
						canEditAmkaOperatorConfig={Boolean(
							selfProfileQuery.data?.is_trusted
						)}
						onOpenAiStudio={() => setActiveView('ai_studio')}
					/>
				</Suspense>
			)}
			{activeView === 'imc' && (
				<Suspense fallback={<LoadingGrid />}>
					<ImcResearchView
						selectedProjectId={selectedProjectId}
						selectedCompanyId={selectedCompanyId}
						focusedEntityId={focusedEntityId}
						isProjectLead={isProjectLead}
						onSelectResearch={setFocusedEntityId}
						onClearResearchSelection={() => setFocusedEntityId(null)}
					/>
				</Suspense>
			)}
			{activeView === 'project_rag' && (
				<Suspense fallback={<LoadingGrid />}>
					<ProjectRagSourcesView selectedProjectId={selectedProjectId} />
				</Suspense>
			)}
			{activeView === 'chat' && (
				<Suspense fallback={<LoadingGrid />}>
					<ChatView
						selectedCompanyId={selectedCompanyId}
						selectedProjectId={selectedProjectId}
						selectedCompany={selectedCompany ?? null}
						selectedProject={selectedProject ?? null}
						readOnlyMarketing={readOnlyMarketing}
						chatMessages={chatMessages}
						chatDraft={chatDraft}
						setChatDraft={setChatDraft}
						sendChatMutation={sendChatMutation}
						sendToolAgentMutation={sendToolAgentChatMutation}
						onSendMessage={handleSendChatMessage}
						onSendToolAgentMessage={handleSendToolAgentMessage}
						toolAgentAvailable={Boolean(
							selectedProjectId && !readOnlyMarketing
						)}
						onClearChat={clearChatSession}
					/>
				</Suspense>
			)}
			{activeView === 'client_interaction' && (
				<Suspense fallback={<LoadingGrid />}>
					<ClientInteractionView
						selectedProjectId={selectedProjectId}
						readOnlyMarketing={readOnlyMarketing}
					/>
				</Suspense>
			)}
		</>
	);
}
