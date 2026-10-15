/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Download / GAF share / companion vision attach for generated operation images (U8.3 slice 11).
 *
 * Invariants:
 * - GAF share and vision attach require a non-empty ``unifiedContentId`` on the ready image row.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionOperationsPanel.tsx
 * - src/features/ewa/companionUx/CompanionMobileOperationsSheet.tsx
 */

import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useCallback,
} from 'react';
import type { TFunction } from 'i18next';

import type { OperationReadyImage } from '@/features/ewa/companionOperations/companionOperationsUi';
import {
	type PendingCompanionImage,
	readPendingCompanionImage,
} from '@/features/ewa/companionImageAttachment';
import { isCompanionVisionMimeType } from '@/features/ewa/companionVisionFormats';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { requestOpenDesktopApp } from '@/pages/Desktop/utils/desktopDeepLink';
import { contentApi } from '@/services/contentApi';

export type UseCompanionOperationImageActionsOptions = {
	ru: boolean;
	notifyError: (message: string) => void;
	t: TFunction<'marketing'>;
	updateDraft: (text: string) => void;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	setPendingImage: Dispatch<SetStateAction<PendingCompanionImage | null>>;
};

export function useCompanionOperationImageActions({
	ru,
	notifyError,
	t,
	updateDraft,
	inputRef,
	setPendingImage,
}: UseCompanionOperationImageActionsOptions) {
	const handleDownloadGeneratedImage = useCallback(
		async (ready: OperationReadyImage) => {
			const cid = ready.unifiedContentId.trim();
			try {
				if (cid) {
					await contentApi.downloadContent(cid, ready.downloadFilename);
					return;
				}
				const response = await fetch(ready.previewUrl);
				const blob = await response.blob();
				const url = URL.createObjectURL(blob);
				const anchor = document.createElement('a');
				anchor.href = url;
				anchor.download = ready.downloadFilename;
				anchor.click();
				URL.revokeObjectURL(url);
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_operations_image_download',
					'generated image download failed',
					err
				);
				notifyError(t('ewaCompanion.operationsImageDownloadFailed'));
			}
		},
		[notifyError, t]
	);

	const handleShareGeneratedImageToGaf = useCallback(
		(ready: OperationReadyImage) => {
			const cid = ready.unifiedContentId.trim();
			if (!cid) {
				notifyError(t('ewaCompanion.operationsImageShareGafUnavailable'));
				return;
			}
			requestOpenDesktopApp({
				appComponent: 'GAFChatApp',
				gafComposerAttachmentContentId: cid,
				gafComposerAttachmentFileName: ready.downloadFilename,
				gafComposerAttachmentMimeType: ready.mimeType ?? 'image/png',
			});
		},
		[notifyError, t]
	);

	const handleSendGeneratedImageToCompanion = useCallback(
		async (ready: OperationReadyImage) => {
			const cid = ready.unifiedContentId.trim();
			if (!cid) {
				notifyError(t('ewaCompanion.operationsImageAnalyzeUnavailable'));
				return;
			}
			try {
				const meta = await contentApi.getContent(cid);
				const mime = (meta.mime_type ?? ready.mimeType ?? '').trim();
				if (!isCompanionVisionMimeType(mime)) {
					notifyError(t('ewaCompanion.operationsImageAnalyzeUnsupported'));
					return;
				}
				const { blob } = await contentApi.downloadContentBlob(cid);
				const file = new File([blob], ready.downloadFilename, { type: mime });
				const next = await readPendingCompanionImage(file);
				setPendingImage((prev) => {
					if (prev?.previewUrl) {
						URL.revokeObjectURL(prev.previewUrl);
					}
					return next;
				});
				updateDraft(ru ? 'Что на этой картинке?' : 'What is in this image?');
				inputRef.current?.focus({ preventScroll: true });
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_operations_image_analyze',
					'attach generated image for analyze failed',
					err
				);
				notifyError(t('ewaCompanion.operationsImageAnalyzeFailed'));
			}
		},
		[inputRef, notifyError, ru, setPendingImage, t, updateDraft]
	);

	return {
		handleDownloadGeneratedImage,
		handleShareGeneratedImageToGaf,
		handleSendGeneratedImageToCompanion,
	};
}
