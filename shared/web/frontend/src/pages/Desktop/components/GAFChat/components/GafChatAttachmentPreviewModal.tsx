/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell-portal fullscreen/modal preview UI for GAF chat attachments (image,
 * video, PDF, text, office, and generic blob previews).
 *
 * Invariants:
 * - Renders only when parent signals previewModalVisible; close revokes blob URLs via hook.
 *
 * Related:
 * - GafChatAttachmentBlock.tsx
 * - useGafAttachmentPreview.ts
 * - ShellPortalMount
 */
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_LUCIDE,
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import type { DesktopResolvedTheme } from '@/pages/Desktop/utils/desktopUi';
import { cn } from '@/utils/cn';
import { DesktopAppButton, DesktopAppModalFrame } from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import { desktopMediaContextMenuProps } from '@/pages/Desktop/utils/desktopEmbeddedSurfacePolicy';
import {
	formatGafBytes,
	type GafAttachmentPreviewKind,
} from '../gafChatAttachmentPreviewUtils';
import type { GAFMessageItem } from '../types';
import { GafChatDesktopIconTooltip } from '../gafChatDesktopIconTooltip';
import {
	ArrowPathIcon,
	DocumentDuplicateIcon,
	DocumentTextIcon,
} from '@heroicons/react/24/outline';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;

export function GafChatAttachmentPreviewModal({
	visible,
	kind,
	name,
	msg,
	inlineImageBlobUrl,
	inlineVideoBlobUrl,
	previewUrl,
	previewText,
	previewTextTotalChars,
	copyFullBusy,
	closePreview,
	copyVisibleText,
	copyFullTextFromServer,
	portalShellStyle,
	portalTheme,
}: {
	visible: boolean;
	kind: GafAttachmentPreviewKind;
	name: string;
	msg: GAFMessageItem;
	inlineImageBlobUrl: string | null;
	inlineVideoBlobUrl: string | null;
	previewUrl: string | null;
	previewText: string | null;
	previewTextTotalChars: number | null;
	copyFullBusy: boolean;
	closePreview: () => void;
	copyVisibleText: () => void;
	copyFullTextFromServer: () => void | Promise<void>;
	portalShellStyle: React.CSSProperties;
	portalTheme: DesktopResolvedTheme;
}): JSX.Element | null {
	const { t } = useTranslation('gafChat');

	if (!visible) return null;

	return (
		<ShellPortalMount
			layer="embedded_modal_backdrop"
			dismissOnEscape={false}
			trapFocus
		>
			<div
				style={portalShellStyle}
				className={portalTheme === 'dark' ? 'dark' : undefined}
				data-testid="gaf-attachment-preview-portal-shell"
			>
				{(kind === 'image' || kind === 'sticker') && inlineImageBlobUrl ? (
					<div
						className="absolute inset-0 flex flex-col bg-[color-mix(in_srgb,rgb(0_0_0)_88%,var(--desktop-surface-app))]"
						style={{
							zIndex: DESKTOP_Z_INDEX.GAF_ATTACHMENT_PREVIEW_BACKDROP,
						}}
						role="dialog"
						aria-modal="true"
						aria-label={t('attachmentFullscreen')}
					>
						<div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-white/12 px-4 py-3 text-white">
							<span
								className={cn(
									'min-w-0 flex-1 truncate font-medium',
									DESKTOP_TYPOGRAPHY.shellCopy13
								)}
							>
								{name || t('attachmentPreview')}
							</span>
							<GafChatDesktopIconTooltip
								content={t('attachmentPreviewCloseBackdropAria')}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="icon"
									className="shrink-0 text-white hover:bg-white/12"
									onClick={closePreview}
									aria-label={t('attachmentPreviewCloseBackdropAria')}
								>
									<span aria-hidden className="text-lg leading-none">
										×
									</span>
								</DesktopAppButton>
							</GafChatDesktopIconTooltip>
						</div>
						<button
							type="button"
							className="flex min-h-0 flex-1 cursor-default touch-manipulation items-center justify-center overflow-auto p-3 md:p-6"
							onClick={closePreview}
							aria-label={t('attachmentPreviewCloseBackdropAria')}
						>
							<img
								src={inlineImageBlobUrl}
								alt={name || t('attachmentFallbackName')}
								className="max-h-[calc(100dvh-88px)] max-w-[calc(100vw-24px)] object-contain shadow-2xl"
								onClick={(e) => e.stopPropagation()}
								onKeyDown={(e) => e.stopPropagation()}
							/>
						</button>
					</div>
				) : kind === 'video' && inlineVideoBlobUrl ? (
					<div
						className="absolute inset-0 flex flex-col bg-[color-mix(in_srgb,rgb(0_0_0)_88%,var(--desktop-surface-app))]"
						style={{
							zIndex: DESKTOP_Z_INDEX.GAF_ATTACHMENT_PREVIEW_BACKDROP,
						}}
						role="dialog"
						aria-modal="true"
						aria-label={t('attachmentFullscreen')}
					>
						<div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-white/12 px-4 py-3 text-white">
							<span
								className={cn(
									'min-w-0 flex-1 truncate font-medium',
									DESKTOP_TYPOGRAPHY.shellCopy13
								)}
							>
								{name || t('attachmentPreview')}
							</span>
							<GafChatDesktopIconTooltip
								content={t('attachmentPreviewCloseBackdropAria')}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="icon"
									className="shrink-0 text-white hover:bg-white/12"
									onClick={closePreview}
									aria-label={t('attachmentPreviewCloseBackdropAria')}
								>
									<span aria-hidden className="text-lg leading-none">
										×
									</span>
								</DesktopAppButton>
							</GafChatDesktopIconTooltip>
						</div>
						<button
							type="button"
							className="flex min-h-0 flex-1 cursor-default touch-manipulation items-center justify-center overflow-auto p-3 md:p-6"
							onClick={closePreview}
							aria-label={t('attachmentPreviewCloseBackdropAria')}
						>
							<video
								src={inlineVideoBlobUrl}
								controls
								playsInline
								className="max-h-[calc(100dvh-88px)] max-w-[calc(100vw-24px)] shadow-2xl"
								onClick={(e) => e.stopPropagation()}
								{...desktopMediaContextMenuProps}
							/>
						</button>
					</div>
				) : previewUrl || (kind === 'text' && previewText !== null) ? (
					<button
						type="button"
						className={cn(
							'absolute inset-0 flex cursor-default items-center justify-center border-0 bg-transparent p-3',
							DESKTOP_OVERLAY.backdrop
						)}
						style={{
							zIndex: DESKTOP_Z_INDEX.GAF_ATTACHMENT_PREVIEW_BACKDROP,
						}}
						onClick={closePreview}
						aria-label={t('attachmentPreviewCloseBackdropAria')}
					>
						<DesktopAppModalFrame
							title={name || t('attachmentPreview')}
							onClose={closePreview}
							className="h-[min(90dvh,900px)]! max-h-[90dvh]! w-[min(96vw,920px)]! max-w-[min(96vw,920px)]!"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="max-h-[min(82vh,820px)] overflow-auto p-2">
								{kind === 'pdf' && previewUrl ? (
									<div data-desktop-iframe-host="" className="w-full">
										<iframe
											title={name}
											src={previewUrl}
											className="h-[min(75vh,760px)] w-full rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-app)"
										/>
									</div>
								) : kind === 'video' && previewUrl ? (
									<video
										src={previewUrl}
										className="mx-auto max-h-[min(78vh,800px)] w-full max-w-full"
										controls
										{...desktopMediaContextMenuProps}
									/>
								) : kind === 'audio' && previewUrl ? (
									<div className="flex flex-col items-center gap-4 py-8">
										<audio
											src={previewUrl}
											controls
											className="w-full max-w-md"
											{...desktopMediaContextMenuProps}
										/>
									</div>
								) : kind === 'text' && previewText !== null ? (
									<div className="space-y-3">
										{previewTextTotalChars != null &&
										previewTextTotalChars > previewText.length ? (
											<p
												className={cn(
													DESKTOP_TYPOGRAPHY.shellMeta10,
													'text-(--desktop-text-muted)'
												)}
											>
												{t('attachmentPreviewTextTruncated', {
													shown: previewText.length,
													total: previewTextTotalChars,
												})}
											</p>
										) : null}
										<div className="flex flex-wrap gap-2">
											<DesktopChromeTooltip
												content={t('attachmentPreviewCopyVisible')}
												placement="top"
												offsetExtra={4}
											>
												<DesktopAppButton
													type="button"
													variant="neutral"
													size="sm"
													onClick={(e) => {
														e.stopPropagation();
														copyVisibleText();
													}}
													className="gap-1.5"
												>
													<DocumentDuplicateIcon
														className="h-3.5 w-3.5"
														aria-hidden
														strokeWidth={LUCIDE_SW}
													/>
													{t('attachmentPreviewCopyVisible')}
												</DesktopAppButton>
											</DesktopChromeTooltip>
											{previewTextTotalChars != null &&
											previewTextTotalChars > previewText.length ? (
												<DesktopChromeTooltip
													content={t('attachmentPreviewCopyFull')}
													placement="top"
													offsetExtra={4}
												>
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="sm"
														disabled={copyFullBusy}
														onClick={(e) => {
															e.stopPropagation();
															void copyFullTextFromServer();
														}}
														className="gap-1.5"
													>
														{copyFullBusy ? (
															<ArrowPathIcon
																className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
																aria-hidden
																strokeWidth={LUCIDE_SW}
															/>
														) : (
															<DocumentDuplicateIcon
																className="h-3.5 w-3.5"
																aria-hidden
																strokeWidth={LUCIDE_SW}
															/>
														)}
														{t('attachmentPreviewCopyFull')}
													</DesktopAppButton>
												</DesktopChromeTooltip>
											) : null}
										</div>
										<pre
											className={cn(
												DESKTOP_TYPOGRAPHY.shellCopy13,
												'max-h-[min(78vh,800px)] overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border border-(--desktop-border-subtle)/80 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_94%,rgb(var(--desktop-bg-primary-rgb)/0.35))] p-4 text-(--desktop-text-primary) shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
											)}
										>
											{previewText}
										</pre>
									</div>
								) : kind === 'office' && previewUrl ? (
									<div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
										<DocumentTextIcon
											className="h-14 w-14 text-[rgb(var(--desktop-accent-rgb)/0.55)]"
											aria-hidden
											strokeWidth={LUCIDE_SW}
										/>
										<p
											className={cn(
												'max-w-md font-medium text-(--desktop-text-primary) wrap-break-word',
												DESKTOP_TYPOGRAPHY.body
											)}
										>
											{name || t('attachmentFallbackName')}
										</p>
										{msg.attachment_size != null ? (
											<p
												className={cn(
													DESKTOP_TYPOGRAPHY.shellMeta10,
													'text-(--desktop-text-dim)'
												)}
											>
												{formatGafBytes(msg.attachment_size)}
											</p>
										) : null}
										<p
											className={cn(
												'max-w-md leading-snug',
												DESKTOP_TYPOGRAPHY.body
											)}
										>
											{t('attachmentPreviewOfficeHint')}
										</p>
									</div>
								) : kind === 'other' && previewUrl ? (
									<div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
										<DocumentTextIcon
											className="h-12 w-12 text-(--desktop-text-muted)"
											aria-hidden
											strokeWidth={LUCIDE_SW}
										/>
										<p
											className={cn(
												'max-w-md font-medium text-(--desktop-text-primary) wrap-break-word',
												DESKTOP_TYPOGRAPHY.body
											)}
										>
											{name || t('attachmentFallbackName')}
										</p>
										{msg.attachment_size != null ? (
											<p
												className={cn(
													DESKTOP_TYPOGRAPHY.shellMeta10,
													'text-(--desktop-text-dim)'
												)}
											>
												{formatGafBytes(msg.attachment_size)}
											</p>
										) : null}
										<p
											className={cn(
												'max-w-md leading-snug',
												DESKTOP_TYPOGRAPHY.body
											)}
										>
											{t('attachmentPreviewGenericHint')}
										</p>
									</div>
								) : (
									<p
										className={cn('py-6 text-center', DESKTOP_TYPOGRAPHY.body)}
									>
										{t('attachmentPreviewOther')}
									</p>
								)}
							</div>
						</DesktopAppModalFrame>
					</button>
				) : null}
			</div>
		</ShellPortalMount>
	);
}
