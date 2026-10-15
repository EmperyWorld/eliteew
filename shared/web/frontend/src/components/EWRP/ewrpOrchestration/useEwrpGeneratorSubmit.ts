/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP generation form submit with idempotency key and energy pre-check.
 *
 * Invariants:
 * - Each submit uses a fresh `createEwrpIdempotencyKey()` — no double-charge on retry.
 *
 * Related:
 * - `useEwrpGeneratorCompose.tsx`, `ewrpIdempotency.ts`, `ewrpWebSearchQuality.ts`
 */

import type * as React from 'react';
import { useCallback } from 'react';
import { notify } from '@/notifications';
import type { ContentItem } from '../EwrpGeneratorChunks';
import { EWRP_RESTORE_KEY } from '../EwrpGeneratorChunks';
import { ewrpApi, type EwrpStatusResponse } from '@/services/ewrpApi';
import { reportProfessionalCrossAppDraftLifecycle } from '@/features/professional-worlds/desktop/reportProfessionalCrossAppDraftLifecycle';
import { notifyEwrpHttpError } from '../ewrpHttpErrors';
import { createEwrpIdempotencyKey } from '../ewrpIdempotency';
import {
	type EwrpWebSearchQuality,
	ewrpWebSearchApiFields,
} from '../ewrpWebSearchQuality';

export type UseEwrpGeneratorSubmitParams = {
	topic: string;
	title: string;
	numSlides: number;
	presentationTheme: string;
	firstSlideStyle?: string;
	webSearchQuality: EwrpWebSearchQuality;
	extraContext: string;
	sourceDocument: ContentItem | null;
	insufficientEnergy: boolean;
	presentationEnergyCost: number;
	ugsAvailableCredits: number | null;
	submitting: boolean;
	setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
	setJobId: React.Dispatch<React.SetStateAction<string | null>>;
	setMainTab: React.Dispatch<
		React.SetStateAction<'generate' | 'presentations'>
	>;
	setStatus: React.Dispatch<React.SetStateAction<EwrpStatusResponse | null>>;
	pwCrossAppLinkIdRef: React.MutableRefObject<string | null>;
	refreshHistory: () => Promise<void>;
	t: (key: string, opts?: Record<string, unknown>) => string;
};

export function useEwrpGeneratorSubmit(params: UseEwrpGeneratorSubmitParams) {
	const {
		topic,
		title,
		numSlides,
		presentationTheme,
		firstSlideStyle = 'standard',
		webSearchQuality,
		extraContext,
		sourceDocument,
		insufficientEnergy,
		presentationEnergyCost,
		ugsAvailableCredits,
		setSubmitting,
		setJobId,
		setMainTab,
		setStatus,
		pwCrossAppLinkIdRef,
		refreshHistory,
		t,
	} = params;

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!topic.trim()) {
				notify.error(t('notify.topicRequired'));
				return;
			}
			if (insufficientEnergy) {
				notify.error(
					t('notify.insufficientEnergy'),
					t('energy.insufficientBalance', {
						required: presentationEnergyCost,
						available: ugsAvailableCredits ?? 0,
					})
				);
				return;
			}
			setSubmitting(true);
			try {
				const res = await ewrpApi.create(
					{
						topic: topic.trim(),
						title: title.trim() || undefined,
						num_slides: numSlides,
						extra_context: extraContext.trim() || undefined,
						source_content_id: sourceDocument?.id,
						presentation_theme: presentationTheme.trim() || undefined,
						first_slide_style: firstSlideStyle.trim() || 'standard',
						...ewrpWebSearchApiFields(webSearchQuality),
					},
					{ idempotencyKey: createEwrpIdempotencyKey() }
				);
				const data = res.data;
				setJobId(data.id);
				setMainTab('presentations');
				window.localStorage.setItem(EWRP_RESTORE_KEY, data.id);
				setStatus({
					id: data.id,
					status: 'queued',
					progress: 0,
					error_message: null,
					pdf_url: null,
				});
				if (pwCrossAppLinkIdRef.current) {
					reportProfessionalCrossAppDraftLifecycle(
						pwCrossAppLinkIdRef.current,
						'updated',
						{ ewrp_job_id: data.id }
					);
				}
				notify.success(t('notify.generationStarted'));
				void refreshHistory();
			} catch (err: unknown) {
				notifyEwrpHttpError(err, t('notify.startGenerationFailed'), notify, t);
			} finally {
				setSubmitting(false);
			}
		},
		[
			topic,
			title,
			numSlides,
			presentationTheme,
			firstSlideStyle,
			webSearchQuality,
			extraContext,
			sourceDocument,
			insufficientEnergy,
			presentationEnergyCost,
			ugsAvailableCredits,
			setSubmitting,
			setJobId,
			setMainTab,
			setStatus,
			pwCrossAppLinkIdRef,
			refreshHistory,
			t,
		]
	);

	return { handleSubmit };
}
