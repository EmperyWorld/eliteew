/**
 * Rich pending-attachment strip above the composer (thumbnail / type icon + meta).
 */
import { memo } from 'react';
import { MicrophoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DesktopAppButton } from '../../DesktopAppChrome';
import { GafChatDesktopIconTooltip } from '../gafChatDesktopIconTooltip';
import { formatGafBytes, previewKind } from '../gafChatAttachmentPreviewUtils';
import type { GafChatThreadPrefs } from '../gafChatThreadPrefs';
import { isGafVoiceAttachmentName } from '../gafVoiceConstants';
import { GafAttachmentKindIcon } from './GafAttachmentKindIcon';
import { GafChatImageInline } from './GafChatImageInline';
import { GafChatVideoInline } from './GafChatVideoInline';

export const GafChatComposerAttachmentPreview = memo(
	function GafChatComposerAttachmentPreview({
		contentId,
		fileName,
		size,
		mimeType,
		onRemove,
		disabled,
		mediaPrefs,
	}: {
		contentId: string;
		fileName: string;
		size: number | null;
		mimeType?: string | null;
		onRemove: () => void;
		disabled: boolean;
		mediaPrefs?: GafChatThreadPrefs | null;
	}): JSX.Element {
		const { t } = useTranslation('gafChat');
		const lucideStroke = DESKTOP_LUCIDE.stroke;
		const kind = previewKind(mimeType, fileName, size);
		const isVoice = isGafVoiceAttachmentName(fileName);
		const showPreview =
			mediaPrefs == null || mediaPrefs.showMediaPreview !== false;
		const loadOk = mediaPrefs == null || mediaPrefs.loadMedia !== false;
		const showThumb =
			!isVoice && (kind === 'image' || kind === 'sticker') && showPreview;
		const showVideoThumb = !isVoice && kind === 'video' && showPreview;
		const skipBlob = !loadOk;
		const voiceLabel = t('attachmentKindVoice');

		const kindLabel = isVoice
			? voiceLabel
			: kind === 'image'
				? t('attachmentKindImage')
				: kind === 'sticker'
					? t('attachmentKindSticker')
					: kind === 'pdf'
						? t('attachmentKindPdf')
						: kind === 'video'
							? t('attachmentKindVideo')
							: kind === 'audio'
								? t('attachmentKindAudio')
								: kind === 'archive'
									? t('attachmentKindArchive')
									: kind === 'office'
										? t('attachmentKindOffice')
										: kind === 'text'
											? t('attachmentKindText')
											: t('attachmentKindFile');

		return (
			<fieldset
				className={cn(
					'm-0 min-w-0 border-0 p-0',
					'flex flex-wrap items-stretch gap-3 rounded-xl border px-3 py-2.5',
					'border-[rgb(var(--desktop-accent-rgb)/0.38)] bg-[linear-gradient(165deg,rgb(var(--desktop-accent-rgb)/0.14),rgb(var(--desktop-accent-rgb)/0.04))]',
					'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.14)] backdrop-blur-[2px]'
				)}
				aria-label={t('composerAttachmentPreviewAria')}
			>
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{showThumb ? (
						<div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-elevated)/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
							<GafChatImageInline
								contentId={contentId}
								className="max-h-20! h-full! w-full! object-cover!"
								alt={fileName}
								skipDownload={skipBlob}
							/>
						</div>
					) : showVideoThumb ? (
						<div className="relative h-20 w-30 shrink-0 overflow-hidden rounded-xl border border-(--desktop-border-subtle)/60 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
							<GafChatVideoInline
								contentId={contentId}
								className="max-h-20! h-full! w-full! object-cover!"
								skipDownload={skipBlob}
							/>
						</div>
					) : (
						<div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-(--desktop-border-subtle)/65 bg-[color-mix(in_srgb,var(--desktop-surface-elevated)_88%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
							{isVoice ? (
								<MicrophoneIcon
									className="h-7 w-7 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.88)]"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
							) : (
								<GafAttachmentKindIcon kind={kind} size="lg" />
							)}
						</div>
					)}
					<div className="min-w-0 flex-1">
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.shellMeta10,
								'mb-0.5 font-semibold uppercase tracking-wide text-[rgb(var(--desktop-accent-rgb)/0.92)]'
							)}
						>
							{t('composerAttachmentReady')}
						</p>
						<p
							className={cn(
								'truncate font-medium text-(--desktop-text-primary) wrap-anywhere',
								DESKTOP_TYPOGRAPHY.body
							)}
						>
							{fileName}
						</p>
						<p className={cn('mt-0.5', DESKTOP_TYPOGRAPHY.meta)}>
							{kindLabel}
							{size != null ? ` · ${formatGafBytes(size)}` : ''}
						</p>
					</div>
				</div>
				<GafChatDesktopIconTooltip content={t('attachmentRemoveTitle')}>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="shrink-0 self-center"
						onClick={onRemove}
						disabled={disabled}
						aria-label={t('attachmentRemoveAria')}
					>
						<XMarkIcon
							className="h-4 w-4"
							aria-hidden
							strokeWidth={lucideStroke}
						/>
					</DesktopAppButton>
				</GafChatDesktopIconTooltip>
			</fieldset>
		);
	}
);
