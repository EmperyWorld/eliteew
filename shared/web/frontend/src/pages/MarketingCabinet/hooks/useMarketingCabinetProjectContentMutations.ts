import { useMutation, useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { cabinetNotify } from '../cabinetNotify';
import {
	marketingCabinetApi,
	type CreateCompetitorPayload,
	type CreateJobStoryPayload,
	type CreateResearchPayload,
	type CreateSwotPayload,
	type CreateValuePropositionPayload,
	type UpdateCompetitorPayload,
	type UpdateJobStoryPayload,
	type UpdateSwotPayload,
} from '../marketingCabinetApi';
import type {
	CompetitorFormState,
	JobStoryFormState,
	ResearchFormState,
	SwotManualFormState,
	ValuePropFormState,
} from '../marketingCabinetPageTypes';
import {
	getHttpStatus,
	removeMarketingListEntity,
} from '../marketingCabinetPageHelpers';
import { requireDefined } from '../utils';
import {
	marketingCabinetAiRunsProjectInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';
import {
	marketingWebSearchApiFields,
	readStoredMarketingWebSearchQuality,
} from '../marketingWebSearchQuality';

export type MarketingCabinetProjectContentMutationsDeps = {
	t: (key: string, options?: Record<string, unknown>) => string;
	queryClient: ReturnType<typeof useQueryClient>;
	selectedProjectId: string | null;
	invalidateCurrentProjectMarketing: () => Promise<void>;
	raiseErrorNotice: (error: unknown, fallback: string) => void;
	setJobStorySearch: React.Dispatch<React.SetStateAction<string>>;
	setJobStoryForm: React.Dispatch<React.SetStateAction<JobStoryFormState>>;
	setSelectedJobStoryIds: React.Dispatch<React.SetStateAction<string[]>>;
	setJobStoryExtractRunId: React.Dispatch<React.SetStateAction<string | null>>;
	jobStoryExtractText: string;
	jobStoryExtractCount: string;
	setEditingJobStory: React.Dispatch<
		React.SetStateAction<
			import('../marketingCabinetApi').MarketingJobStory | null
		>
	>;
	setValuePropForm: React.Dispatch<React.SetStateAction<ValuePropFormState>>;
	setSwotManualForm: React.Dispatch<React.SetStateAction<SwotManualFormState>>;
	setSwotGenerateRunId: React.Dispatch<React.SetStateAction<string | null>>;
	swotGenerateContext: string;
	setEditingSwot: React.Dispatch<
		React.SetStateAction<import('../marketingCabinetApi').MarketingSwot | null>
	>;
	setCompetitorForm: React.Dispatch<React.SetStateAction<CompetitorFormState>>;
	setEditingCompetitor: React.Dispatch<
		React.SetStateAction<
			import('../marketingCabinetApi').MarketingCompetitor | null
		>
	>;
	setResearchForm: React.Dispatch<React.SetStateAction<ResearchFormState>>;
	setResearchRunTargetId: React.Dispatch<React.SetStateAction<string | null>>;
	setResearchRunPollId: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useMarketingCabinetProjectContentMutations(
	deps: MarketingCabinetProjectContentMutationsDeps
) {
	const {
		t,
		queryClient,
		selectedProjectId,
		invalidateCurrentProjectMarketing,
		raiseErrorNotice,
		setJobStorySearch,
		setJobStoryForm,
		setSelectedJobStoryIds,
		setJobStoryExtractRunId,
		jobStoryExtractText,
		jobStoryExtractCount,
		setEditingJobStory,
		setValuePropForm,
		setSwotManualForm,
		setSwotGenerateRunId,
		swotGenerateContext,
		setEditingSwot,
		setCompetitorForm,
		setEditingCompetitor,
		setResearchForm,
		setResearchRunTargetId,
		setResearchRunPollId,
	} = deps;

	const createJobStoryMutation = useMutation({
		mutationFn: (payload: CreateJobStoryPayload) =>
			marketingCabinetApi.createJobStory(payload),
		onSuccess: async () => {
			await invalidateCurrentProjectMarketing();
			setJobStorySearch('');
			setJobStoryForm({
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
			cabinetNotify.success(t('cabinetPage.notices.jobStoryCreated'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.jobStoryCreateFailed')),
	});

	const extractJobStoriesMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.extractJobStoriesAsync({
				project_id: requireDefined(selectedProjectId, 'selectedProjectId'),
				text: jobStoryExtractText.trim(),
				max_stories: Number(jobStoryExtractCount) || 6,
			}),
		retry: (failureCount, error) => {
			const status = (error as { response?: { status?: number } })?.response
				?.status;
			if (status === 429) return false;
			return failureCount < 2;
		},
		retryDelay: 1500,
		onSuccess: async (response) => {
			setJobStoryExtractRunId(response.run.id);
			await queryClient.invalidateQueries({
				queryKey: marketingCabinetAiRunsProjectInvalidationQueryKey(
					requireDefined(selectedProjectId, 'selectedProjectId')
				),
			});
			cabinetNotify.success(
				response.queue?.status === 'queued'
					? t('cabinetPage.notices.jtbdExtractQueued')
					: t('cabinetPage.notices.jtbdExtractStarted')
			);
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.jtbdExtractFailed')),
	});

	const deleteJobStoryMutation = useMutation({
		mutationFn: (storyId: string) =>
			marketingCabinetApi.deleteJobStory(storyId),
		onSuccess: async (_, storyId) => {
			const pid = selectedProjectId;
			if (pid) {
				removeMarketingListEntity(
					queryClient,
					marketingCabinetProjectSectionInvalidationQueryKey('jtbd', pid),
					storyId
				);
			}
			setSelectedJobStoryIds((prev) => prev.filter((x) => x !== storyId));
			await invalidateCurrentProjectMarketing();
			cabinetNotify.success(t('cabinetPage.notices.jobStoryDeleted'));
		},
		onError: async (error, storyId) => {
			if (getHttpStatus(error) === 404) {
				const pid = selectedProjectId;
				if (pid) {
					removeMarketingListEntity(
						queryClient,
						marketingCabinetProjectSectionInvalidationQueryKey('jtbd', pid),
						storyId
					);
					await queryClient.refetchQueries({
						queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
							'jtbd',
							pid
						),
					});
				}
				setSelectedJobStoryIds((prev) => prev.filter((x) => x !== storyId));
				await invalidateCurrentProjectMarketing();
				cabinetNotify.success(
					t('cabinetPage.notices.alreadyDeletedListRefreshed')
				);
				return;
			}
			raiseErrorNotice(error, t('cabinetPage.notices.jobStoryDeleteFailed'));
		},
	});

	const updateJobStoryMutation = useMutation({
		mutationFn: ({
			storyId,
			payload,
		}: {
			storyId: string;
			payload: UpdateJobStoryPayload;
		}) => marketingCabinetApi.updateJobStory(storyId, payload),
		onSuccess: async () => {
			await invalidateCurrentProjectMarketing();
			setEditingJobStory(null);
			cabinetNotify.success(t('cabinetPage.notices.jobStoryUpdated'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.jobStoryUpdateFailed')),
	});

	const createValuePropMutation = useMutation({
		mutationFn: (payload: CreateValuePropositionPayload) =>
			marketingCabinetApi.createValueProposition(payload),
		onSuccess: async () => {
			await invalidateCurrentProjectMarketing();
			setValuePropForm({
				headline: '',
				subheadline: '',
				value_statement: '',
				proof_points: '',
				target_channels: '',
				status: 'draft',
			});
			setSelectedJobStoryIds([]);
			cabinetNotify.success(t('cabinetPage.notices.valuePropCreated'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.valuePropCreateFailed')),
	});

	const updateValuePropMutation = useMutation({
		mutationFn: ({
			valuePropId,
			payload,
		}: {
			valuePropId: string;
			payload: { status?: string };
		}) => marketingCabinetApi.updateValueProposition(valuePropId, payload),
		onSuccess: async () => {
			await invalidateCurrentProjectMarketing();
			cabinetNotify.success(t('cabinetPage.notices.valuePropUpdated'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.valuePropUpdateFailed')),
	});

	const deleteValuePropMutation = useMutation({
		mutationFn: (valuePropId: string) =>
			marketingCabinetApi.deleteValueProposition(valuePropId),
		onSuccess: async (_, valuePropId) => {
			const pid = selectedProjectId;
			if (pid) {
				removeMarketingListEntity(
					queryClient,
					marketingCabinetProjectSectionInvalidationQueryKey(
						'value-propositions',
						pid
					),
					valuePropId
				);
			}
			await invalidateCurrentProjectMarketing();
			cabinetNotify.success(t('cabinetPage.notices.valuePropDeleted'));
		},
		onError: async (error, valuePropId) => {
			if (getHttpStatus(error) === 404) {
				const pid = selectedProjectId;
				if (pid) {
					removeMarketingListEntity(
						queryClient,
						marketingCabinetProjectSectionInvalidationQueryKey(
							'value-propositions',
							pid
						),
						valuePropId
					);
					await queryClient.refetchQueries({
						queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
							'value-propositions',
							pid
						),
					});
				}
				await invalidateCurrentProjectMarketing();
				cabinetNotify.success(
					t('cabinetPage.notices.alreadyDeletedListRefreshed')
				);
				return;
			}
			raiseErrorNotice(error, t('cabinetPage.notices.valuePropDeleteFailed'));
		},
	});

	const createSwotMutation = useMutation({
		mutationFn: (payload: CreateSwotPayload) =>
			marketingCabinetApi.createSwot(payload),
		onSuccess: async () => {
			await invalidateCurrentProjectMarketing();
			setSwotManualForm({
				title: '',
				executive_summary: '',
				strengths: '',
				weaknesses: '',
				opportunities: '',
				threats: '',
			});
			cabinetNotify.success(t('cabinetPage.notices.swotManualCreated'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.swotCreateFailed')),
	});

	const generateSwotMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.generateSwotAsync({
				project_id: requireDefined(selectedProjectId, 'selectedProjectId'),
				context: swotGenerateContext.trim() || undefined,
			}),
		retry: (failureCount, error) => {
			const status = (error as { response?: { status?: number } })?.response
				?.status;
			if (status === 429) return false;
			return failureCount < 2;
		},
		retryDelay: 1500,
		onSuccess: async (response) => {
			setSwotGenerateRunId(response.run.id);
			await queryClient.invalidateQueries({
				queryKey: marketingCabinetAiRunsProjectInvalidationQueryKey(
					requireDefined(selectedProjectId, 'selectedProjectId')
				),
			});
			cabinetNotify.success(
				response.queue?.status === 'queued'
					? t('cabinetPage.notices.swotGenQueued')
					: t('cabinetPage.notices.swotGenStarted')
			);
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.swotGenMutationFailed')),
	});

	const updateSwotMutation = useMutation({
		mutationFn: ({
			analysisId,
			payload,
		}: {
			analysisId: string;
			payload: UpdateSwotPayload;
		}) => marketingCabinetApi.updateSwot(analysisId, payload),
		onSuccess: async () => {
			await invalidateCurrentProjectMarketing();
			setEditingSwot(null);
			cabinetNotify.success(t('cabinetPage.notices.swotUpdated'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.swotUpdateFailed')),
	});

	const deleteSwotMutation = useMutation({
		mutationFn: (analysisId: string) =>
			marketingCabinetApi.deleteSwot(analysisId),
		onSuccess: async (_, analysisId) => {
			const pid = selectedProjectId;
			if (pid) {
				removeMarketingListEntity(
					queryClient,
					marketingCabinetProjectSectionInvalidationQueryKey('swot', pid),
					analysisId
				);
			}
			setEditingSwot((prev) => (prev?.id === analysisId ? null : prev));
			await invalidateCurrentProjectMarketing();
			cabinetNotify.success(t('cabinetPage.notices.swotDeleted'));
		},
		onError: async (error, analysisId) => {
			if (getHttpStatus(error) === 404) {
				const pid = selectedProjectId;
				if (pid) {
					removeMarketingListEntity(
						queryClient,
						marketingCabinetProjectSectionInvalidationQueryKey('swot', pid),
						analysisId
					);
					await queryClient.refetchQueries({
						queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
							'swot',
							pid
						),
					});
				}
				setEditingSwot((prev) => (prev?.id === analysisId ? null : prev));
				await invalidateCurrentProjectMarketing();
				cabinetNotify.success(
					t('cabinetPage.notices.alreadyDeletedListRefreshed')
				);
				return;
			}
			raiseErrorNotice(error, t('cabinetPage.notices.swotDeleteFailed'));
		},
	});

	const createCompetitorMutation = useMutation({
		mutationFn: (payload: CreateCompetitorPayload) =>
			marketingCabinetApi.createCompetitor(payload),
		onSuccess: async () => {
			await invalidateCurrentProjectMarketing();
			setCompetitorForm({
				name: '',
				website: '',
				description: '',
				competitor_type: 'direct',
				market_position: '',
				pricing_strategy: '',
				strengths: '',
				weaknesses: '',
			});
			cabinetNotify.success(t('cabinetPage.notices.competitorAdded'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.competitorAddFailed')),
	});

	const deleteCompetitorMutation = useMutation({
		mutationFn: (competitorId: string) =>
			marketingCabinetApi.deleteCompetitor(competitorId),
		onSuccess: async (_, competitorId) => {
			const pid = selectedProjectId;
			if (pid) {
				removeMarketingListEntity(
					queryClient,
					marketingCabinetProjectSectionInvalidationQueryKey(
						'competitors',
						pid
					),
					competitorId
				);
			}
			setEditingCompetitor((prev) => (prev?.id === competitorId ? null : prev));
			await invalidateCurrentProjectMarketing();
			cabinetNotify.success(t('cabinetPage.notices.competitorDeleted'));
		},
		onError: async (error, competitorId) => {
			if (getHttpStatus(error) === 404) {
				const pid = selectedProjectId;
				if (pid) {
					removeMarketingListEntity(
						queryClient,
						marketingCabinetProjectSectionInvalidationQueryKey(
							'competitors',
							pid
						),
						competitorId
					);
					await queryClient.refetchQueries({
						queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
							'competitors',
							pid
						),
					});
				}
				setEditingCompetitor((prev) =>
					prev?.id === competitorId ? null : prev
				);
				await invalidateCurrentProjectMarketing();
				cabinetNotify.success(
					t('cabinetPage.notices.alreadyDeletedListRefreshed')
				);
				return;
			}
			raiseErrorNotice(error, t('cabinetPage.notices.competitorDeleteFailed'));
		},
	});

	const updateCompetitorMutation = useMutation({
		mutationFn: ({
			competitorId,
			payload,
		}: {
			competitorId: string;
			payload: UpdateCompetitorPayload;
		}) => marketingCabinetApi.updateCompetitor(competitorId, payload),
		onSuccess: async () => {
			await invalidateCurrentProjectMarketing();
			setEditingCompetitor(null);
			cabinetNotify.success(t('cabinetPage.notices.competitorUpdated'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.competitorUpdateFailed')),
	});

	const createResearchMutation = useMutation({
		mutationFn: (payload: CreateResearchPayload) =>
			marketingCabinetApi.createResearch(payload),
		onSuccess: async () => {
			await invalidateCurrentProjectMarketing();
			setResearchForm({
				title: '',
				research_type: 'market',
				research_query: '',
				description: '',
				goals: '',
				priority: 'normal',
				status: 'draft',
				result_summary: '',
			});
			cabinetNotify.success(t('cabinetPage.notices.researchCreated'));
		},
		onError: (error) =>
			raiseErrorNotice(error, t('cabinetPage.notices.researchCreateFailed')),
	});

	const runResearchAsyncMutation = useMutation({
		mutationFn: ({ researchId }: { researchId: string }) =>
			marketingCabinetApi.runResearchAsync(researchId, {
				...marketingWebSearchApiFields(readStoredMarketingWebSearchQuality()),
			}),
		retry: (failureCount, error) => {
			const status = (error as { response?: { status?: number } })?.response
				?.status;
			if (status === 429) return false;
			return failureCount < 2;
		},
		retryDelay: 1500,
		onSuccess: async (response, { researchId }) => {
			setResearchRunTargetId(researchId);
			setResearchRunPollId(response.run.id);
			await queryClient.invalidateQueries({
				queryKey: marketingCabinetAiRunsProjectInvalidationQueryKey(
					requireDefined(selectedProjectId, 'selectedProjectId')
				),
			});
			cabinetNotify.success(
				response.queue?.status === 'queued'
					? t('cabinetPage.notices.researchSynthQueued')
					: t('cabinetPage.notices.researchSynthStarted')
			);
		},
		onError: (error) =>
			raiseErrorNotice(
				error,
				t('cabinetPage.notices.researchSynthStartFailed')
			),
	});

	const deleteResearchMutation = useMutation({
		mutationFn: (researchId: string) =>
			marketingCabinetApi.deleteResearch(researchId),
		onSuccess: async (_, researchId) => {
			const pid = selectedProjectId;
			if (pid) {
				removeMarketingListEntity(
					queryClient,
					marketingCabinetProjectSectionInvalidationQueryKey('researches', pid),
					researchId
				);
			}
			await invalidateCurrentProjectMarketing();
			cabinetNotify.success(t('cabinetPage.notices.researchDeleted'));
		},
		onError: async (error, researchId) => {
			if (getHttpStatus(error) === 404) {
				const pid = selectedProjectId;
				if (pid) {
					removeMarketingListEntity(
						queryClient,
						marketingCabinetProjectSectionInvalidationQueryKey(
							'researches',
							pid
						),
						researchId
					);
					await queryClient.refetchQueries({
						queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
							'researches',
							pid
						),
					});
				}
				await invalidateCurrentProjectMarketing();
				cabinetNotify.success(
					t('cabinetPage.notices.alreadyDeletedListRefreshed')
				);
				return;
			}
			raiseErrorNotice(error, t('cabinetPage.notices.researchDeleteFailed'));
		},
	});

	return {
		createJobStoryMutation,
		extractJobStoriesMutation,
		deleteJobStoryMutation,
		updateJobStoryMutation,
		createValuePropMutation,
		updateValuePropMutation,
		deleteValuePropMutation,
		createSwotMutation,
		generateSwotMutation,
		updateSwotMutation,
		deleteSwotMutation,
		createCompetitorMutation,
		deleteCompetitorMutation,
		updateCompetitorMutation,
		createResearchMutation,
		runResearchAsyncMutation,
		deleteResearchMutation,
	};
}
