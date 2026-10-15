import type { TFunction } from 'i18next';
import type * as React from 'react';
import { cabinetNotify } from './cabinetNotify';
import { PROJECT_ENABLED_MODULES } from './constants';
import { buildSwotFactors } from './marketingCabinetPageHelpers';
import type {
	MarketingCompany,
	MarketingCompetitor,
	MarketingJobStory,
	MarketingProject,
	MarketingSwot,
	MarketingValueProposition,
} from './marketingCabinetApi';
import type {
	CompetitorFormState,
	CompanyFormState,
	JobStoryFormState,
	ProjectFormState,
	ResearchFormState,
	SwotManualFormState,
	ValuePropFormState,
} from './marketingCabinetPageTypes';
import {
	copyToClipboard,
	downloadCsv,
	isValidUrl,
	parseMultilineList,
	parseOptionalNumber,
} from './utils';
import {
	localizeCompetitorType,
	localizeJobCategory,
	localizePriority,
	localizeResearchTypeSafe,
	localizeSource,
	localizeStatus,
} from './locales';
import {
	slugifyCompanySlug,
	slugifyProjectSlug,
	type MarketingResearch,
} from './marketingCabinetApi';

type DeleteModalState = {
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
} | null;

type MutateHost = {
	/** react-query mutate — composition accepts any concrete UseMutationResult */
	// biome-ignore lint/suspicious/noExplicitAny: section-handler seam — RQ mutate host
	mutate: (...args: any[]) => unknown;
};

export type MarketingCabinetSectionHandlersContext = {
	t: TFunction<'marketing'>;
	companyForm: CompanyFormState;
	editingCompany: MarketingCompany | null;
	projectForm: ProjectFormState;
	editingProject: MarketingProject | null;
	selectedCompanyId: string | null;
	selectedProjectId: string | null;
	selectedProject: MarketingProject | null;
	selectedCompany: MarketingCompany | null;
	jobStoryForm: JobStoryFormState;
	jobStoryExtractText: string;
	valuePropForm: ValuePropFormState;
	selectedJobStoryIds: string[];
	swotManualForm: SwotManualFormState;
	competitorForm: CompetitorFormState;
	researchForm: ResearchFormState;
	allJobStories: MarketingJobStory[];
	filteredValuePropositions: MarketingValueProposition[];
	swotItems: MarketingSwot[];
	filteredResearches: MarketingResearch[];
	filteredCompetitors: MarketingCompetitor[];
	csvJtbdHeaderRow: string[];
	csvSwotHeaderRow: string[];
	csvResearchHeaderRow: string[];
	csvValuePropHeaderRow: string[];
	csvCompetitorHeaderRow: string[];
	canExportResearches: boolean;
	deleteModal: DeleteModalState;
	setDeleteModal: React.Dispatch<React.SetStateAction<DeleteModalState>>;
	updateCompanyMutation: MutateHost;
	createCompanyMutation: MutateHost;
	createProjectMutation: MutateHost;
	updateProjectMutation: MutateHost;
	deleteCompanyMutation: MutateHost;
	deleteProjectMutation: MutateHost;
	createJobStoryMutation: MutateHost;
	extractJobStoriesMutation: MutateHost;
	createValuePropMutation: MutateHost;
	createSwotMutation: MutateHost;
	createCompetitorMutation: MutateHost;
	createResearchMutation: MutateHost;
	deleteJobStoryMutation: MutateHost;
	deleteValuePropMutation: MutateHost;
	deleteCompetitorMutation: MutateHost;
	deleteResearchMutation: MutateHost;
	deleteSwotMutation: MutateHost;
};

function valuePropToClipboardText(
	t: TFunction<'marketing'>,
	vp: MarketingValueProposition
) {
	return `${vp.headline || t('documentAutofill.untitledDocument')}\n${vp.value_statement || ''}\n${localizeStatus(vp.status)}${(vp.proof_points ?? []).length ? `\n${t('cabinetPage.copy.proofPointsPrefix')} ${(vp.proof_points ?? []).map(String).join(', ')}` : ''}`;
}

function swotToClipboardText(t: TFunction<'marketing'>, s: MarketingSwot) {
	const parts = [`${s.title ?? ''}\n${s.executive_summary || ''}`];
	for (const [label, items] of [
		[t('cabinetPage.swotFactor.strength'), s.factors?.strength ?? []],
		[t('cabinetPage.swotFactor.weakness'), s.factors?.weakness ?? []],
		[t('cabinetPage.swotFactor.opportunity'), s.factors?.opportunity ?? []],
		[t('cabinetPage.swotFactor.threat'), s.factors?.threat ?? []],
	] as const) {
		if (items?.length)
			parts.push(`${label}: ${items.map((f) => f.factor_text).join('; ')}`);
	}
	return parts.join('\n');
}

export function createMarketingCabinetSectionHandlers(
	ctx: MarketingCabinetSectionHandlersContext
) {
	const {
		t,
		companyForm,
		editingCompany,
		projectForm,
		editingProject,
		selectedCompanyId,
		selectedProjectId,
		selectedProject,
		selectedCompany,
		jobStoryForm,
		jobStoryExtractText,
		valuePropForm,
		selectedJobStoryIds,
		swotManualForm,
		competitorForm,
		researchForm,
		allJobStories,
		filteredValuePropositions,
		swotItems,
		filteredResearches,
		filteredCompetitors,
		csvJtbdHeaderRow,
		csvSwotHeaderRow,
		csvResearchHeaderRow,
		csvValuePropHeaderRow,
		csvCompetitorHeaderRow,
		canExportResearches,
		deleteModal,
		setDeleteModal,
		updateCompanyMutation,
		createCompanyMutation,
		createProjectMutation,
		updateProjectMutation,
		deleteCompanyMutation,
		deleteProjectMutation,
		createJobStoryMutation,
		extractJobStoriesMutation,
		createValuePropMutation,
		createSwotMutation,
		createCompetitorMutation,
		createResearchMutation,
		deleteJobStoryMutation,
		deleteValuePropMutation,
		deleteCompetitorMutation,
		deleteResearchMutation,
		deleteSwotMutation,
	} = ctx;

	function handleCreateCompany(event: React.FormEvent) {
		event.preventDefault();
		const name = companyForm.name.trim();
		if (!name) {
			cabinetNotify.error(t('cabinetPage.validation.companyNameRequired'));
			return;
		}
		const website = companyForm.website.trim();
		if (website && !isValidUrl(website)) {
			cabinetNotify.error(t('cabinetPage.validation.companyWebsiteInvalid'));
			return;
		}
		const repPayload =
			companyForm.representativeDeferred || !companyForm.representativeUserId
				? null
				: companyForm.representativeUserId;
		if (editingCompany) {
			updateCompanyMutation.mutate({
				companyId: editingCompany.id,
				payload: {
					name,
					industry: companyForm.industry.trim() || undefined,
					website: website || undefined,
					description: companyForm.description.trim() || undefined,
					size: companyForm.size || undefined,
					representative_user_id: repPayload,
				},
			});
		} else {
			createCompanyMutation.mutate({
				name,
				slug: slugifyCompanySlug(name),
				industry: companyForm.industry.trim() || undefined,
				website: website || undefined,
				description: companyForm.description.trim() || undefined,
				size: companyForm.size || undefined,
				representative_user_id: repPayload,
			});
		}
	}

	function handleCreateProject(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedCompanyId) {
			cabinetNotify.error(t('cabinetPage.validation.selectCompanyForProject'));
			return;
		}
		const name = projectForm.name.trim();
		if (!name) {
			cabinetNotify.error(t('cabinetPage.validation.projectNameRequired'));
			return;
		}
		if (editingProject) {
			updateProjectMutation.mutate({
				projectId: editingProject.id,
				payload: {
					name,
					description: projectForm.description.trim() || undefined,
					goals: projectForm.goals.trim() || null,
					key_tasks: projectForm.key_tasks.trim() || null,
					category: projectForm.category || undefined,
					priority: projectForm.priority || undefined,
				},
			});
			return;
		}
		createProjectMutation.mutate({
			company_id: selectedCompanyId,
			name,
			slug: slugifyProjectSlug(name),
			description: projectForm.description.trim() || undefined,
			goals: projectForm.goals.trim() || undefined,
			key_tasks: projectForm.key_tasks.trim() || undefined,
			category: projectForm.category || undefined,
			priority: projectForm.priority || undefined,
			tags: ['marketing-cabinet'],
			enabled_modules: PROJECT_ENABLED_MODULES,
		});
	}

	function handleCreateJobStory(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedProjectId) {
			cabinetNotify.error(t('cabinetPage.validation.selectProjectForJtbd'));
			return;
		}
		if (
			!jobStoryForm.situation.trim() ||
			!jobStoryForm.motivation.trim() ||
			!jobStoryForm.outcome.trim()
		) {
			cabinetNotify.error(t('cabinetPage.validation.jtbdCoreFieldsRequired'));
			return;
		}
		createJobStoryMutation.mutate({
			project_id: selectedProjectId,
			title: jobStoryForm.title.trim() || jobStoryForm.situation.trim(),
			situation: jobStoryForm.situation.trim(),
			motivation: jobStoryForm.motivation.trim(),
			expected_outcome: jobStoryForm.outcome.trim(),
			category: jobStoryForm.category,
			priority: jobStoryForm.priority,
			importance_score: parseOptionalNumber(jobStoryForm.importance_score),
			satisfaction_score: parseOptionalNumber(jobStoryForm.satisfaction_score),
			tags: parseMultilineList(jobStoryForm.tags),
		});
	}

	function handleExtractJobStories(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedProjectId) {
			cabinetNotify.error(t('cabinetPage.validation.selectProjectForExtract'));
			return;
		}
		if (jobStoryExtractText.trim().length < 100) {
			cabinetNotify.error(t('cabinetPage.validation.interviewMinChars'));
			return;
		}
		extractJobStoriesMutation.mutate(undefined);
	}

	function handleCreateValueProp(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedProjectId) {
			cabinetNotify.error(t('cabinetPage.validation.selectProjectForVp'));
			return;
		}
		createValuePropMutation.mutate({
			project_id: selectedProjectId,
			headline: valuePropForm.headline.trim() || undefined,
			subheadline: valuePropForm.subheadline.trim() || undefined,
			value_statement: valuePropForm.value_statement.trim() || undefined,
			proof_points: parseMultilineList(valuePropForm.proof_points),
			target_channels: parseMultilineList(valuePropForm.target_channels),
			job_story_ids: selectedJobStoryIds,
			status: valuePropForm.status,
		});
	}

	function handleCreateSwot(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedProjectId || !selectedProject) {
			cabinetNotify.error(t('cabinetPage.validation.selectProjectForSwot'));
			return;
		}
		if (!swotManualForm.title.trim()) {
			cabinetNotify.error(t('cabinetPage.validation.swotTitleRequired'));
			return;
		}
		createSwotMutation.mutate({
			project_id: selectedProjectId,
			title: swotManualForm.title.trim(),
			executive_summary: swotManualForm.executive_summary.trim() || undefined,
			company_name: selectedCompany?.name,
			industry: selectedCompany?.industry ?? undefined,
			strengths: buildSwotFactors(swotManualForm.strengths, 'high'),
			weaknesses: buildSwotFactors(swotManualForm.weaknesses, 'medium'),
			opportunities: buildSwotFactors(swotManualForm.opportunities, 'high'),
			threats: buildSwotFactors(swotManualForm.threats, 'critical'),
		});
	}

	function handleCreateCompetitor(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedProjectId) {
			cabinetNotify.error(
				t('cabinetPage.validation.selectProjectForCompetitor')
			);
			return;
		}
		if (!competitorForm.name.trim()) {
			cabinetNotify.error(t('cabinetPage.validation.competitorNameRequired'));
			return;
		}
		const website = competitorForm.website.trim();
		if (website && !isValidUrl(website)) {
			cabinetNotify.error(t('cabinetPage.validation.competitorWebsiteInvalid'));
			return;
		}
		createCompetitorMutation.mutate({
			project_id: selectedProjectId,
			name: competitorForm.name.trim(),
			website: website || undefined,
			description: competitorForm.description.trim() || undefined,
			competitor_type: competitorForm.competitor_type,
			market_position: competitorForm.market_position.trim() || undefined,
			pricing_strategy: competitorForm.pricing_strategy.trim() || undefined,
			strengths: parseMultilineList(competitorForm.strengths),
			weaknesses: parseMultilineList(competitorForm.weaknesses),
		});
	}

	function handleCreateResearch(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedProjectId) {
			cabinetNotify.error(t('cabinetPage.validation.selectProjectForResearch'));
			return;
		}
		if (!researchForm.title.trim() || !researchForm.research_query.trim()) {
			cabinetNotify.error(
				t('cabinetPage.validation.researchTitleQueryRequired')
			);
			return;
		}
		createResearchMutation.mutate({
			project_id: selectedProjectId,
			title: researchForm.title.trim(),
			research_type: researchForm.research_type,
			research_query: researchForm.research_query.trim(),
			description: researchForm.description.trim() || undefined,
			goals: parseMultilineList(researchForm.goals),
			priority: researchForm.priority,
			status: researchForm.status,
			result_summary: researchForm.result_summary.trim() || undefined,
		});
	}

	async function handleCopyAllJobs() {
		const text = allJobStories
			.map(
				(j) =>
					`${j.title}\n${j.statement}\n${localizeJobCategory(j.category)} · ${localizePriority(j.priority)} · ${localizeSource(j.source)}`
			)
			.join('\n\n');
		const ok = await copyToClipboard(text);
		if (ok) cabinetNotify.success(t('cabinetPage.copy.jtbdCopied'));
		else cabinetNotify.error(t('toolbar.idCopyFailed'));
	}

	async function handleCopyAllValueProps() {
		const text = filteredValuePropositions
			.map((vp) => valuePropToClipboardText(t, vp))
			.join('\n\n');
		const ok = await copyToClipboard(text);
		if (ok) cabinetNotify.success(t('cabinetPage.copy.valuePropsCopied'));
		else cabinetNotify.error(t('toolbar.idCopyFailed'));
	}

	async function handleCopySingleValueProp(vp: MarketingValueProposition) {
		const ok = await copyToClipboard(valuePropToClipboardText(t, vp));
		if (ok) cabinetNotify.success(t('cabinetPage.copy.valuePropCardCopied'));
		else cabinetNotify.error(t('toolbar.idCopyFailed'));
	}

	async function handleCopySingleJob(job: MarketingJobStory) {
		const text = `${job.title}\n${job.statement}\n${localizeJobCategory(job.category)} · ${localizePriority(job.priority)} · ${localizeSource(job.source)}`;
		const ok = await copyToClipboard(text);
		if (ok) cabinetNotify.success(t('cabinetPage.copy.jtbdCardCopied'));
		else cabinetNotify.error(t('toolbar.idCopyFailed'));
	}

	async function handleCopySingleSwot(s: MarketingSwot) {
		const ok = await copyToClipboard(swotToClipboardText(t, s));
		if (ok) cabinetNotify.success(t('cabinetPage.copy.swotCardCopied'));
		else cabinetNotify.error(t('toolbar.idCopyFailed'));
	}

	async function handleCopySingleCompetitor(c: MarketingCompetitor) {
		const lines: string[] = [c.name ?? ''];
		if (c.website?.trim()) lines.push(c.website.trim());
		lines.push(
			localizeCompetitorType(c.competitor_type),
			c.market_position ?? '',
			c.pricing_strategy ?? '',
			c.description ?? ''
		);
		const filtered = lines.filter((line) => line.length > 0);
		if ((c.strengths ?? []).length) {
			filtered.push(
				`${t('cabinetPage.copy.strengthsPrefix')} ${(c.strengths ?? []).join('; ')}`
			);
		}
		if ((c.weaknesses ?? []).length) {
			filtered.push(
				`${t('cabinetPage.copy.weaknessesPrefix')} ${(c.weaknesses ?? []).join('; ')}`
			);
		}
		const ok = await copyToClipboard(filtered.join('\n'));
		if (ok) cabinetNotify.success(t('cabinetPage.copy.competitorCardCopied'));
		else cabinetNotify.error(t('toolbar.idCopyFailed'));
	}

	function handleExportJobs() {
		const rows: string[][] = [
			csvJtbdHeaderRow,
			...allJobStories.map((j) => [
				j.title,
				j.situation,
				j.motivation,
				j.outcome,
				localizeJobCategory(j.category),
				localizePriority(j.priority),
				localizeSource(j.source),
				(j.tags ?? []).join('; '),
			]),
		];
		downloadCsv(
			rows,
			`jtbd-${selectedProject?.slug || 'project'}-${new Date().toISOString().slice(0, 10)}.csv`
		);
	}

	async function handleCopyAllSwot() {
		const text = swotItems.map((s) => swotToClipboardText(t, s)).join('\n\n');
		const ok = await copyToClipboard(text);
		if (ok) cabinetNotify.success(t('cabinetPage.copy.swotCopied'));
		else cabinetNotify.error(t('toolbar.idCopyFailed'));
	}

	function handleExportSwot() {
		const rows: string[][] = [
			csvSwotHeaderRow,
			...swotItems.flatMap((s) =>
				(['strength', 'weakness', 'opportunity', 'threat'] as const).flatMap(
					(type) =>
						(
							(s.factors?.[type] ?? []) as Array<{
								factor_text?: string | null;
								description?: string | null;
							}>
						).map((f) => [
							s.title ?? '',
							t(`cabinetPage.swotFactor.${type}`),
							f.factor_text ?? '',
							f.description ?? '',
						])
				)
			),
		];
		downloadCsv(
			rows,
			`swot-${selectedProject?.slug || 'project'}-${new Date().toISOString().slice(0, 10)}.csv`
		);
	}

	async function handleCopyAllResearches() {
		const text = filteredResearches
			.map(
				(r) =>
					`${r.title}\n${r.research_query || ''}\n${localizeResearchTypeSafe(r.research_type)} · ${localizeStatus(r.status)}\n${r.result_summary || ''}`
			)
			.join('\n\n');
		const ok = await copyToClipboard(text);
		if (ok) cabinetNotify.success(t('cabinetPage.copy.researchesCopied'));
		else cabinetNotify.error(t('toolbar.idCopyFailed'));
	}

	async function handleCopyAllCompetitors() {
		const text = filteredCompetitors
			.map(
				(c) =>
					`${c.name}\n${localizeCompetitorType(c.competitor_type)} · ${c.market_position || ''}\n${c.description || ''}\n${t('cabinetPage.copy.strengthsPrefix')} ${(c.strengths ?? []).join(', ')}\n${t('cabinetPage.copy.weaknessesPrefix')} ${(c.weaknesses ?? []).join(', ')}`
			)
			.join('\n\n');
		const ok = await copyToClipboard(text);
		if (ok) cabinetNotify.success(t('cabinetPage.copy.competitorsCopied'));
		else cabinetNotify.error(t('toolbar.idCopyFailed'));
	}

	function handleExportResearches() {
		if (!canExportResearches) {
			cabinetNotify.info(t('evidenceView.exportResearchesLeadOnly'));
			return;
		}
		const rows: string[][] = [
			csvResearchHeaderRow,
			...filteredResearches.map((r) => [
				r.title ?? '',
				localizeResearchTypeSafe(r.research_type),
				r.research_query ?? '',
				localizePriority(r.priority),
				localizeStatus(r.status),
				(r.goals ?? []).map((g) => g ?? '').join('; '),
				r.result_summary ?? '',
			]),
		];
		downloadCsv(
			rows,
			`researches-${selectedProject?.slug || 'project'}-${new Date().toISOString().slice(0, 10)}.csv`
		);
	}

	function handleExportValueProps() {
		const rows: string[][] = [
			csvValuePropHeaderRow,
			...filteredValuePropositions.map((vp) => [
				vp.headline ?? '',
				vp.subheadline ?? '',
				vp.value_statement ?? '',
				localizeStatus(vp.status),
				(vp.proof_points ?? []).map(String).join('; '),
				(vp.target_channels ?? []).join('; '),
				(vp.addressed_jobs ?? [])
					.map((j) =>
						typeof j === 'object' && j && 'title' in j
							? String((j as { title?: unknown }).title ?? '')
							: ''
					)
					.join('; '),
			]),
		];
		downloadCsv(
			rows,
			`value-propositions-${selectedProject?.slug || 'project'}-${new Date().toISOString().slice(0, 10)}.csv`
		);
	}

	function handleExportCompetitors() {
		const rows: string[][] = [
			csvCompetitorHeaderRow,
			...filteredCompetitors.map((c) => [
				c.name ?? '',
				localizeCompetitorType(c.competitor_type),
				c.market_position ?? '',
				c.pricing_strategy ?? '',
				c.description ?? '',
				(c.strengths ?? []).map((s) => s ?? '').join('; '),
				(c.weaknesses ?? []).map((w) => w ?? '').join('; '),
			]),
		];
		downloadCsv(
			rows,
			`competitors-${selectedProject?.slug || 'project'}-${new Date().toISOString().slice(0, 10)}.csv`
		);
	}

	function handleConfirmDelete() {
		if (!deleteModal) return;
		const { type, id } = deleteModal;
		setDeleteModal(null);
		switch (type) {
			case 'company':
				deleteCompanyMutation.mutate(id);
				break;
			case 'project':
				deleteProjectMutation.mutate(id);
				break;
			case 'job':
				deleteJobStoryMutation.mutate(id);
				break;
			case 'valueProp':
				deleteValuePropMutation.mutate(id);
				break;
			case 'competitor':
				deleteCompetitorMutation.mutate(id);
				break;
			case 'research':
				deleteResearchMutation.mutate(id);
				break;
			case 'swot':
				deleteSwotMutation.mutate(id);
				break;
		}
	}

	return {
		handleCreateCompany,
		handleCreateProject,
		handleCreateJobStory,
		handleExtractJobStories,
		handleCreateValueProp,
		handleCreateSwot,
		handleCreateCompetitor,
		handleCreateResearch,
		handleCopyAllJobs,
		handleCopyAllValueProps,
		handleCopySingleValueProp,
		handleCopySingleJob,
		handleCopySingleSwot,
		handleCopySingleCompetitor,
		handleExportJobs,
		handleCopyAllSwot,
		handleExportSwot,
		handleCopyAllResearches,
		handleCopyAllCompetitors,
		handleExportResearches,
		handleExportValueProps,
		handleExportCompetitors,
		handleConfirmDelete,
	};
}
