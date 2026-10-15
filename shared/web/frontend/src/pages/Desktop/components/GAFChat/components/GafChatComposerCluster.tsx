/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat thread composer cluster: blocked banners, send error retry, attachment queue,
 * voice recording strip, textarea, and action toolbar.
 *
 * Invariants:
 * - Renders nothing when composerLocked; parent owns send/mutation and attachment state.
 * - Drag-over overlay and file input stay inside the form for drop target semantics.
 * - Composer textarea always has `id` + `name` (autofill / a11y scanners).
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 * - src/pages/Desktop/components/GAFChat/gafChatComposerTypes.ts
 */
import {
	ArrowPathIcon,
	FolderOpenIcon,
	InformationCircleIcon,
	MicrophoneIcon,
	NoSymbolIcon,
	PaperAirplaneIcon,
	PaperClipIcon,
	Square2StackIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import {
	memo,
	useId,
	type DragEvent,
	type FormEvent,
	type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DesktopAppButton } from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import { GafChatDesktopIconTooltip } from '../gafChatDesktopIconTooltip';
import { formatGafRecordingClock } from '../gafChatMessageViewUtils';
import type { GafChatThreadPrefs } from '../gafChatThreadPrefs';
import { mapGafChatUserError } from '../gafChatMapUserError';
import type { GafPendingComposerAttachment } from '../gafChatComposerTypes';
import type { GAFMessageItem } from '../types';
import { GAFChatErrorBar } from './GAFChatErrorBar';
import { GafChatComposerAttachmentPreview } from './GafChatComposerAttachmentPreview';

export type GafChatComposerClusterProps = {
	composerLocked: boolean;
	chatBlocked: boolean;
	e2eeActive?: boolean;
	partnerIsSystemAccount: boolean;
	shellComposerFormClass: string;
	shellComposerTextareaClass: string;
	shellComposerHintRowClass: string;
	composerDragOver: boolean;
	selectedChatId: string | null;
	localAttachInputRef: RefObject<HTMLInputElement | null>;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	inputText: string;
	onInputTextChange: (value: string) => void;
	onSend: () => void;
	onComposerDragEnter: (e: DragEvent<HTMLFormElement>) => void;
	onComposerDragLeave: (e: DragEvent<HTMLFormElement>) => void;
	onComposerDragOver: (e: DragEvent<HTMLFormElement>) => void;
	onComposerDrop: (e: DragEvent<HTMLFormElement>) => void;
	onComposerPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
	onPickLocalFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
	replyingTo: GAFMessageItem | null;
	onClearReply: () => void;
	pendingAttachments: GafPendingComposerAttachment[];
	onRemovePendingAttachment: (contentId: string) => void;
	threadPrefs: GafChatThreadPrefs;
	isVoiceRecording: boolean;
	isVoiceRecordingSupported: boolean;
	voiceElapsedSec: number;
	onCancelVoiceRecording: () => void;
	onBeginVoiceRecording: () => void;
	onFinishVoiceRecording: () => void;
	attachmentUploading: boolean;
	/** Byte upload percent (5% steps); null = no percent (library attach / idle). */
	attachmentUploadPercent: number | null;
	sendPending: boolean;
	sendError: unknown;
	sendVariables: unknown;
	onRetrySend: () => void;
	onDismissSendError: () => void;
	isGafAdmin: boolean;
	onOpenContentLibraryPicker: () => void;
	onOpenAdminAppLinkPicker: () => void;
};

export const GafChatComposerCluster = memo(function GafChatComposerCluster({
	composerLocked,
	chatBlocked,
	e2eeActive = false,
	partnerIsSystemAccount,
	shellComposerFormClass,
	shellComposerTextareaClass,
	shellComposerHintRowClass,
	composerDragOver,
	selectedChatId,
	localAttachInputRef,
	inputRef,
	inputText,
	onInputTextChange,
	onSend,
	onComposerDragEnter,
	onComposerDragLeave,
	onComposerDragOver,
	onComposerDrop,
	onComposerPaste,
	onPickLocalFile,
	replyingTo,
	onClearReply,
	pendingAttachments,
	onRemovePendingAttachment,
	threadPrefs,
	isVoiceRecording,
	isVoiceRecordingSupported,
	voiceElapsedSec,
	onCancelVoiceRecording,
	onBeginVoiceRecording,
	onFinishVoiceRecording,
	attachmentUploading,
	attachmentUploadPercent,
	sendPending,
	sendError,
	sendVariables,
	onRetrySend,
	onDismissSendError,
	isGafAdmin,
	onOpenContentLibraryPicker,
	onOpenAdminAppLinkPicker,
}: GafChatComposerClusterProps) {
	const { t } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;
	const composerFieldId = `${useId().replace(/:/g, '')}-composer-message`;

	const sendDisabled =
		chatBlocked ||
		sendPending ||
		attachmentUploading ||
		isVoiceRecording ||
		(!inputText.trim() && pendingAttachments.length === 0);

	const attachDisabled =
		chatBlocked ||
		e2eeActive ||
		sendPending ||
		attachmentUploading ||
		isVoiceRecording ||
		pendingAttachments.length > 0;

	const attachBlockedTooltip = e2eeActive
		? t('e2eeAttachmentBlocked')
		: attachmentUploading && attachmentUploadPercent != null
			? t('composerUploadProgressTitle', { percent: attachmentUploadPercent })
			: t('attachFromComputerTitle');

	return (
		<>
			{chatBlocked ? (
				<div
					className={cn(
						'flex items-start gap-2 border-t border-rose-500/30 bg-linear-to-r from-rose-500/14 via-rose-500/8 to-transparent px-3 py-2 text-rose-100',
						DESKTOP_TYPOGRAPHY.body
					)}
					role="status"
				>
					<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
						<NoSymbolIcon
							className="h-4 w-4"
							aria-hidden
							strokeWidth={lucideStroke}
						/>
					</span>
					<span className="min-w-0 leading-snug">
						{t('blockedComposerBanner')}
					</span>
				</div>
			) : null}
			{partnerIsSystemAccount ? (
				<div
					className={cn(
						'flex items-start gap-2 border-t border-(--desktop-border-subtle) bg-[linear-gradient(180deg,rgb(var(--desktop-bg-secondary-rgb)/0.42)_0%,rgb(var(--desktop-bg-primary-rgb)/0.32)_100%)] px-3 py-2 text-(--desktop-text-secondary)',
						DESKTOP_TYPOGRAPHY.body
					)}
					role="status"
				>
					<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/70 text-(--desktop-text-muted) shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
						<InformationCircleIcon
							className="h-4 w-4"
							aria-hidden
							strokeWidth={lucideStroke}
						/>
					</span>
					<span className="min-w-0 leading-snug">
						{t('systemComposerBanner')}
					</span>
				</div>
			) : null}
			{sendError && sendVariables ? (
				<GAFChatErrorBar
					message={`${mapGafChatUserError(sendError, t, 'send')} ${t('sendRetryHint')}`}
					onAction={onRetrySend}
					onDismiss={onDismissSendError}
				/>
			) : null}
			{!composerLocked ? (
				<form
					className={cn(
						shellComposerFormClass,
						'relative',
						composerDragOver &&
							'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.55)] ring-inset'
					)}
					data-gaf-guide="composer"
					onDragEnter={onComposerDragEnter}
					onDragLeave={onComposerDragLeave}
					onDragOver={onComposerDragOver}
					onDrop={onComposerDrop}
					onSubmit={(e: FormEvent) => {
						e.preventDefault();
						onSend();
					}}
				>
					<input
						ref={localAttachInputRef}
						type="file"
						className="sr-only"
						tabIndex={-1}
						aria-label={t('attachFromComputerAria')}
						onChange={onPickLocalFile}
					/>
					{composerDragOver && !chatBlocked && selectedChatId ? (
						<div
							className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--desktop-surface-app)_78%,transparent)] px-3 backdrop-blur-[3px] motion-reduce:backdrop-blur-none ring-2 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.45)]"
							style={{ zIndex: DESKTOP_Z_INDEX.GAF_INNER_OVERLAY }}
							role="status"
							aria-live="polite"
						>
							<span
								className={cn(
									'max-w-[min(100%,28rem)] text-center font-semibold leading-snug text-[rgb(var(--desktop-accent-rgb)/0.98)]',
									DESKTOP_TYPOGRAPHY.body
								)}
							>
								{t('composerDragActiveHint')}
							</span>
						</div>
					) : null}
					<div
						className="relative flex min-h-9 min-w-0 max-w-full flex-[1_1_12rem] flex-col gap-1"
						style={{ zIndex: DESKTOP_Z_INDEX.GAF_INNER_BASE }}
					>
						<div className="sr-only" aria-live="polite" aria-atomic="true">
							{sendPending ? t('sendingStatusAria') : ''}
						</div>
						{replyingTo && !chatBlocked ? (
							<div
								className={cn(
									shellComposerHintRowClass,
									'flex min-h-9 items-center gap-2 rounded-lg border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-2 py-1.5'
								)}
							>
								<span
									className={cn(
										'shrink-0 font-semibold uppercase tracking-wide',
										DESKTOP_TYPOGRAPHY.shellDescriptionToggle
									)}
								>
									{t('replyingToLabel')}
								</span>
								<GafChatDesktopIconTooltip
									content={
										String(replyingTo.body || '')
											.trim()
											.slice(0, 120) ||
										replyingTo.attachment_name ||
										t('replyQuoteFallback')
									}
									placement="top"
									offsetExtra={4}
								>
									<span
										className={cn(
											'min-w-0 flex-1 truncate text-(--desktop-text-secondary)',
											DESKTOP_TYPOGRAPHY.body
										)}
									>
										{String(replyingTo.body || '')
											.trim()
											.slice(0, 120) ||
											replyingTo.attachment_name ||
											t('replyQuoteFallback')}
									</span>
								</GafChatDesktopIconTooltip>
								<GafChatDesktopIconTooltip content={t('replyingToClearAria')}>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="icon"
										className="h-8 w-8 shrink-0"
										aria-label={t('replyingToClearAria')}
										onClick={onClearReply}
									>
										<XMarkIcon
											className="h-4 w-4"
											aria-hidden
											strokeWidth={lucideStroke}
										/>
									</DesktopAppButton>
								</GafChatDesktopIconTooltip>
							</div>
						) : null}
						{pendingAttachments.length > 0 ? (
							<ul
								className="m-0 flex max-h-72 list-none flex-col gap-2 overflow-y-auto overscroll-contain p-0 pr-0.5"
								aria-label={t('composerAttachmentQueueAria')}
							>
								{pendingAttachments.length > 1 ? (
									<li className="list-none">
										<p
											className={cn(
												shellComposerHintRowClass,
												'text-(--desktop-text-muted)'
											)}
										>
											{t('composerQueueCount', {
												count: pendingAttachments.length,
											})}
										</p>
									</li>
								) : null}
								{pendingAttachments.map((att) => (
									<li key={att.contentId} className="list-none">
										<GafChatComposerAttachmentPreview
											contentId={att.contentId}
											fileName={att.fileName}
											size={att.size}
											mimeType={att.mimeType ?? null}
											onRemove={() => onRemovePendingAttachment(att.contentId)}
											disabled={
												chatBlocked || sendPending || attachmentUploading
											}
											mediaPrefs={threadPrefs}
										/>
									</li>
								))}
							</ul>
						) : null}
						{attachmentUploading ? (
							<div
								className={cn(
									shellComposerHintRowClass,
									'flex flex-col gap-1.5'
								)}
								role="status"
								aria-live="polite"
								aria-busy="true"
								aria-label={
									attachmentUploadPercent != null
										? t('composerUploadProgressAria', {
												percent: attachmentUploadPercent,
											})
										: t('composerUploading')
								}
							>
								<div className="flex min-w-0 items-center justify-between gap-2">
									<span className="min-w-0 truncate text-(--desktop-text-muted)">
										{attachmentUploadPercent != null
											? t('composerUploadProgress', {
													percent: attachmentUploadPercent,
												})
											: t('composerUploading')}
									</span>
									{attachmentUploadPercent != null ? (
										<span
											className="shrink-0 tabular-nums font-medium text-(--desktop-text-primary)"
											data-testid="gaf-composer-upload-percent"
										>
											{attachmentUploadPercent}%
										</span>
									) : null}
								</div>
								{attachmentUploadPercent != null ? (
									<div
										className="h-1 w-full overflow-hidden rounded-full bg-(--desktop-surface-soft)"
										aria-hidden
									>
										<div
											className="h-full rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.85)] transition-[width] duration-150 motion-reduce:transition-none"
											style={{
												width: `${Math.max(0, Math.min(100, attachmentUploadPercent))}%`,
											}}
										/>
									</div>
								) : null}
							</div>
						) : null}
						{isVoiceRecording ? (
							<div
								className={cn(
									shellComposerHintRowClass,
									'flex flex-wrap items-center justify-between gap-2'
								)}
							>
								<span className="inline-flex min-w-0 flex-wrap items-center gap-2 font-medium text-(--desktop-text-primary)">
									<span
										className="h-2 w-2 shrink-0 rounded-full bg-red-500 motion-safe:animate-pulse"
										aria-hidden
									/>
									<span className="tabular-nums">
										{formatGafRecordingClock(voiceElapsedSec)}
									</span>
									<span className="text-(--desktop-text-muted) font-normal">
										{t('voiceRecordingHint')}
									</span>
								</span>
								<DesktopChromeTooltip
									content={t('voiceCancelRecording')}
									placement="top"
									offsetExtra={4}
								>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="shrink-0"
										onClick={onCancelVoiceRecording}
										aria-label={t('voiceCancelRecordingAria')}
									>
										{t('voiceCancelRecording')}
									</DesktopAppButton>
								</DesktopChromeTooltip>
							</div>
						) : null}
						<div className="relative min-w-0">
							<textarea
								id={composerFieldId}
								name="gaf-chat-composer-message"
								ref={inputRef}
								placeholder={
									chatBlocked
										? t('composerBlockedPlaceholder')
										: t('composerPlaceholder')
								}
								className={cn(
									shellComposerTextareaClass,
									inputText.length > 0 ? 'pb-6 pr-12' : ''
								)}
								value={inputText}
								rows={1}
								maxLength={2000}
								disabled={
									chatBlocked ||
									sendPending ||
									attachmentUploading ||
									isVoiceRecording
								}
								onChange={(e) => onInputTextChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key !== 'Enter') return;
									if (e.shiftKey) return;
									if (e.nativeEvent.isComposing) return;
									e.preventDefault();
									onSend();
								}}
								onInput={(e) => {
									const el = e.currentTarget;
									el.style.height = 'auto';
									el.style.height = `${el.scrollHeight}px`;
								}}
								onPaste={onComposerPaste}
								aria-label={t('composerAria')}
								autoComplete="off"
							/>
							{inputText.length > 0 ? (
								<span
									className={cn(
										'pointer-events-none absolute right-3 bottom-2 tabular-nums text-(--desktop-text-dim)',
										DESKTOP_TYPOGRAPHY.shellMeta10,
										inputText.length > 1800 ? 'text-amber-400' : ''
									)}
									aria-live="polite"
								>
									{inputText.length}/2000
								</span>
							) : null}
						</div>
					</div>
					<fieldset
						className={cn(
							'relative m-0 flex min-w-0 shrink-0 items-center gap-0.5 self-end rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
							'transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none',
							'focus-within:border-[rgb(var(--desktop-accent-rgb)/0.35)] focus-within:shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.14),inset_0_1px_0_rgba(255,255,255,0.06)]'
						)}
						style={{ zIndex: DESKTOP_Z_INDEX.GAF_INNER_BASE }}
						aria-label={t('composerActionsAria')}
					>
						<GafChatDesktopIconTooltip
							content={
								e2eeActive
									? t('e2eeAttachmentBlocked')
									: t('attachFromLibraryTitle')
							}
						>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								className="h-9 w-9"
								disabled={attachDisabled}
								aria-label={t('attachFromLibraryAria')}
								onClick={onOpenContentLibraryPicker}
							>
								<FolderOpenIcon
									className="h-4 w-4"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
							</DesktopAppButton>
						</GafChatDesktopIconTooltip>
						<GafChatDesktopIconTooltip content={attachBlockedTooltip}>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								className="h-9 w-9"
								disabled={attachDisabled}
								aria-label={
									attachmentUploading && attachmentUploadPercent != null
										? t('composerUploadProgressAria', {
												percent: attachmentUploadPercent,
											})
										: t('attachFromComputerAria')
								}
								onClick={() => localAttachInputRef.current?.click()}
							>
								{attachmentUploading ? (
									attachmentUploadPercent != null ? (
										<span
											className="min-w-[1.75rem] text-center text-[10px] font-semibold tabular-nums leading-none text-(--desktop-text-primary)"
											aria-hidden
										>
											{attachmentUploadPercent}%
										</span>
									) : (
										<ArrowPathIcon
											className="h-4 w-4 animate-spin motion-reduce:animate-none"
											aria-hidden
											strokeWidth={lucideStroke}
										/>
									)
								) : (
									<PaperClipIcon
										className="h-4 w-4"
										aria-hidden
										strokeWidth={lucideStroke}
									/>
								)}
							</DesktopAppButton>
						</GafChatDesktopIconTooltip>
						{isGafAdmin ? (
							<GafChatDesktopIconTooltip
								content={t('adminAppLinkComposerTitle')}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="icon"
									className="h-9 w-9"
									disabled={attachDisabled || !selectedChatId}
									aria-label={t('adminAppLinkComposerAria')}
									onClick={onOpenAdminAppLinkPicker}
								>
									<Square2StackIcon
										className="h-4 w-4"
										aria-hidden
										strokeWidth={lucideStroke}
									/>
								</DesktopAppButton>
							</GafChatDesktopIconTooltip>
						) : null}
						{isVoiceRecordingSupported ? (
							<GafChatDesktopIconTooltip
								content={
									isVoiceRecording
										? t('voiceStopRecordingTitle')
										: t('voiceStartRecordingTitle')
								}
							>
								<DesktopAppButton
									type="button"
									variant={isVoiceRecording ? 'accent' : 'ghost'}
									size="icon"
									className="h-9 w-9"
									disabled={
										chatBlocked ||
										sendPending ||
										attachmentUploading ||
										pendingAttachments.length > 0
									}
									aria-label={
										isVoiceRecording
											? t('voiceStopRecordingAria')
											: t('voiceStartRecordingAria')
									}
									onClick={() => {
										if (isVoiceRecording) {
											void onFinishVoiceRecording();
										} else {
											void onBeginVoiceRecording();
										}
									}}
								>
									{isVoiceRecording ? (
										<Square2StackIcon
											className="h-4 w-4"
											aria-hidden
											strokeWidth={lucideStroke}
										/>
									) : (
										<MicrophoneIcon
											className="h-4 w-4"
											aria-hidden
											strokeWidth={lucideStroke}
										/>
									)}
								</DesktopAppButton>
							</GafChatDesktopIconTooltip>
						) : null}
						{sendPending ? (
							<GafChatDesktopIconTooltip content={t('sendAria')}>
								<DesktopAppButton
									type="submit"
									disabled={sendDisabled}
									aria-busy="true"
									variant="accent"
									size="icon"
									className="h-9 w-9"
									aria-label={t('sendingAria')}
								>
									<ArrowPathIcon
										className="h-4 w-4 animate-spin motion-reduce:animate-none"
										aria-hidden
										strokeWidth={lucideStroke}
									/>
								</DesktopAppButton>
							</GafChatDesktopIconTooltip>
						) : (
							<GafChatDesktopIconTooltip content={t('sendAria')}>
								<DesktopAppButton
									type="submit"
									disabled={sendDisabled}
									aria-busy="false"
									variant="accent"
									size="icon"
									className="h-9 w-9"
									aria-label={t('sendAria')}
								>
									<PaperAirplaneIcon
										className="h-4 w-4"
										aria-hidden
										strokeWidth={lucideStroke}
									/>
								</DesktopAppButton>
							</GafChatDesktopIconTooltip>
						)}
					</fieldset>
				</form>
			) : null}
		</>
	);
});
