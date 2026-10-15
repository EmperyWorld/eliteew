/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Side preview panel for GAF Chat Content Manager library picker — thumbnail or type icon,
 * metadata, and updated-at line for the currently selected library item.
 *
 * Invariants:
 * - Empty selection shows libraryPickerPreviewEmpty copy only.
 * - Image/sticker previews use GafChatImageInline with Bearer auth, not raw thumbnail_url.
 *
 * Related:
 * - GafContentLibraryPickerPanel.tsx
 * - gafChatAttachmentPreviewUtils.ts
 */
import type { Content } from '@/components/UnifiedContent/types';
import { unifiedContentDisplayLabel } from '@/components/UnifiedContent/utils/contentDisplayLabel';
import { PickerContentTypeIcon } from '@/components/UnifiedContent/picker/pickerContentTypeUtils';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { ContentType } from '@/types/fileExchange';
import { formatFileSize } from '@/types/fileExchange';
import { cn } from '@/utils/cn';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { previewKind } from '../gafChatAttachmentPreviewUtils';
import { GafChatImageInline } from './GafChatImageInline';

export function formatPickerDate(iso: string, locale: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toLocaleString(locale, {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function GafContentLibraryPreview({
	item,
}: {
	item: Content | null;
}): ReactElement {
	const { t, i18n } = useTranslation('gafChat');
	if (!item) {
		return (
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.shellCopy13,
					'text-(--desktop-text-muted)'
				)}
			>
				{t('libraryPickerPreviewEmpty')}
			</p>
		);
	}
	const k = previewKind(item.mime_type, item.name, item.file_size);
	const showThumb = k === 'image' || k === 'sticker';
	const label = unifiedContentDisplayLabel(item);

	return (
		<div className="flex min-h-0 flex-col gap-3">
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.shellMeta10,
					'uppercase tracking-wide text-(--desktop-text-dim)'
				)}
			>
				{t('libraryPickerPreviewHeading')}
			</p>
			{showThumb ? (
				<div className="flex max-h-[min(44vh,360px)] min-h-[160px] items-center justify-center overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 p-2">
					<GafChatImageInline
						contentId={item.id}
						alt={label}
						className="max-h-full max-w-full object-contain"
					/>
				</div>
			) : (
				<div className="flex min-h-[160px] items-center justify-center rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50">
					<PickerContentTypeIcon
						contentType={
							k === 'video'
								? ContentType.VIDEO
								: k === 'audio'
									? ContentType.AUDIO
									: k === 'pdf' || k === 'text' || k === 'office'
										? ContentType.DOCUMENT
										: ContentType.OTHER
						}
					/>
				</div>
			)}
			<div className="min-w-0 space-y-1">
				<DesktopChromeTooltip content={label} placement="top" offsetExtra={4}>
					<p
						className={cn(
							'line-clamp-3 font-medium text-(--desktop-text-primary)',
							DESKTOP_TYPOGRAPHY.shellCopy13
						)}
					>
						{label}
					</p>
				</DesktopChromeTooltip>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.shellMeta10,
						'text-(--desktop-text-dim)'
					)}
				>
					{formatFileSize(item.file_size ?? 0)}
					{item.mime_type ? ` · ${item.mime_type}` : ''}
				</p>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.shellMeta10,
						'text-(--desktop-text-dim)'
					)}
				>
					{t('libraryPickerUpdatedAt', {
						date: formatPickerDate(item.updated_at, i18n.language),
					})}
				</p>
			</div>
		</div>
	);
}
