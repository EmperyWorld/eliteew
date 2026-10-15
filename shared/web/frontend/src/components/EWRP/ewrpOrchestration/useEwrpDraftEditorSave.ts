/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP draft editor save pipeline, editor-local hotkeys, and autosave debounce.
 *
 * Related:
 * - `useEwrpDraftEditor.ts`, `ewrpMergeSaveSlidesStatus.ts`
 */

import { useCallback, useEffect } from 'react';
import { notify } from '@/notifications';
import {
	ewrpApi,
	type EwrpSlide,
	type EwrpStatusResponse,
} from '@/services/ewrpApi';
import { parseEwrpStatusResponse } from '../EwrpGeneratorChunks';
import { mergeEwrpSaveSlidesStatus } from '../ewrpMergeSaveSlidesStatus';
import {
	clearEwrpLocalDraft,
	writeEwrpLocalDraft,
} from './ewrpLocalDraftStorage';

export type UseEwrpDraftEditorSaveParams = {
	t: (key: string, opts?: Record<string, unknown>) => string;
	jobId: string | null;
	status: EwrpStatusResponse | null;
	setStatus: React.Dispatch<React.SetStateAction<EwrpStatusResponse | null>>;
	draftSlides: EwrpSlide[] | null;
	setDraftSlides: React.Dispatch<React.SetStateAction<EwrpSlide[] | null>>;
	isEditing: boolean;
	setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
	setSaving: React.Dispatch<React.SetStateAction<boolean>>;
	setSaveMultiUgsConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
	setSlideEditorSearch: React.Dispatch<React.SetStateAction<string>>;
	setPdfPresentationOpen: React.Dispatch<React.SetStateAction<boolean>>;
	slideRebuildInProgress: boolean;
	showSlideEditorPanel: boolean;
	expectPdfRebuildToastRef: React.MutableRefObject<boolean>;
	pollStatus: (id: string) => Promise<void>;
	refreshHistory: () => Promise<void>;
	goToAdjacentDraftSlide: (direction: -1 | 1) => void;
};

export function useEwrpDraftEditorSave(params: UseEwrpDraftEditorSaveParams) {
	const {
		t,
		jobId,
		status,
		setStatus,
		draftSlides,
		setDraftSlides,
		isEditing,
		setIsEditing,
		setSaving,
		setSaveMultiUgsConfirmOpen,
		setSlideEditorSearch,
		setPdfPresentationOpen,
		slideRebuildInProgress,
		showSlideEditorPanel,
		expectPdfRebuildToastRef,
		pollStatus,
		refreshHistory,
		goToAdjacentDraftSlide,
	} = params;

	const runSaveSlides = useCallback(async () => {
		if (!jobId || !draftSlides || !status) return;
		if (slideRebuildInProgress) {
			notify.error(t('notify.waitForRebuild'), t('notify.waitForRebuildSub'));
			return;
		}
		setSaveMultiUgsConfirmOpen(false);
		try {
			setSaving(true);
			const cleaned: EwrpSlide[] = draftSlides.map((s, idx) => {
				const slideTitleLine = (
					s.title || t('draft.slideFallback', { n: idx + 1 })
				).trim();
				const bullets = (s.bullets || [])
					.map((b) =>
						typeof b === 'string'
							? b.replace(/\s+/g, ' ').trim()
							: String(b ?? '')
									.replace(/\s+/g, ' ')
									.trim()
					)
					.filter(Boolean);
				const row: EwrpSlide = {
					title: slideTitleLine,
					bullets,
					image_filename: s.image_filename ?? null,
					image_prompt: s.image_prompt ?? null,
				};
				if (idx > 0) {
					row.layout = typeof s.layout === 'string' ? s.layout.trim() : '';
				}
				return row;
			});
			const putRes = await ewrpApi.updateSlides(jobId, cleaned);
			const updated = parseEwrpStatusResponse(putRes);
			expectPdfRebuildToastRef.current = true;
			setPdfPresentationOpen(false);
			notify.success(t('notify.savedTitle'), t('notify.savedSubtitle'));
			const merged = mergeEwrpSaveSlidesStatus(updated, cleaned);
			if (merged.kind === 'generating_images') {
				setStatus(merged.merged);
			} else if (merged.kind === 'building_pdf') {
				setStatus(merged.merged);
			} else {
				setStatus((prev) =>
					prev
						? {
								...prev,
								status: 'building_pdf',
								progress: Math.max(prev.progress, 60),
								pdf_url: null,
								slides: cleaned,
							}
						: prev
				);
			}
			clearEwrpLocalDraft(jobId);
			setSlideEditorSearch('');
			setIsEditing(false);
			setDraftSlides(null);
			void pollStatus(jobId);
			void refreshHistory();
		} catch (e: unknown) {
			const msg =
				(e as { message?: string })?.message ||
				(e as { response?: { data?: { detail?: string } } })?.response?.data
					?.detail ||
				t('notify.saveSlidesFailed');
			notify.error(t('notify.saveSlidesError'), String(msg), {
				toastAction: {
					label: t('notify.retrySave'),
					onClick: () => {
						void runSaveSlides();
					},
				},
			});
		} finally {
			setSaving(false);
		}
	}, [
		jobId,
		draftSlides,
		status,
		slideRebuildInProgress,
		t,
		setSaveMultiUgsConfirmOpen,
		setSaving,
		setPdfPresentationOpen,
		setStatus,
		setSlideEditorSearch,
		setIsEditing,
		setDraftSlides,
		expectPdfRebuildToastRef,
		pollStatus,
		refreshHistory,
	]);

	const handleSaveSlides = useCallback(() => {
		if (!jobId || !draftSlides || !status) return;
		if (slideRebuildInProgress) {
			notify.error(t('notify.waitForRebuild'), t('notify.waitForRebuildSub'));
			return;
		}
		const nMissing = draftSlides.filter((s) => !s.image_filename).length;
		if (nMissing > 1) {
			setSaveMultiUgsConfirmOpen(true);
			return;
		}
		void runSaveSlides();
	}, [
		jobId,
		draftSlides,
		status,
		slideRebuildInProgress,
		t,
		setSaveMultiUgsConfirmOpen,
		runSaveSlides,
	]);

	useEffect(() => {
		if (!showSlideEditorPanel) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey) {
				if (e.key.toLowerCase() === 's') {
					e.preventDefault();
					handleSaveSlides();
				}
				return;
			}
			if (!e.altKey || e.shiftKey) return;
			if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
				e.preventDefault();
				goToAdjacentDraftSlide(-1);
			} else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
				e.preventDefault();
				goToAdjacentDraftSlide(1);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [showSlideEditorPanel, handleSaveSlides, goToAdjacentDraftSlide]);

	useEffect(() => {
		if (!isEditing || !draftSlides || !jobId) return;
		const tid = window.setTimeout(() => {
			writeEwrpLocalDraft(jobId, draftSlides);
		}, 800);
		return () => window.clearTimeout(tid);
	}, [isEditing, draftSlides, jobId]);

	return { runSaveSlides, handleSaveSlides };
}
