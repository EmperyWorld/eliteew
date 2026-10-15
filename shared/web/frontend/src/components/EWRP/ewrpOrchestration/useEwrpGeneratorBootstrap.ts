/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bootstrap effects for EWRP compose: PW draft hydrate, job restore, companion listing, status source.
 *
 * Related:
 * - `useEwrpGeneratorCompose.tsx`
 */

import { useEffect } from 'react';
import { notify } from '@/notifications';
import { contentApi } from '@/services/contentApi';
import type { WindowInitialPayload } from '@/pages/Desktop/types/desktop.types';
import { reportProfessionalCrossAppDraftLifecycle } from '@/features/professional-worlds/desktop/reportProfessionalCrossAppDraftLifecycle';
import type { EwrpJobListItem, EwrpStatusResponse } from '@/services/ewrpApi';
import { EWRP_RESTORE_KEY, type ContentItem } from '../EwrpGeneratorChunks';
import { consumeEwrpProfessionalWorldsDraft } from '../ewrpProfessionalWorldsDraft';
import { buildEwrpCompanionListingPlainText } from './ewrpCompanionListing';

export type UseEwrpGeneratorBootstrapParams = {
	emitCompanionListing?: (patch: WindowInitialPayload) => void;
	crossAppDraftKey?: string;
	companionEwrpJobId?: string;
	t: (key: string, opts?: Record<string, unknown>) => string;
	jobId: string | null;
	status: EwrpStatusResponse | null;
	docItems: ContentItem[];
	mainTab: 'generate' | 'presentations';
	historyLoading: boolean;
	historyJobs: EwrpJobListItem[];
	historyHasMore: boolean;
	filteredHistoryJobs: EwrpJobListItem[];
	filteredDocItems: ContentItem[];
	deferredDocSearch: string;
	setTopic: React.Dispatch<React.SetStateAction<string>>;
	setTitle: React.Dispatch<React.SetStateAction<string>>;
	setExtraContext: React.Dispatch<React.SetStateAction<string>>;
	setMainTab: React.Dispatch<
		React.SetStateAction<'generate' | 'presentations'>
	>;
	setSourceDocument: React.Dispatch<React.SetStateAction<ContentItem | null>>;
	setSourceDocumentLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setJobId: React.Dispatch<React.SetStateAction<string | null>>;
	setStatusSourceLabel: React.Dispatch<React.SetStateAction<string | null>>;
	setStatusSourceLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setEditorOnboardingDismissed: React.Dispatch<React.SetStateAction<boolean>>;
	setJobIdExpanded: React.Dispatch<React.SetStateAction<boolean>>;
	setStatusPollError: React.Dispatch<React.SetStateAction<string | null>>;
	setJobIdCopied: React.Dispatch<React.SetStateAction<boolean>>;
	statusRef: React.MutableRefObject<EwrpStatusResponse | null>;
	expectPdfRebuildToastRef: React.MutableRefObject<boolean>;
	pwDraftHydratedKeyRef: React.MutableRefObject<string | null>;
	pwCrossAppLinkIdRef: React.MutableRefObject<string | null>;
	pwPublishedReportSigRef: React.MutableRefObject<string | null>;
	docItemsPrefetchLoading: boolean;
	statusSourceLabel: string | null;
	statusSourceLoading: boolean;
};

export function useEwrpGeneratorBootstrap(
	params: UseEwrpGeneratorBootstrapParams
) {
	const {
		emitCompanionListing,
		crossAppDraftKey,
		companionEwrpJobId,
		t,
		jobId,
		status,
		docItems,
		mainTab,
		historyLoading,
		historyJobs,
		historyHasMore,
		filteredHistoryJobs,
		filteredDocItems,
		deferredDocSearch,
		setTopic,
		setTitle,
		setExtraContext,
		setMainTab,
		setSourceDocument,
		setSourceDocumentLoading,
		setJobId,
		setStatusSourceLabel,
		setStatusSourceLoading,
		setEditorOnboardingDismissed,
		setJobIdExpanded,
		setStatusPollError,
		setJobIdCopied,
		statusRef,
		expectPdfRebuildToastRef,
		pwDraftHydratedKeyRef,
		pwCrossAppLinkIdRef,
		pwPublishedReportSigRef,
		docItemsPrefetchLoading,
		statusSourceLabel,
		statusSourceLoading,
	} = params;

	useEffect(() => {
		const key = (crossAppDraftKey ?? '').trim();
		if (!key || pwDraftHydratedKeyRef.current === key) return;
		const draft = consumeEwrpProfessionalWorldsDraft(key);
		if (!draft) return;
		pwDraftHydratedKeyRef.current = key;
		if (draft.crossAppLinkId) {
			pwCrossAppLinkIdRef.current = draft.crossAppLinkId;
			reportProfessionalCrossAppDraftLifecycle(draft.crossAppLinkId, 'opened');
		}
		setTopic(draft.topic);
		setTitle(draft.title);
		setExtraContext(draft.extraContext);
		setMainTab('generate');
		if (draft.sourceUnifiedContentId) {
			const sourceId = draft.sourceUnifiedContentId;
			setSourceDocumentLoading(true);
			void (async () => {
				try {
					const c = await contentApi.getContent(sourceId);
					setSourceDocument({
						id: c.id,
						name: c.name,
						content_type: c.content_type,
						created_at: c.created_at,
					});
				} catch {
					setSourceDocument(null);
					notify.error(t('notify.sourceFileUnavailable'));
				} finally {
					setSourceDocumentLoading(false);
				}
			})();
		} else {
			setSourceDocument(null);
			setSourceDocumentLoading(false);
		}
		notify.success(t('notify.pwDraftApplied'));
	}, [
		crossAppDraftKey,
		t,
		setTopic,
		setTitle,
		setExtraContext,
		setMainTab,
		setSourceDocument,
		setSourceDocumentLoading,
		pwDraftHydratedKeyRef,
		pwCrossAppLinkIdRef,
	]);

	useEffect(() => {
		try {
			setEditorOnboardingDismissed(
				localStorage.getItem('ewrp-editor-onboarding-v1') === '1'
			);
		} catch {
			setEditorOnboardingDismissed(true);
		}
	}, [setEditorOnboardingDismissed]);

	useEffect(() => {
		statusRef.current = status;
	}, [status, statusRef]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: collapse ID when active job changes
	useEffect(() => {
		setJobIdExpanded(false);
	}, [jobId, setJobIdExpanded]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset poll error when active job changes
	useEffect(() => {
		setStatusPollError(null);
	}, [jobId, setStatusPollError]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset copied when active job changes
	useEffect(() => {
		setJobIdCopied(false);
	}, [jobId, setJobIdCopied]);

	useEffect(() => {
		const sourceId = status?.source_content_id;
		if (!sourceId) {
			setStatusSourceLabel(null);
			setStatusSourceLoading(false);
			return;
		}
		const cached = docItems.find((item) => item.id === sourceId)?.name;
		if (cached) {
			setStatusSourceLabel(cached);
			setStatusSourceLoading(false);
			return;
		}
		setStatusSourceLoading(true);
		let cancelled = false;
		void contentApi
			.getContent(String(sourceId))
			.then((content) => {
				if (!cancelled) setStatusSourceLabel(content.name);
			})
			.catch(() => {
				if (!cancelled) setStatusSourceLabel(null);
			})
			.finally(() => {
				if (!cancelled) setStatusSourceLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [
		status?.source_content_id,
		docItems,
		setStatusSourceLabel,
		setStatusSourceLoading,
	]);

	useEffect(() => {
		const restoredJobId = window.localStorage.getItem(EWRP_RESTORE_KEY);
		if (restoredJobId) {
			setJobId(restoredJobId);
			setMainTab('presentations');
		}
	}, [setJobId, setMainTab]);

	useEffect(() => {
		const next = (companionEwrpJobId ?? '').trim();
		if (!next) return;
		setJobId(next);
		setMainTab('presentations');
		window.localStorage.setItem(EWRP_RESTORE_KEY, next);
	}, [companionEwrpJobId, setJobId, setMainTab]);

	useEffect(() => {
		if (status?.status === 'failed') {
			expectPdfRebuildToastRef.current = false;
		}
	}, [status?.status, expectPdfRebuildToastRef]);

	useEffect(() => {
		if (status?.status !== 'completed' || !jobId) return;
		const linkId = pwCrossAppLinkIdRef.current;
		if (!linkId) return;
		const sig = `${linkId}:${jobId}`;
		if (pwPublishedReportSigRef.current === sig) return;
		pwPublishedReportSigRef.current = sig;
		reportProfessionalCrossAppDraftLifecycle(linkId, 'published', {
			ewrp_job_id: jobId,
		});
	}, [status?.status, jobId, pwCrossAppLinkIdRef, pwPublishedReportSigRef]);

	useEffect(() => {
		if (
			status?.status === 'completed' &&
			status.pdf_url &&
			expectPdfRebuildToastRef.current
		) {
			expectPdfRebuildToastRef.current = false;
			notify.success(
				t('notify.pdfUpdatedTitle'),
				t('notify.pdfUpdatedSubtitle')
			);
		}
	}, [status?.status, status?.pdf_url, t, expectPdfRebuildToastRef]);

	useEffect(() => {
		if (!emitCompanionListing) return;
		const tid = window.setTimeout(() => {
			const text = buildEwrpCompanionListingPlainText({
				mainTab,
				historyLoading,
				historyJobsLength: historyJobs.length,
				historyHasMore,
				filteredHistoryJobs,
				deferredDocSearch,
				filteredDocItems,
				docItemsLength: docItems.length,
			});
			emitCompanionListing({ companionListingPlain: text });
		}, 950);
		return () => window.clearTimeout(tid);
	}, [
		emitCompanionListing,
		mainTab,
		historyLoading,
		historyJobs.length,
		historyHasMore,
		filteredHistoryJobs,
		filteredDocItems,
		deferredDocSearch,
		docItems.length,
	]);

	return {
		statusSourcePending: Boolean(
			status?.source_content_id &&
				!statusSourceLabel &&
				(statusSourceLoading || docItemsPrefetchLoading)
		),
	};
}
