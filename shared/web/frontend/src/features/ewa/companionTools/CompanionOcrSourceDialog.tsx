/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source picker for companion OCR instrument: local file or Unified Content (images only).
 *
 * Invariants:
 * - Hidden file input accepts images only; content picker filters to image type.
 * - Parent owns OCR execution and transcript persist.
 *
 * Related:
 * - src/features/ewa/companionTools/companionOcrInstrument.ts
 */

import { ComputerDesktopIcon, FolderIcon } from '@heroicons/react/24/outline';
import { type RefObject, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { UnifiedContentPickerModal } from '@/components/UnifiedContent/picker/UnifiedContentPickerModal';
import type { Content } from '@/components/UnifiedContent/types';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { ContentType } from '@/types/fileExchange';
import { cn } from '@/utils/cn';

export type CompanionOcrSourceDialogProps = {
	open: boolean;
	busy: boolean;
	fileInputRef: RefObject<HTMLInputElement | null>;
	contentPickerOpen: boolean;
	onClose: () => void;
	onPickLocal: () => void;
	onPickContentManager: () => void;
	onLocalFileSelected: (file: File) => void;
	onContentPicked: (items: Content[]) => void;
	onContentPickerClose: () => void;
};

export function CompanionOcrSourceDialog({
	open,
	busy,
	fileInputRef,
	contentPickerOpen,
	onClose,
	onPickLocal,
	onPickContentManager,
	onLocalFileSelected,
	onContentPicked,
	onContentPickerClose,
}: CompanionOcrSourceDialogProps) {
	const { t } = useTranslation('marketing');
	const titleId = useId();
	const localInputRef = useRef<HTMLInputElement | null>(null);

	if (!open && !contentPickerOpen) return null;

	return (
		<>
			{open ? (
				<div
					className="absolute inset-0 z-20 flex items-end justify-center bg-black/20 p-3 backdrop-blur-[2px] sm:items-center"
					data-testid="ewa-companion-ocr-source-dialog"
				>
					<div
						className={cn(
							'w-full max-w-sm rounded-(--desktop-radius-frame)',
							'border border-(--desktop-border-subtle) bg-(--desktop-surface-base)',
							'p-4 shadow-2xl'
						)}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
					>
						<h2
							id={titleId}
							className={cn(
								DESKTOP_TYPOGRAPHY.subtitle,
								'text-(--desktop-text-primary)'
							)}
						>
							{t('ewaCompanion.ocrSource.title')}
						</h2>
						<p className="mt-1 text-[12px] text-(--companion-text-soft)">
							{t('ewaCompanion.ocrSource.hint')}
						</p>
						<div className="mt-4 flex flex-col gap-2">
							<DesktopAppButton
								type="button"
								variant="accent"
								size="sm"
								disabled={busy}
								className="justify-start gap-2"
								onClick={onPickLocal}
							>
								<ComputerDesktopIcon className="size-4 shrink-0" aria-hidden />
								{t('ewaCompanion.ocrSource.fromComputer')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								disabled={busy}
								className="justify-start gap-2"
								onClick={onPickContentManager}
							>
								<FolderIcon className="size-4 shrink-0" aria-hidden />
								{t('ewaCompanion.ocrSource.fromContentManager')}
							</DesktopAppButton>
						</div>
						<div className="mt-4 flex justify-end">
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								disabled={busy}
								onClick={onClose}
							>
								{t('ewaCompanion.quickPresetDialogCancel')}
							</DesktopAppButton>
						</div>
					</div>
					<input
						ref={(node) => {
							localInputRef.current = node;
							if (fileInputRef && 'current' in fileInputRef) {
								(fileInputRef as { current: HTMLInputElement | null }).current =
									node;
							}
						}}
						type="file"
						accept="image/*"
						className="hidden"
						disabled={busy}
						onChange={(event) => {
							const file = event.target.files?.[0];
							event.target.value = '';
							if (!file) return;
							onLocalFileSelected(file);
						}}
					/>
				</div>
			) : null}
			<UnifiedContentPickerModal
				open={contentPickerOpen}
				onClose={onContentPickerClose}
				onConfirm={onContentPicked}
				mode="single"
				maxFiles={1}
				allowedContentTypes={[ContentType.IMAGE]}
				title={t('ewaCompanion.ocrSource.contentPickerTitle')}
			/>
		</>
	);
}
