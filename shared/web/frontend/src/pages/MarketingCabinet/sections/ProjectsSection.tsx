import {
	ArrowPathIcon,
	PaintBrushIcon,
	PencilSquareIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
	DesktopAppListRow,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { FieldLabel } from '../components/FieldLabel';
import { LoadingGrid } from '../components/LoadingGrid';
import { MarketingCabinetSelect } from '../components/MarketingCabinetSelect';
import { MarketingCabinetVirtualNavList } from '../components/MarketingCabinetVirtualNavList';
import { SectionPanel } from '../components/SectionPanel';
import { TokenList } from '../components/TokenList';
import {
	INPUT_STACK_CLASS,
	MARKETING_FOUNDATION_LIST_FETCH_LIMIT,
	PROJECT_ENABLED_MODULES,
	TEXTAREA_CLASS,
	type MarketingView,
} from '../constants';
import {
	localizePriority,
	localizeProjectCategory,
	localizeStatus,
} from '../locales';
import type { ProjectFormState } from '../marketingCabinetPageTypes';
import type {
	MarketingCompany,
	MarketingProject,
	UpdateProjectPayload,
} from '../marketingCabinetApi';

export type MarketingCabinetUpdateProjectVariables = {
	projectId: string;
	payload: UpdateProjectPayload;
};
import { extractApiErrorMessage } from '../utils';
import type {
	MutationLike,
	QueryLike,
} from '../marketingCabinetPage/marketingCabinetComposeHosts';
import type { MarketingDeleteModalSetter } from './CompaniesSection';

export interface ProjectsSectionProps {
	companies: MarketingCompany[];
	setActiveView: (view: MarketingView) => void;
	selectedCompanyId: string | null;
	setSelectedCompanyId: React.Dispatch<React.SetStateAction<string | null>>;
	/** Смена проекта с guard A.11 (canvas draft); не использовать для автосинхронизации списка. */
	onUserChangeSelectedProjectId: (projectId: string | null) => void;
	projectsPageCompanyOptions: Array<{ value: string; label: string }>;
	selectedCompany: MarketingCompany | null;
	projectSearch: string;
	setProjectSearch: React.Dispatch<React.SetStateAction<string>>;
	debouncedProjectSearch: string;
	filteredProjects: MarketingProject[];
	projects: MarketingProject[];
	projectsQuery: QueryLike<MarketingProject[]>;
	canManageSelectedCompany: boolean;
	allowMarketingWrite: boolean;
	editingProject: MarketingProject | null;
	setEditingProject: React.Dispatch<
		React.SetStateAction<MarketingProject | null>
	>;
	creatingProject: boolean;
	setCreatingProject: React.Dispatch<React.SetStateAction<boolean>>;
	projectForm: ProjectFormState;
	setProjectForm: React.Dispatch<React.SetStateAction<ProjectFormState>>;
	projectCategorySelectOptions: Array<{ value: string; label: string }>;
	projectFormPriorityOptions: Array<{ value: string; label: string }>;
	createProjectMutation: MutationLike;
	updateProjectMutation: MutationLike;
	handleCreateProject: (event: React.FormEvent) => void;
	selectedProjectId: string | null;
	selectedProject: MarketingProject | null;
	setDeleteModal: MarketingDeleteModalSetter;
}

export function ProjectsSection(props: ProjectsSectionProps) {
	const { t } = useTranslation('marketing');
	const {
		companies,
		setActiveView,
		selectedCompanyId,
		setSelectedCompanyId,
		onUserChangeSelectedProjectId,
		projectsPageCompanyOptions,
		selectedCompany,
		projectSearch,
		setProjectSearch,
		debouncedProjectSearch,
		filteredProjects,
		projects,
		projectsQuery,
		canManageSelectedCompany,
		allowMarketingWrite,
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
		selectedProjectId,
		selectedProject,
		setDeleteModal,
	} = props;
	const projectsAtFetchCap =
		projects.length >= MARKETING_FOUNDATION_LIST_FETCH_LIMIT;
	if (companies.length === 0) {
		return (
			<div className="mc-section-root mx-auto space-y-6">
				<DesktopAppEmptyState
					title={t('cabinetPage.projectsPage.noCompaniesTitle')}
					description={t('cabinetPage.projectsPage.noCompaniesDescription')}
				>
					<DesktopAppButton
						type="button"
						variant="accent"
						size="sm"
						onClick={() => setActiveView('companies')}
					>
						{t('cabinetPage.projectsPage.goCreateCompany')}
					</DesktopAppButton>
				</DesktopAppEmptyState>
			</div>
		);
	}

	const showProjectForm = Boolean(editingProject || creatingProject);

	return (
		<div className="mc-section-root mx-auto space-y-6">
			<DesktopAppSurface variant="soft" className="space-y-3 p-4">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="min-w-0 flex-1">
						<FieldLabel
							label={t('cabinetPage.projectsPage.companyContextLabel')}
						>
							<MarketingCabinetSelect
								value={selectedCompanyId ?? ''}
								onChange={(v) => {
									setSelectedCompanyId(v || null);
									onUserChangeSelectedProjectId(null);
									setCreatingProject(false);
									setEditingProject(null);
								}}
								options={projectsPageCompanyOptions}
								aria-label={t('cabinetPage.projectsPage.companySelectAria')}
							/>
						</FieldLabel>
					</div>
					<div className="flex flex-wrap items-center gap-2 lg:justify-end">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setActiveView('companies')}
						>
							{t('cabinetPage.projectsPage.manageCompanies')}
						</DesktopAppButton>
						{selectedCompanyId ? (
							<span
								className={cn(
									'rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 px-3 py-1 font-medium',
									DESKTOP_TYPOGRAPHY.caption
								)}
							>
								{t('cabinetPage.projectsPage.projectCountBadge', {
									count: projects.length,
								})}
							</span>
						) : null}
					</div>
				</div>
				<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
					{t('cabinetPage.projectsPage.introHint')}
				</p>
			</DesktopAppSurface>
			<div className="grid gap-6 xl:grid-cols-[1.15fr_1fr] xl:gap-6">
				<SectionPanel
					title={t('cabinetPage.setup.projectsTitle')}
					description={t('cabinetPage.setup.projectsDescription')}
					helpBlockId="projects.list"
					actions={
						selectedCompany ? (
							<div className="flex flex-wrap items-center gap-2">
								<DesktopAppInput
									placeholder={t('cabinetPage.setup.projectSearchPlaceholder')}
									value={projectSearch}
									onChange={(e) => setProjectSearch(e.target.value)}
									aria-label={t('cabinetPage.setup.projectSearchAria')}
									className="w-48 min-w-0"
								/>
								{projectSearch.trim() ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setProjectSearch('')}
										aria-label={t('evidenceView.clearSearchAria')}
									>
										<PaintBrushIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									</DesktopAppButton>
								) : null}
								{canManageSelectedCompany ? (
									<DesktopAppButton
										type="button"
										variant="accent"
										size="sm"
										onClick={() => {
											setCreatingProject(true);
											setEditingProject(null);
											setProjectForm({
												name: '',
												description: '',
												goals: '',
												key_tasks: '',
												category: 'marketing_campaign',
												priority: 'medium',
											});
										}}
										aria-label={t('cabinetPage.projectsPage.createProjectAria')}
									>
										<PlusIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('cabinetPage.projectsPage.createProjectButton')}
									</DesktopAppButton>
								) : null}
							</div>
						) : null
					}
				>
					{selectedCompany ? (
						projectsQuery.isLoading ? (
							<LoadingGrid />
						) : projectsQuery.isError ? (
							<DesktopAppErrorState
								message={extractApiErrorMessage(
									projectsQuery.error,
									t('cabinetPage.setup.loadProjectsError')
								)}
								onAction={() => void projectsQuery.refetch()}
							/>
						) : filteredProjects.length > 0 ? (
							<>
								{projectsAtFetchCap ? (
									<p
										className={cn(
											'mc-meta-caption mb-2',
											DESKTOP_TYPOGRAPHY.meta
										)}
									>
										{t('cabinetPage.listFetchSummaryTruncated', {
											shown: projects.length,
											total: projects.length,
										})}
									</p>
								) : null}
								<MarketingCabinetVirtualNavList
									items={filteredProjects}
									estimateSize={() => 68}
									getItemKey={(index) =>
										filteredProjects[index]?.id ?? `project-${index}`
									}
									renderItem={(project) => (
										<DesktopAppListRow
											active={project.id === selectedProjectId}
											onClick={() => {
												onUserChangeSelectedProjectId(project.id);
												setCreatingProject(false);
												setEditingProject(null);
											}}
											className="rounded-(--desktop-radius) border border-transparent px-3 py-2.5"
										>
											<div className="flex min-w-0 flex-1 items-center justify-between gap-3">
												<div className="min-w-0">
													<div
														className="truncate text-sm font-medium text-(--desktop-text-primary)"
														title={project.name}
													>
														{project.name}
													</div>
													<div
														className={cn(DESKTOP_TYPOGRAPHY.meta, 'truncate')}
													>
														{t('cabinetPage.setup.projectMetaLine', {
															category: localizeProjectCategory(
																project.category
															),
															status: localizeStatus(project.status),
															priority: localizePriority(project.priority),
														})}
													</div>
												</div>
												<div className="flex items-center gap-1">
													{!project.read_only_marketing ? (
														<>
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="icon"
																onClick={(event) => {
																	event.stopPropagation();
																	setCreatingProject(false);
																	setEditingProject(project);
																}}
																aria-label={t(
																	'cabinetPage.setup.editProjectAria',
																	{
																		name: project.name,
																	}
																)}
															>
																<PencilSquareIcon
																	className="h-4 w-4"
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																/>
															</DesktopAppButton>
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="sm"
																onClick={(event) => {
																	event.stopPropagation();
																	updateProjectMutation.mutate({
																		projectId: project.id,
																		payload: {
																			status:
																				project.status === 'archived'
																					? 'active'
																					: 'archived',
																		},
																	});
																}}
															>
																{project.status === 'archived'
																	? t('cabinetPage.setup.activateProject')
																	: t('cabinetPage.setup.archiveProject')}
															</DesktopAppButton>
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="icon"
																onClick={(event) => {
																	event.stopPropagation();
																	setDeleteModal({
																		type: 'project',
																		id: project.id,
																		name: project.name,
																	});
																}}
																aria-label={t(
																	'cabinetPage.setup.deleteProjectAria',
																	{
																		name: project.name,
																	}
																)}
															>
																<TrashIcon
																	className="h-4 w-4"
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																/>
															</DesktopAppButton>
														</>
													) : null}
												</div>
											</div>
										</DesktopAppListRow>
									)}
								/>
							</>
						) : projects.length > 0 ? (
							<DesktopAppEmptyState
								title={t('cabinetPage.setup.projectsSearchEmptyTitle')}
								description={t(
									'cabinetPage.setup.projectsSearchEmptyDescription',
									{ query: debouncedProjectSearch }
								)}
							/>
						) : (
							<DesktopAppEmptyState
								title={t('cabinetPage.setup.projectsEmptyTitle')}
								description={t('cabinetPage.setup.projectsEmptyDescription')}
							/>
						)
					) : (
						<DesktopAppEmptyState
							title={t('cabinetPage.setup.pickCompanyForProjectsTitle')}
							description={t(
								'cabinetPage.setup.pickCompanyForProjectsDescription'
							)}
						/>
					)}
				</SectionPanel>

				{showProjectForm ? (
					<SectionPanel
						title={
							editingProject
								? t('cabinetPage.setup.projectFormEditTitle')
								: t('cabinetPage.setup.projectFormCreateTitle')
						}
						description={
							editingProject
								? t('cabinetPage.setup.projectFormEditDescription')
								: t('cabinetPage.setup.projectFormCreateDescription')
						}
						helpBlockId="projects.form"
					>
						<form className="space-y-3" onSubmit={handleCreateProject}>
							<FieldLabel
								label={t('cabinetPage.setup.fieldProjectName')}
								required
							>
								<DesktopAppInput
									value={projectForm.name}
									onChange={(event) =>
										setProjectForm((prev) => ({
											...prev,
											name: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.setup.phProjectName')}
								/>
							</FieldLabel>
							<div className={INPUT_STACK_CLASS}>
								<FieldLabel label={t('cabinetPage.setup.fieldCategory')}>
									<MarketingCabinetSelect
										value={projectForm.category}
										onChange={(v) =>
											setProjectForm((prev) => ({ ...prev, category: v }))
										}
										options={projectCategorySelectOptions}
									/>
								</FieldLabel>
								<FieldLabel label={t('cabinetPage.setup.fieldPriority')}>
									<MarketingCabinetSelect
										value={projectForm.priority}
										onChange={(v) =>
											setProjectForm((prev) => ({ ...prev, priority: v }))
										}
										options={projectFormPriorityOptions}
									/>
								</FieldLabel>
							</div>
							<FieldLabel
								label={t('cabinetPage.setup.fieldProjectDescription')}
								hint={t('cabinetPage.setup.hintProjectDescription')}
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={projectForm.description}
									onChange={(event) =>
										setProjectForm((prev) => ({
											...prev,
											description: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.setup.phProjectDescription')}
								/>
							</FieldLabel>
							<FieldLabel
								label={t('cabinetPage.setup.fieldProjectGoals')}
								hint={t('cabinetPage.setup.hintProjectGoals')}
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={projectForm.goals}
									onChange={(event) =>
										setProjectForm((prev) => ({
											...prev,
											goals: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.setup.phProjectGoals')}
								/>
							</FieldLabel>
							<FieldLabel
								label={t('cabinetPage.setup.fieldKeyTasks')}
								hint={t('cabinetPage.setup.hintKeyTasks')}
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={projectForm.key_tasks}
									onChange={(event) =>
										setProjectForm((prev) => ({
											...prev,
											key_tasks: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.setup.phKeyTasks')}
								/>
							</FieldLabel>
							<DesktopAppSurface variant="soft" className="space-y-2 p-3">
								<DesktopAppSectionLabel>
									{t('cabinetPage.setup.enabledModulesLabel')}
								</DesktopAppSectionLabel>
								<TokenList
									items={
										editingProject?.enabled_modules ?? PROJECT_ENABLED_MODULES
									}
									emptyText={t('cabinetPage.setup.modulesEmpty')}
								/>
							</DesktopAppSurface>
							<div className="flex flex-wrap gap-2">
								{editingProject || creatingProject ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										onClick={() => {
											setEditingProject(null);
											setCreatingProject(false);
										}}
									>
										{t('common.cancel')}
									</DesktopAppButton>
								) : null}
								<DesktopAppButton
									type="submit"
									variant="accent"
									disabled={
										createProjectMutation.isPending ||
										updateProjectMutation.isPending ||
										!selectedCompanyId ||
										!projectForm.name.trim()
									}
								>
									{createProjectMutation.isPending ||
									updateProjectMutation.isPending ? (
										<ArrowPathIcon
											className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									) : editingProject ? null : (
										<PlusIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									)}
									{editingProject
										? t('cabinetPage.setup.saveProject')
										: t('cabinetPage.setup.createProject')}
								</DesktopAppButton>
							</div>
						</form>
					</SectionPanel>
				) : selectedCompany && selectedProject ? (
					<SectionPanel
						title={selectedProject.name}
						description={t('cabinetPage.projectsPage.projectCardDescription')}
						helpBlockId="projects.detail"
						actions={
							<div className="flex flex-wrap items-center gap-2">
								<DesktopAppButton
									type="button"
									variant="accent"
									size="sm"
									onClick={() => setActiveView('overview')}
								>
									{t('cabinetPage.projectsPage.goToOverview')}
								</DesktopAppButton>
							</div>
						}
					>
						<div className="space-y-4">
							<div className="grid gap-3 sm:grid-cols-2">
								<div>
									<DesktopAppSectionLabel>
										{t('cabinetPage.setup.fieldCategory')}
									</DesktopAppSectionLabel>
									<p className="text-sm text-(--desktop-text-primary)">
										{localizeProjectCategory(selectedProject.category)}
									</p>
								</div>
								<div>
									<DesktopAppSectionLabel>
										{t('cabinetPage.setup.fieldPriority')}
									</DesktopAppSectionLabel>
									<p className="text-sm text-(--desktop-text-primary)">
										{localizePriority(selectedProject.priority)}
									</p>
								</div>
							</div>
							<div>
								<DesktopAppSectionLabel>
									{t('cabinetPage.projectsPage.projectDetailStatus')}
								</DesktopAppSectionLabel>
								<p className="text-sm text-(--desktop-text-primary)">
									{localizeStatus(selectedProject.status)}
								</p>
							</div>
							<div>
								<DesktopAppSectionLabel>
									{t('cabinetPage.setup.fieldProjectDescription')}
								</DesktopAppSectionLabel>
								<p className="whitespace-pre-wrap text-sm leading-relaxed text-(--desktop-text-secondary)">
									{selectedProject.description?.trim() ||
										t('cabinetPage.projectsPage.noDescription')}
								</p>
							</div>
							<div>
								<DesktopAppSectionLabel>
									{t('cabinetPage.setup.fieldProjectGoals')}
								</DesktopAppSectionLabel>
								<p className="whitespace-pre-wrap text-sm leading-relaxed text-(--desktop-text-secondary)">
									{selectedProject.goals?.trim() ||
										t('cabinetPage.projectsPage.noGoals')}
								</p>
							</div>
							<div>
								<DesktopAppSectionLabel>
									{t('cabinetPage.setup.fieldKeyTasks')}
								</DesktopAppSectionLabel>
								<p className="whitespace-pre-wrap text-sm leading-relaxed text-(--desktop-text-secondary)">
									{selectedProject.key_tasks?.trim() ||
										t('cabinetPage.projectsPage.noKeyTasks')}
								</p>
							</div>
							<DesktopAppSurface variant="soft" className="space-y-2 p-3">
								<DesktopAppSectionLabel>
									{t('cabinetPage.setup.enabledModulesLabel')}
								</DesktopAppSectionLabel>
								<TokenList
									items={
										selectedProject.enabled_modules?.length
											? selectedProject.enabled_modules
											: PROJECT_ENABLED_MODULES
									}
									emptyText={t('cabinetPage.setup.modulesEmpty')}
								/>
							</DesktopAppSurface>
							{allowMarketingWrite ? (
								<div className="flex flex-wrap gap-2 border-t border-(--desktop-border-subtle)/40 pt-4">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => {
											setCreatingProject(false);
											setEditingProject(selectedProject);
										}}
									>
										<PencilSquareIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('common.edit')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => {
											updateProjectMutation.mutate({
												projectId: selectedProject.id,
												payload: {
													status:
														selectedProject.status === 'archived'
															? 'active'
															: 'archived',
												},
											});
										}}
									>
										{selectedProject.status === 'archived'
											? t('cabinetPage.setup.activateProject')
											: t('cabinetPage.setup.archiveProject')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => {
											setDeleteModal({
												type: 'project',
												id: selectedProject.id,
												name: selectedProject.name,
											});
										}}
									>
										<TrashIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('cabinetPage.projectsPage.deleteProject')}
									</DesktopAppButton>
								</div>
							) : null}
						</div>
					</SectionPanel>
				) : (
					<SectionPanel
						title={t('cabinetPage.projectsPage.detailEmptyTitle')}
						description={
							!selectedCompany
								? t('cabinetPage.setup.pickCompanyForProjectsDescription')
								: t('cabinetPage.projectsPage.pickProjectHint')
						}
						helpBlockId="projects.detail"
					>
						<DesktopAppEmptyState
							title={
								!selectedCompany
									? t('cabinetPage.setup.pickCompanyForProjectsTitle')
									: t('cabinetPage.projectsPage.detailEmptyTitle')
							}
							description={
								!selectedCompany
									? t('cabinetPage.setup.pickCompanyForProjectsDescription')
									: t('cabinetPage.projectsPage.pickProjectHint')
							}
						/>
					</SectionPanel>
				)}
			</div>
		</div>
	);
}
