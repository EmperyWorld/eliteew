/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render GAF message attachment card with inline media previews, modal preview
 * flows, and recipient accept action. Attachment bytes are resolved via
 * chat-scoped download endpoint for persisted messages.
 *
 * Invariants:
 * - Preview object URLs are always revoked on close/unmount.
 * - Incoming attachment accept action is available only for recipient messages.
 *
 * Related:
 * - GafChatInlineAudioPlayer.tsx
 * - useGafAttachmentPreview.ts
 * - GafChatAttachmentPreviewModal.tsx
 * - gafAttachmentDownload.ts
 * - gafChatDesktopIconTooltip.tsx
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { getDesktopPortalShellProps } from '@/pages/Desktop/utils/desktopUi';
import { cn } from '@/utils/cn';
import { DesktopAppButton } from '../../DesktopAppChrome';
import { formatGafBytes, previewKind } from '../gafChatAttachmentPreviewUtils';
import { isGafVoiceAttachmentName } from '../gafVoiceConstants';
import type { GafChatThreadPrefs } from '../gafChatThreadPrefs';
import type { GAFMessageItem } from '../types';
import { GafAttachmentKindIcon } from './GafAttachmentKindIcon';
import { GafChatAttachmentPreviewModal } from './GafChatAttachmentPreviewModal';
import { GafChatImageInline } from './GafChatImageInline';
import { GafChatInlineAudioPlayer } from './GafChatInlineAudioPlayer';
import { GafChatVideoInline } from './GafChatVideoInline';
import { GafChatVoiceMessagePlayer } from './GafChatVoiceMessagePlayer';
import { GafChatDesktopIconTooltip } from '../gafChatDesktopIconTooltip';
import { useGafAttachmentPreview } from './useGafAttachmentPreview';
import {
	ArrowPathIcon,
	ArrowsPointingOutIcon,
	CheckCircleIcon,
	EyeIcon,
} from '@heroicons/react/24/outline';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;

export function GafChatAttachmentBlock({
	msg,
	isMine,
	onAcceptAttachment,
	acceptBusyMessageId,
	mediaPrefs,
}: {
	msg: GAFMessageItem;
	isMine: boolean;
	onAcceptAttachment?: (m: GAFMessageItem) => void;
	acceptBusyMessageId?: string | null;
	/** Локальные настройки потока: превью и загрузка медиа. */
	mediaPrefs?: GafChatThreadPrefs | null;
}): JSX.Element | null {
	const { t } = useTranslation('gafChat');
	const { style: portalShellStyle, theme: portalTheme } =
		getDesktopPortalShellProps();
	const cid = msg.attachment_content_id;
	const mime = msg.attachment_mime_type ?? null;
	const name = msg.attachment_name ?? '';
	const kind = previewKind(mime, name, msg.attachment_size);
	const showPreview =
		mediaPrefs == null || mediaPrefs.showMediaPreview !== false;
	const loadMedia = mediaPrefs == null || mediaPrefs.loadMedia !== false;
	const skipBlob = !loadMedia;
	// MediaRecorder часто шлёт video/webm даже для голоса — не требуем kind === 'audio'.
	const isVoice = isGafVoiceAttachmentName(name);
	const showImageThumb = Boolean(
		cid && (kind === 'image' || kind === 'sticker') && showPreview
	);
	const showVideoThumb = Boolean(cid && kind === 'video' && showPreview);
	/** Музыка и прочие аудиофайлы — встроенный плеер, без модалки как у видео */
	const showInlineAudio = Boolean(cid && kind === 'audio' && showPreview);

	const [inlineImageBlobUrl, setInlineImageBlobUrl] = useState<string | null>(
		null
	);
	const [inlineVideoBlobUrl, setInlineVideoBlobUrl] = useState<string | null>(
		null
	);

	const {
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
	} = useGafAttachmentPreview({
		cid,
		kind,
		chatId: msg.chat_id,
		messageId: msg.id,
		inlineImageBlobUrl,
		inlineVideoBlobUrl,
	});

	if (!cid) return null;

	const shellClass = cn(
		'mb-2 overflow-hidden rounded-xl border shadow-sm ring-1 ring-inset',
		isMine
			? 'border-[rgb(var(--desktop-accent-rgb)/0.34)] bg-[linear-gradient(168deg,rgb(var(--desktop-accent-rgb)/0.16),rgb(var(--desktop-accent-rgb)/0.04))] ring-[rgb(var(--desktop-accent-rgb)/0.1)]'
			: 'border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-panel)_94%,transparent)] ring-(--desktop-border-subtle)/60'
	);

	if (isVoice) {
		return (
			<div className="mb-2 w-full max-w-[min(100%,min(380px,100vw))]">
				<GafChatVoiceMessagePlayer
					chatId={msg.chat_id}
					messageId={msg.id}
					fallbackContentId={cid}
					isMine={isMine}
					mimeHint={
						mime?.startsWith('audio/')
							? mime
							: mime === 'video/webm' || name.toLowerCase().endsWith('.webm')
								? 'audio/webm'
								: mime
					}
				/>
			</div>
		);
	}

	return (
		<div className={shellClass}>
			<div
				className={cn(
					'flex items-center gap-2 border-b px-3 py-2',
					isMine
						? 'border-[rgb(var(--desktop-accent-rgb)/0.2)] bg-[rgb(var(--desktop-accent-rgb)/0.06)]'
						: 'border-(--desktop-border-subtle)/70 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_80%,transparent)]'
				)}
			>
				<GafAttachmentKindIcon kind={kind} size="md" />
				<span
					className={cn(
						'min-w-0 flex-1 truncate',
						DESKTOP_TYPOGRAPHY.shellMeta10,
						'font-semibold uppercase tracking-[0.08em]',
						isMine
							? 'text-[rgb(var(--desktop-accent-rgb)/0.92)]'
							: 'text-(--desktop-text-muted)'
					)}
				>
					{isMine ? t('attachmentLabelOutgoing') : t('attachmentLabelIncoming')}
				</span>
				<span
					className={cn(
						'shrink-0 rounded-full border px-2 py-0.5',
						DESKTOP_TYPOGRAPHY.shellMeta10,
						isMine
							? 'border-[rgb(var(--desktop-accent-rgb)/0.38)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] text-(--desktop-text-secondary)'
							: 'border-(--desktop-border-subtle) bg-(--desktop-surface-app)/50 text-(--desktop-text-dim)'
					)}
				>
					{kind === 'image'
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
													: t('attachmentKindFile')}
				</span>
			</div>

			<div className="space-y-2 px-3 py-2.5">
				{showInlineAudio ? (
					skipBlob ? (
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-(--desktop-text-muted)'
							)}
						>
							{t('mediaLoadDisabled')}
						</p>
					) : (
						<GafChatInlineAudioPlayer
							chatId={msg.chat_id}
							messageId={msg.id}
							contentId={cid}
							mimeHint={mime}
							fileName={name}
						/>
					)
				) : null}

				<div
					className={cn(
						'flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1',
						DESKTOP_TYPOGRAPHY.shellCopy13
					)}
				>
					<GafAttachmentKindIcon kind={kind} className="mt-0.5" />
					<span className="min-w-0 flex-1 wrap-anywhere font-medium text-(--desktop-text-primary)">
						{name || t('attachmentFallbackName')}
					</span>
					{msg.attachment_size != null ? (
						<span className="ml-auto shrink-0 tabular-nums text-(--desktop-text-muted)">
							{formatGafBytes(msg.attachment_size)}
						</span>
					) : null}
					{kind !== 'audio' && !showImageThumb && !showVideoThumb ? (
						<GafChatDesktopIconTooltip content={t('attachmentPreview')}>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="shrink-0 touch-manipulation"
								disabled={previewLoading}
								onClick={() => void openPreview()}
								aria-label={t('attachmentPreviewAria')}
							>
								{previewLoading ? (
									<ArrowPathIcon
										className="h-4 w-4 animate-spin motion-reduce:animate-none"
										aria-hidden
										strokeWidth={LUCIDE_SW}
									/>
								) : (
									<EyeIcon
										className="h-4 w-4"
										aria-hidden
										strokeWidth={LUCIDE_SW}
									/>
								)}
							</DesktopAppButton>
						</GafChatDesktopIconTooltip>
					) : null}
				</div>

				{showImageThumb ? (
					<div className="space-y-2">
						<div className="w-full overflow-hidden rounded-xl border border-(--desktop-border-subtle)/55 bg-(--desktop-surface-elevated)/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-(--desktop-border-subtle)/40">
							<GafChatImageInline
								contentId={cid}
								chatId={msg.chat_id}
								messageId={msg.id}
								alt={name || t('attachmentFallbackName')}
								onBlobUrlReady={setInlineImageBlobUrl}
								skipDownload={skipBlob}
							/>
						</div>
						<div className="flex justify-center">
							<GafChatDesktopIconTooltip content={t('attachmentFullscreen')}>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									className="touch-manipulation"
									disabled={!inlineImageBlobUrl}
									onClick={() => void openPreview()}
									aria-label={t('attachmentFullscreenAria')}
								>
									<ArrowsPointingOutIcon
										className="mr-1.5 h-3.5 w-3.5 shrink-0"
										aria-hidden
										strokeWidth={LUCIDE_SW}
									/>
									{t('attachmentFullscreen')}
								</DesktopAppButton>
							</GafChatDesktopIconTooltip>
						</div>
					</div>
				) : null}

				{showVideoThumb ? (
					<div className="space-y-2">
						<div className="w-full overflow-hidden rounded-xl border border-(--desktop-border-subtle)/55 bg-(--desktop-surface-elevated)/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-(--desktop-border-subtle)/40">
							<GafChatVideoInline
								contentId={cid}
								chatId={msg.chat_id}
								messageId={msg.id}
								onBlobUrlReady={setInlineVideoBlobUrl}
								skipDownload={skipBlob}
							/>
						</div>
						<div className="flex justify-center">
							<GafChatDesktopIconTooltip content={t('attachmentFullscreen')}>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									className="touch-manipulation"
									disabled={!inlineVideoBlobUrl}
									onClick={() => void openPreview()}
									aria-label={t('attachmentFullscreenAria')}
								>
									<ArrowsPointingOutIcon
										className="mr-1.5 h-3.5 w-3.5 shrink-0"
										aria-hidden
										strokeWidth={LUCIDE_SW}
									/>
									{t('attachmentFullscreen')}
								</DesktopAppButton>
							</GafChatDesktopIconTooltip>
						</div>
					</div>
				) : null}

				{previewError ? (
					<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-amber-300/90')}>
						{previewError}
					</p>
				) : null}

				{isMine ? (
					<p
						className={cn(
							'flex items-center gap-1.5',
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-dim)'
						)}
					>
						<CheckCircleIcon
							className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
							aria-hidden
							strokeWidth={LUCIDE_SW}
						/>
						{t('attachmentSentHint')}
					</p>
				) : null}

				{!isMine && !msg.attachment_recipient_saved_id && onAcceptAttachment ? (
					<div className="mt-1 border-t border-(--desktop-border-subtle)/60 pt-2">
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							className="w-full touch-manipulation"
							disabled={acceptBusyMessageId === msg.id}
							onPointerDown={(e) => e.stopPropagation()}
							onClick={(e) => {
								e.stopPropagation();
								onAcceptAttachment(msg);
							}}
							aria-label={t('acceptFileAria')}
						>
							{acceptBusyMessageId === msg.id ? (
								<ArrowPathIcon
									className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none"
									aria-hidden
									strokeWidth={LUCIDE_SW}
								/>
							) : null}
							{t('acceptFile')}
						</DesktopAppButton>
					</div>
				) : null}
				{!isMine && msg.attachment_recipient_saved_id ? (
					<p
						className={cn(
							'flex items-center gap-1.5 border-t border-(--desktop-border-subtle)/60 pt-2',
							DESKTOP_TYPOGRAPHY.caption,
							'text-[rgb(var(--desktop-accent-rgb)/0.9)]'
						)}
					>
						<CheckCircleIcon
							className="h-3.5 w-3.5 shrink-0"
							aria-hidden
							strokeWidth={LUCIDE_SW}
						/>
						{t('fileSavedToContent')}
					</p>
				) : null}
			</div>

			<GafChatAttachmentPreviewModal
				visible={Boolean(previewModalVisible)}
				kind={kind}
				name={name}
				msg={msg}
				inlineImageBlobUrl={inlineImageBlobUrl}
				inlineVideoBlobUrl={inlineVideoBlobUrl}
				previewUrl={previewUrl}
				previewText={previewText}
				previewTextTotalChars={previewTextTotalChars}
				copyFullBusy={copyFullBusy}
				closePreview={closePreview}
				copyVisibleText={copyVisibleText}
				copyFullTextFromServer={copyFullTextFromServer}
				portalShellStyle={portalShellStyle}
				portalTheme={portalTheme}
			/>
		</div>
	);
}
