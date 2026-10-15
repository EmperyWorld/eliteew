/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Hub quick-launch generation: modal state and SSE `/generate/stream` submit.
 *
 * Invariants:
 * - Requires authenticated `userId` for stream seed; does not POST plain `/generate`.
 * - User-visible toasts use `ugsHub.toast.*` via `useTranslation('ugsHub')`.
 *
 * Related:
 * - components/UGSHub.tsx, runUgsGenerationStream.ts, i18n/locales en+ru ugsHub.json
 */

import type { JsonObject } from '@/types/common';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GenerationType } from '../api/useUgsDashboard';
import { buildDefaultPayload } from '../../components/UGS/hub/generation/ugsHubDefaultPayload';
import { ugsQueryKeys } from '../../services/api/ugs/queryKeys';
import { runUgsGenerationStream } from '../../services/api/ugs/runUgsGenerationStream';
import { humanizeUgsTypeKey as humanizeTypeKey } from '../../utils/ugsHumanizeTypeKey';
import { log } from '../../utils/logger';

type ToastApi = {
	success: (title: string, message?: string) => void;
	error: (title: string, message?: string) => void;
};

export interface UseUgsHubGenerationParams {
	toast: ToastApi;
	userId: string | undefined;
}

export function useUgsHubGeneration({
	toast,
	userId,
}: UseUgsHubGenerationParams) {
	const { t } = useTranslation('ugsHub');
	const queryClient = useQueryClient();

	const [generating, setGenerating] = useState<string | null>(null);
	const [showGenerationModal, setShowGenerationModal] = useState(false);
	const [selectedTypeForGeneration, setSelectedTypeForGeneration] =
		useState<GenerationType | null>(null);
	const [customInputData, setCustomInputData] = useState<JsonObject>({});

	const openGenerationModal = useCallback(
		(type: GenerationType) => {
			setSelectedTypeForGeneration(type);
			setCustomInputData(buildDefaultPayload(t, type));
			setShowGenerationModal(true);
		},
		[t]
	);

	const closeGenerationModal = useCallback(() => {
		setShowGenerationModal(false);
		setSelectedTypeForGeneration(null);
		setCustomInputData({});
	}, []);

	const startGeneration = useCallback(
		async (typeKey: string, inputData: JsonObject, priority = 5) => {
			if (!userId) {
				toast.error(t('toast.authRequired'));
				return;
			}

			setGenerating(typeKey);
			try {
				await runUgsGenerationStream(
					{ type_key: typeKey, input_data: inputData, priority },
					{
						queryClient,
						seed: {
							type_key: typeKey,
							input_data: inputData,
							priority,
							user_id: userId,
						},
					}
				);
				toast.success(
					t('toast.generationStarted', { type: humanizeTypeKey(typeKey) })
				);
				closeGenerationModal();
				await queryClient.invalidateQueries({ queryKey: ugsQueryKeys.stats() });
			} catch (error) {
				log.error('Generation stream error:', error as unknown as string);
				if (isAxiosError(error)) {
					const detail =
						(error.response?.data as { detail?: string } | undefined)?.detail ||
						t('toast.generationStartFailed');
					toast.error(detail);
				} else {
					toast.error(t('toast.generationStartFailed'));
				}
			} finally {
				setGenerating(null);
			}
		},
		[closeGenerationModal, queryClient, t, toast, userId]
	);

	return {
		generating,
		showGenerationModal,
		selectedTypeForGeneration,
		customInputData,
		openGenerationModal,
		closeGenerationModal,
		startGeneration,
	};
}
