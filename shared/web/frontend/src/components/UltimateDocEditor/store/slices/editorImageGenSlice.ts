/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zustand slice for Ultimate Doc Editor store (imagegen).
 *
 * Invariants:
 * - Actions use helpers from `editorStoreHelpers.ts`; no direct React.
 *
 * Related:
 * - `store/editorStore.ts`
 */

import type { StateCreator } from 'zustand';
import type { EditorStore } from '../editorStore';
import { log } from '../../../../utils/logger';
import type { ImageGenerationRequest } from '../../types/editor.types';
import {
	apiFetch,
	extractImageUrlFromPayload,
	getNestedResultMessage,
	normalizeImageUrlForDisplay,
	parseUgsGenerationResult,
	parseUgsStatusResult,
	sanitizeStatusLabel,
	ugsGenerateStream,
} from '../editorStoreHelpers';

export const createEditorImageGenSlice =
	(): StateCreator<EditorStore, [], [], Partial<EditorStore>> =>
	(set, _get, _api) => ({
		openImageGenPanel: () =>
			set({
				imageGenPanelOpen: true,
				aiPanelOpen: false,
				aiStreamingText: '',
				aiFileManagerContext: null,
			}),
		closeImageGenPanel: () => set({ imageGenPanelOpen: false }),

		generateImage: async (request: ImageGenerationRequest) => {
			set({ isGeneratingImage: true, error: undefined });
			const workflowSlug = '01_top';
			const width = request.width ?? 1024;
			const height = request.height ?? 1024;
			const ugsRequest = {
				type_key: 'image_generation_comfyui',
				input_data: {
					prompt: request.prompt,
					workflow_template: workflowSlug,
					width,
					height,
					...(request.seed !== undefined && request.seed >= 0
						? { seed: request.seed }
						: {}),
				},
				priority: 5,
			};
			try {
				let startedRequestId: string | null = null;
				const result = await ugsGenerateStream(
					ugsRequest as Record<string, unknown>,
					{
						onStarted: (requestId) => {
							startedRequestId = requestId;
							const imageData = {
								...request,
								prompt: request.prompt,
								workflow_type: workflowSlug,
								workflow_template: workflowSlug,
								width,
								height,
								job_id: requestId,
								status: 'pending',
								created_at: new Date().toISOString(),
								error: undefined,
							};
							set((state) => ({
								generatedImages: [...state.generatedImages, imageData],
								isGeneratingImage: false,
							}));
						},
					}
				);
				const jobId = (result.request_id as string) || startedRequestId;
				if (!jobId) {
					set({ isGeneratingImage: false });
					return;
				}
				const payload = result.result ?? result.result_preview ?? result;
				const directUrl = (result as { output_data?: { image_url?: string } })
					.output_data?.image_url;
				const extractedUrl = extractImageUrlFromPayload(payload);
				const metadataUrl = extractImageUrlFromPayload(result.metadata);
				const resolvedImageUrl = directUrl || extractedUrl || metadataUrl;
				const errorMessage = result.error as string | undefined;
				set((state) => {
					const hasExisting = state.generatedImages.some(
						(img) => img.job_id === jobId
					);
					return {
						generatedImages: hasExisting
							? state.generatedImages.map((img) =>
									img.job_id !== jobId
										? img
										: {
												...img,
												status: 'completed',
												image_url: normalizeImageUrlForDisplay(
													resolvedImageUrl ?? img.image_url
												),
												error: errorMessage,
											}
								)
							: [
									...state.generatedImages,
									{
										...request,
										prompt: request.prompt,
										workflow_type: workflowSlug,
										workflow_template: workflowSlug,
										width,
										height,
										job_id: jobId,
										status: 'completed',
										created_at: new Date().toISOString(),
										image_url: normalizeImageUrlForDisplay(resolvedImageUrl),
										error: errorMessage,
									},
								],
						isGeneratingImage: false,
					};
				});
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				set({ error: errorMessage, isGeneratingImage: false });
			}
		},

		pollImageStatus: async (jobId: string) => {
			const pollInterval = 2000; // 2 seconds
			const maxAttempts = 60; // 2 minutes max
			let attempts = 0;

			const poll = async () => {
				attempts++;

				try {
					const statusRaw = await apiFetch(`/api/v1/ugs/status/${jobId}`);
					const statusResult = parseUgsStatusResult(statusRaw);

					let resolvedImageUrl: string | undefined;
					let statusOverride: string | undefined;
					let errorMessage: string | undefined;

					if (statusResult.status === 'completed') {
						const generationRaw = await apiFetch(`/api/v1/ugs/result/${jobId}`);
						const gr = parseUgsGenerationResult(generationRaw);
						const payload = gr.result ?? gr.result_preview ?? gr.root;
						const directUrl = gr.output_data?.image_url;
						const extractedUrl = extractImageUrlFromPayload(payload);
						const metadataUrl = extractImageUrlFromPayload(gr.metadata);

						resolvedImageUrl = directUrl || extractedUrl || metadataUrl;
						errorMessage = gr.error;

						if (typeof payload === 'string') {
							const candidate = payload.split('\n')[0]?.trim();
							if (candidate && candidate.length < 120) {
								statusOverride = candidate;
							}
						}

						const resultMessage = getNestedResultMessage(gr.result);
						if (typeof resultMessage === 'string') {
							const candidate = resultMessage.split('\n')[0]?.trim();
							if (candidate && candidate.length < 120) {
								statusOverride = candidate;
							}
						}
					}

					const finishedAt = statusResult.completed_at;
					const startedAt = statusResult.started_at;
					const completionSeconds =
						finishedAt && startedAt
							? (new Date(finishedAt).getTime() -
									new Date(startedAt).getTime()) /
								1000
							: undefined;
					const normalizedStatus = sanitizeStatusLabel(
						statusOverride ?? statusResult.status
					);

					set((state) => ({
						generatedImages: state.generatedImages.map((img) => {
							if (img.job_id !== jobId) {
								return img;
							}

							let finalError: string | undefined = img.error;
							if (statusResult.status === 'completed') {
								finalError = undefined;
							} else if (statusResult.status === 'failed') {
								finalError = errorMessage ?? img.error ?? 'Generation failed';
							}

							return {
								...img,
								status: normalizedStatus ?? img.status,
								image_url: normalizeImageUrlForDisplay(
									resolvedImageUrl ?? img.image_url
								),
								generation_time: completionSeconds ?? img.generation_time,
								error: finalError,
							};
						}),
					}));

					if (
						statusResult.status === 'completed' ||
						statusResult.status === 'failed'
					) {
						return;
					}

					if (attempts < maxAttempts) {
						setTimeout(poll, pollInterval);
					} else {
						set((state) => ({
							generatedImages: state.generatedImages.map((img) =>
								img.job_id === jobId
									? {
											...img,
											status: 'failed',
											error: img.error ?? 'Generation timeout',
										}
									: img
							),
						}));
					}
				} catch (error: unknown) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					log.error(
						'EditorStore',
						'Polling error',
						error instanceof Error ? error : undefined,
						error
					);
					set((state) => ({
						generatedImages: state.generatedImages.map((img) =>
							img.job_id === jobId
								? {
										...img,
										status: 'failed',
										error: errorMessage || 'Generation failed',
									}
								: img
						),
					}));
				}
			};

			// Start first poll
			poll();
		},
	});
