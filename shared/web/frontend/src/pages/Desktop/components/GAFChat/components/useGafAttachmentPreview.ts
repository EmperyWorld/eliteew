/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Preview state and open/close/copy helpers for GAF chat attachment modal
 * flows (PDF, video, text, office, and other blob-backed previews).
 *
 * Invariants:
 * - Preview object URLs are always revoked on close/unmount.
 *
 * Related:
 * - GafChatAttachmentBlock.tsx
 * - GafChatAttachmentPreviewModal.tsx
 * - gafAttachmentDownload.ts
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { safeCopyToClipboard } from '@/utils/clipboard';
import type { GafAttachmentPreviewKind } from '../gafChatAttachmentPreviewUtils';
import { downloadGafAttachmentBlob } from './gafAttachmentDownload';

/** Макс. символов в модалке предпросмотра текста (остальное — обрезка + копирование полного). */
export const TEXT_PREVIEW_MAX_CHARS = 400_000;

export function useGafAttachmentPreview({
	cid,
	kind,
	chatId,
	messageId,
	inlineImageBlobUrl,
	inlineVideoBlobUrl,
}: {
	cid: string | null | undefined;
	kind: GafAttachmentPreviewKind;
	chatId: string;
	messageId: string;
	inlineImageBlobUrl: string | null;
	inlineVideoBlobUrl: string | null;
}) {
	const { t } = useTranslation('gafChat');

	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewLoading, setPreviewLoading] = useState(false);
	/** PDF / видео / прочее — не картинки в пузыре (у картинок blob в {@link GafChatImageInline}). */
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	/** Текстовые вложения (.md, .txt, …): содержимое для модалки без object URL. */
	const [previewText, setPreviewText] = useState<string | null>(null);
	/** Полная длина исходного текста, если показана только часть. */
	const [previewTextTotalChars, setPreviewTextTotalChars] = useState<
		number | null
	>(null);
	const [copyFullBusy, setCopyFullBusy] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const previewUrlRef = useRef<string | null>(null);

	const revokePreview = useCallback(() => {
		if (previewUrlRef.current) {
			URL.revokeObjectURL(previewUrlRef.current);
			previewUrlRef.current = null;
		}
		setPreviewUrl(null);
		setPreviewText(null);
		setPreviewTextTotalChars(null);
		setPreviewError(null);
	}, []);

	useEffect(() => () => revokePreview(), [revokePreview]);

	const downloadAttachmentBlob = useCallback(async (): Promise<Blob> => {
		if (!cid) {
			throw new Error('GAF_ATTACHMENT_CONTENT_ID_MISSING');
		}
		return downloadGafAttachmentBlob({
			contentId: cid,
			chatId,
			messageId,
		});
	}, [cid, chatId, messageId]);

	const openPreview = useCallback(async () => {
		if (!cid) return;
		if (kind === 'image' || kind === 'sticker') {
			if (inlineImageBlobUrl) setPreviewOpen(true);
			return;
		}
		if (kind === 'video') {
			if (inlineVideoBlobUrl) setPreviewOpen(true);
			return;
		}
		setPreviewLoading(true);
		setPreviewError(null);
		try {
			const blob = await downloadAttachmentBlob();
			if (kind === 'text') {
				const text = await blob.text();
				const total = text.length;
				if (total > TEXT_PREVIEW_MAX_CHARS) {
					setPreviewText(text.slice(0, TEXT_PREVIEW_MAX_CHARS));
					setPreviewTextTotalChars(total);
				} else {
					setPreviewText(text);
					setPreviewTextTotalChars(null);
				}
				setPreviewOpen(true);
				return;
			}
			const url = URL.createObjectURL(blob);
			if (previewUrlRef.current) {
				URL.revokeObjectURL(previewUrlRef.current);
			}
			previewUrlRef.current = url;
			setPreviewUrl(url);
			setPreviewOpen(true);
		} catch {
			setPreviewError(t('attachmentPreviewFailed'));
		} finally {
			setPreviewLoading(false);
		}
	}, [
		cid,
		kind,
		inlineImageBlobUrl,
		inlineVideoBlobUrl,
		t,
		downloadAttachmentBlob,
	]);

	const closePreview = useCallback(() => {
		setPreviewOpen(false);
		revokePreview();
	}, [revokePreview]);

	const copyVisibleText = useCallback(() => {
		if (previewText == null) return;
		void safeCopyToClipboard(previewText);
	}, [previewText]);

	const copyFullTextFromServer = useCallback(async () => {
		if (!cid) return;
		setCopyFullBusy(true);
		try {
			const blob = await downloadAttachmentBlob();
			const text = await blob.text();
			await safeCopyToClipboard(text);
		} catch {
			// ignore
		} finally {
			setCopyFullBusy(false);
		}
	}, [cid, downloadAttachmentBlob]);

	const previewModalVisible =
		typeof document !== 'undefined' &&
		previewOpen &&
		(((kind === 'image' || kind === 'sticker') && inlineImageBlobUrl) ||
			(kind === 'video' && inlineVideoBlobUrl) ||
			previewUrl ||
			(kind === 'text' && previewText !== null));

	return {
		previewOpen,
		previewLoading,
		previewUrl,
		previewText,
		previewTextTotalChars,
		copyFullBusy,
		previewError,
		previewModalVisible,
		openPreview,
		closePreview,
		copyVisibleText,
		copyFullTextFromServer,
	};
}
