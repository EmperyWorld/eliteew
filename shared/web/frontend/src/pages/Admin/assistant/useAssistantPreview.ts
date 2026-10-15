/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Preview prompt state, mutation, and FAQ→preview bridge for assistant admin.
 *
 * Invariants:
 * - Preview runs only when question is non-empty and not already pending.
 *
 * Related:
 * - pages/Admin/assistant/AssistantPreviewPanel.tsx
 * - pages/Admin/assistant/AssistantFaqPanel.tsx
 */
import { useMutation } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	adminPreviewAssistantPrompt,
	type AssistantPreviewResult,
} from '../../Desktop/services/productDesktopApi';

export function useAssistantPreview() {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });

	const [previewQuestion, setPreviewQuestion] = React.useState('');
	const [previewIncludeMyHistory, setPreviewIncludeMyHistory] =
		React.useState(false);
	const previewPanelRef = React.useRef<HTMLDivElement | null>(null);
	const [previewResult, setPreviewResult] =
		React.useState<AssistantPreviewResult | null>(null);

	const previewMut = useMutation({
		mutationFn: () =>
			adminPreviewAssistantPrompt({
				message: previewQuestion.trim(),
				include_my_history: previewIncludeMyHistory,
			}),
		onSuccess: (data) => {
			setPreviewResult(data);
			toast.success(t('toastPreviewReady'));
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const fillPreviewFromFaq = React.useCallback(
		(question: string) => {
			setPreviewQuestion(question.trim());
			toast.success(t('previewQuestionFilled'));
			window.requestAnimationFrame(() => {
				previewPanelRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
				});
			});
		},
		[t]
	);

	const runPreview = React.useCallback(() => {
		if (!previewQuestion.trim() || previewMut.isPending) return;
		previewMut.mutate();
	}, [previewMut, previewQuestion]);

	const copyPreviewPrompt = React.useCallback(async () => {
		const text =
			previewResult?.prompt_full?.trim() ||
			previewResult?.prompt_preview?.trim();
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			toast.success(t('previewCopyDone'));
		} catch {
			toast.error(t('toastError'));
		}
	}, [previewResult, t]);

	return {
		previewQuestion,
		setPreviewQuestion,
		previewIncludeMyHistory,
		setPreviewIncludeMyHistory,
		previewResult,
		previewPanelRef,
		fillPreviewFromFaq,
		runPreview,
		copyPreviewPrompt,
		isPreviewPending: previewMut.isPending,
	};
}
