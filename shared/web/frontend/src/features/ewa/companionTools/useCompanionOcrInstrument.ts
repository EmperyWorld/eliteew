/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companion image OCR instrument flow extracted from chat panel (U8.1 extract).
 *
 * Invariants:
 * - OCR posts a dedicated turn; does not invent desktop side-effects locally.
 * - Profile-not-initialized errors reset via injected handler without generic OCR toast.
 *
 * Related:
 * - src/features/ewa/companionTools/companionOcrInstrument.ts
 */

import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useRef,
	useState,
} from 'react';
import type { TFunction } from 'i18next';

import {
	formatCompanionOcrUserLine,
	isCompanionOcrImageFile,
	performCompanionImageOcrFromContent,
	performCompanionImageOcrFromLocalFile,
	postCompanionOcrTurn,
	type CompanionOcrClientResult,
} from '@/features/ewa/companionTools/companionOcrInstrument';
import type { Content } from '@/components/UnifiedContent/types';
import type { CompanionChatMessageRow } from '@/services/ewa/ewaCompanionChatApi';

export type UseCompanionOcrInstrumentOptions = {
	setPending: Dispatch<SetStateAction<boolean>>;
	setPendingTurn: Dispatch<SetStateAction<CompanionChatMessageRow[] | null>>;
	speakCompanionReply: (reply: string) => void;
	onCompanionRevision?: (revision: number) => void;
	handleCompanionChatProfileError: (err: unknown) => boolean;
	notifyError: (message: string) => void;
	t: TFunction<'marketing'>;
};

export function useCompanionOcrInstrument({
	setPending,
	setPendingTurn,
	speakCompanionReply,
	onCompanionRevision,
	handleCompanionChatProfileError,
	notifyError,
	t,
}: UseCompanionOcrInstrumentOptions) {
	const [ocrSourceOpen, setOcrSourceOpen] = useState(false);
	const [ocrContentPickerOpen, setOcrContentPickerOpen] = useState(false);
	const [ocrBusy, setOcrBusy] = useState(false);
	const ocrFileInputRef = useRef<HTMLInputElement | null>(null);

	const finishCompanionOcrTurn = useCallback(
		async (client: CompanionOcrClientResult) => {
			setOcrBusy(true);
			setPending(true);
			setOcrSourceOpen(false);
			setOcrContentPickerOpen(false);
			try {
				const out = await postCompanionOcrTurn({
					filename: client.filename,
					ocr_text: client.text,
					confidence: client.confidence,
					source: client.source,
					unified_content_id: client.unifiedContentId,
				});
				setPendingTurn([
					{
						role: 'user',
						content: formatCompanionOcrUserLine(client.filename, client.source),
					},
					{ role: 'assistant', content: out.reply },
				]);
				speakCompanionReply(out.reply);
				onCompanionRevision?.(out.companion_revision);
			} catch (err) {
				if (!handleCompanionChatProfileError(err)) {
					const code = err instanceof Error ? err.message.trim() : 'ocr_failed';
					if (code === 'companion_ocr_images_only') {
						notifyError(t('ewaCompanion.ocrSource.imagesOnly'));
					} else if (code === 'ocr_empty_text') {
						notifyError(t('ewaCompanion.ocrSource.empty'));
					} else {
						notifyError(t('ewaCompanion.ocrSource.failed'));
					}
				}
			} finally {
				setOcrBusy(false);
				setPending(false);
			}
		},
		[
			handleCompanionChatProfileError,
			notifyError,
			onCompanionRevision,
			setPending,
			setPendingTurn,
			speakCompanionReply,
			t,
		]
	);

	const handleOcrLocalFileSelected = useCallback(
		(file: File) => {
			if (!isCompanionOcrImageFile(file)) {
				notifyError(t('ewaCompanion.ocrSource.imagesOnly'));
				return;
			}
			void (async () => {
				try {
					const client = await performCompanionImageOcrFromLocalFile(file);
					await finishCompanionOcrTurn(client);
				} catch (err) {
					if (!handleCompanionChatProfileError(err)) {
						const code =
							err instanceof Error ? err.message.trim() : 'ocr_failed';
						if (code === 'companion_ocr_images_only') {
							notifyError(t('ewaCompanion.ocrSource.imagesOnly'));
						} else if (code === 'ocr_empty_text') {
							notifyError(t('ewaCompanion.ocrSource.empty'));
						} else {
							notifyError(t('ewaCompanion.ocrSource.failed'));
						}
					}
				}
			})();
		},
		[finishCompanionOcrTurn, handleCompanionChatProfileError, notifyError, t]
	);

	const handleOcrContentPicked = useCallback(
		(items: Content[]) => {
			const item = items[0];
			if (!item) return;
			setOcrContentPickerOpen(false);
			void (async () => {
				try {
					const client = await performCompanionImageOcrFromContent(item);
					await finishCompanionOcrTurn(client);
				} catch (err) {
					if (!handleCompanionChatProfileError(err)) {
						const code =
							err instanceof Error ? err.message.trim() : 'ocr_failed';
						if (code === 'companion_ocr_images_only') {
							notifyError(t('ewaCompanion.ocrSource.imagesOnly'));
						} else if (code === 'ocr_empty_text') {
							notifyError(t('ewaCompanion.ocrSource.empty'));
						} else {
							notifyError(t('ewaCompanion.ocrSource.failed'));
						}
					}
				}
			})();
		},
		[finishCompanionOcrTurn, handleCompanionChatProfileError, notifyError, t]
	);

	return {
		ocrSourceOpen,
		setOcrSourceOpen,
		ocrContentPickerOpen,
		setOcrContentPickerOpen,
		ocrBusy,
		ocrFileInputRef,
		handleOcrLocalFileSelected,
		handleOcrContentPicked,
	};
}
