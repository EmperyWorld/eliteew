/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single message bubble for incoming/outgoing GAF Chat messages: body composition,
 * actions, and delegation to GafChatMessageListRow for row chrome.
 *
 * Invariants:
 * - E2EE bubbles show only decrypted/local placeholder text and never expose ciphertext as body text.
 *
 * Related:
 * - documentation/product/GAF-CHAT-BACKEND.md
 * - src/pages/Desktop/components/GAFChat/components/GafChatMessageListRow.tsx
 */
import { cn } from '@/utils/cn';
import { enUS, ru } from 'date-fns/locale';
import { useGafChatMessageContextMenu } from './components/GafChatMessageContextMenuProvider';
import { GafChatMessageListRow } from './components/GafChatMessageListRow';
import { GafChatMessageOverflowMenu } from './components/GafChatMessageOverflowMenu';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopGafOpenActions } from '../../context/DesktopGafActionsContext';
import { useDesktopShellFrame } from '../../context/DesktopShellFrameContext';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { GafChatDesktopIconTooltip } from './gafChatDesktopIconTooltip';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../../utils/desktopVisualSystem';
import { GafChatAttachmentBlock } from './components/GafChatAttachmentBlock';
import { GafChatReplyQuote } from './components/GafChatReplyQuote';
import {
	GafChatOnboardingStructuredBody,
	type OnboardingStructuredPayload,
} from './GafChatOnboardingStructuredBody';
import { GafChatDesktopAppLinkBlock } from './GafChatDesktopAppLinkBlock';
import { GafChatSurveyAnnouncementBlock } from './GafChatSurveyAnnouncementBlock';
import { getGafDesktopAppLinkMeta } from './gafChatDesktopAppLinkMeta';
import { getGafSurveyAnnouncementMeta } from './gafChatSurveyAnnouncementMeta';
import { getLegacyPostCallSummaryLabel } from './gafChatMessageUtils';
import type { GafChatThreadPrefs } from './gafChatThreadPrefs';
import {
	GAF_BUBBLE_MARKDOWN_PROSE_INCOMING,
	GAF_BUBBLE_MARKDOWN_PROSE_OUTGOING,
	GAF_PLAIN_BODY_INCOMING,
	GAF_PLAIN_BODY_OUTGOING,
	highlightSearchInPlainText,
	renderGafMessageContent,
} from './gafChatMessageBodyRender';
import {
	bubbleFooterTimes,
	getVideoCallEventMeta,
	LONG_PRESS_MS,
} from './gafChatMessageViewUtils';
import type { GAFChatListItem, GAFMessageItem } from './types';
import {
	ArrowUturnLeftIcon,
	DocumentDuplicateIcon,
	LockClosedIcon,
} from '@heroicons/react/24/outline';

export const GAFChatMessageBubble = memo(function GAFChatMessageBubble({
	msg,
	isMine,
	isDeleted,
	isReadByPartner,
	partner,
	meLabel: _meLabel,
	myUserId,
	messageById,
	onCopyPlainText,
	highlightQuery,
	onAcceptAttachment,
	acceptBusyMessageId,
	onReply,
	onJumpToMessage,
	mediaPrefs,
	onEditMessage,
	onDeleteMessageForMe,
	onDeleteMessageForEveryone,
}: {
	msg: GAFMessageItem;
	isMine: boolean;
	isDeleted: boolean;
	isReadByPartner: boolean;
	partner: GAFChatListItem['partner'] | null;
	meLabel: string;
	myUserId?: string | null;
	messageById?: Map<string, GAFMessageItem>;
	onCopyPlainText: (text: string) => void;
	/** Plain-text thread search; markdown/code bodies skip inline highlights. */
	highlightQuery: string;
	onAcceptAttachment?: (m: GAFMessageItem) => void;
	acceptBusyMessageId?: string | null;
	onReply?: (m: GAFMessageItem) => void;
	onJumpToMessage?: (messageId: string) => void;
	mediaPrefs?: GafChatThreadPrefs | null;
	onEditMessage?: (m: GAFMessageItem) => void;
	onDeleteMessageForMe?: (m: GAFMessageItem) => void;
	onDeleteMessageForEveryone?: (m: GAFMessageItem) => void;
}) {
	const { t, i18n } = useTranslation('gafChat');
	const dateLocale = i18n.language?.startsWith('en') ? enUS : ru;
	const longPressTimerRef = useRef<number | null>(null);
	const { openMessageContextMenu } = useGafChatMessageContextMenu();
	const bodyStr = String(msg.body || '');
	const isE2eeMessage = String(msg.algorithm || '').startsWith('e2e_');
	const footer = bubbleFooterTimes(
		msg.created_at,
		dateLocale,
		msg.edited_at,
		t('messageEditedMark')
	);
	const shellFrame = useDesktopShellFrame();
	const lucideStroke = DESKTOP_LUCIDE.stroke;
	const bubbleOutgoingClass = useMemo(
		() =>
			cn(
				getDesktopShellContentPanelClassName(shellFrame),
				'group/bubble relative min-w-0 max-w-full touch-manipulation rounded-[1.15rem] rounded-tr-[0.55rem]',
				'border border-[rgb(var(--desktop-accent-rgb)/0.38)] px-3.5 py-2.5 antialiased',
				'bg-[color-mix(in_srgb,var(--desktop-surface-accent)_88%,var(--desktop-surface-app))]',
				'text-[color-mix(in_srgb,var(--desktop-text-secondary)_94%,var(--desktop-text-primary))]',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] selection:bg-[rgb(var(--desktop-accent-rgb)/0.22)]'
			),
		[shellFrame]
	);
	const bubbleIncomingClass = useMemo(
		() =>
			cn(
				getDesktopShellContentPanelClassName(shellFrame),
				'group/bubble relative min-w-0 max-w-full touch-manipulation rounded-[1.15rem] rounded-tl-[0.55rem]',
				'border border-[color-mix(in_srgb,var(--desktop-border-strong)_42%,transparent)] px-3.5 py-2.5 antialiased',
				'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_93%,transparent)] text-(--desktop-text-primary)',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] selection:bg-[rgb(var(--desktop-accent-rgb)/0.16)]'
			),
		[shellFrame]
	);
	const bubbleCopyBtnClass = useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'h-8 w-8 shrink-0 opacity-100 transition-opacity sm:opacity-55 sm:group-hover/bubble:opacity-100 sm:group-focus-within/bubble:opacity-100 sm:focus-visible:opacity-100'
			),
		[shellFrame]
	);

	const clearLongPressTimer = useCallback(() => {
		if (longPressTimerRef.current != null) {
			window.clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
	}, []);

	const copyIfAllowed = useCallback(() => {
		if (isDeleted) return;
		if (isE2eeMessage) {
			toast(t('e2eeMessageCopyBlocked'));
			return;
		}
		const plain =
			String(msg.body || '').trim() ||
			(msg.attachment_name ? String(msg.attachment_name) : '');
		onCopyPlainText(plain);
	}, [
		isDeleted,
		isE2eeMessage,
		msg.attachment_name,
		msg.body,
		onCopyPlainText,
		t,
	]);

	const onBubblePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (isDeleted) return;
			if (e.button !== 0) return;
			clearLongPressTimer();
			longPressTimerRef.current = window.setTimeout(() => {
				longPressTimerRef.current = null;
				copyIfAllowed();
			}, LONG_PRESS_MS);
		},
		[isDeleted, clearLongPressTimer, copyIfAllowed]
	);

	/** Capture: перехватываем до ссылок/кнопок, чтобы единое меню по всей строке (аватар, цитата, вложение, тело). */
	const onMessageRowContextMenuCapture = useCallback(
		(e: React.MouseEvent) => {
			if (isDeleted) return;
			const el = e.target as HTMLElement | null;
			if (el?.closest?.('[data-gaf-skip-message-context="true"]')) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			clearLongPressTimer();
			const canEditNow = Boolean(
				isMine &&
					!isDeleted &&
					!isE2eeMessage &&
					bodyStr.trim().length > 0 &&
					onEditMessage
			);
			const canDeleteForEveryoneNow = Boolean(
				isMine && !isDeleted && onDeleteMessageForEveryone
			);
			const showOverflowNow = !isDeleted && Boolean(onDeleteMessageForMe);
			openMessageContextMenu({
				anchor: { clientX: e.clientX, clientY: e.clientY },
				onCopy: copyIfAllowed,
				showReply: Boolean(onReply),
				onReply: onReply ? () => onReply(msg) : undefined,
				canEdit: canEditNow,
				onEdit:
					canEditNow && onEditMessage ? () => onEditMessage(msg) : undefined,
				onDeleteForMe:
					showOverflowNow && onDeleteMessageForMe
						? () => onDeleteMessageForMe(msg)
						: undefined,
				canDeleteForEveryone: canDeleteForEveryoneNow,
				onDeleteForEveryone:
					canDeleteForEveryoneNow && onDeleteMessageForEveryone
						? () => onDeleteMessageForEveryone(msg)
						: undefined,
			});
		},
		[
			isDeleted,
			clearLongPressTimer,
			bodyStr,
			isE2eeMessage,
			isMine,
			onEditMessage,
			onDeleteMessageForEveryone,
			onDeleteMessageForMe,
			openMessageContextMenu,
			copyIfAllowed,
			onReply,
			msg,
		]
	);

	useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

	const copyButton = !isDeleted ? (
		<GafChatDesktopIconTooltip content={t('copyMessageTitle')}>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="icon"
				className={bubbleCopyBtnClass}
				aria-label={t('copyMessageAria')}
				onPointerDown={(e) => e.stopPropagation()}
				onClick={(e) => {
					e.stopPropagation();
					copyIfAllowed();
				}}
			>
				<DocumentDuplicateIcon
					className="h-4 w-4"
					aria-hidden
					strokeWidth={lucideStroke}
				/>
			</DesktopAppButton>
		</GafChatDesktopIconTooltip>
	) : null;

	const replyButton =
		!isDeleted && onReply ? (
			<GafChatDesktopIconTooltip content={t('replyToMessage')}>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					className={bubbleCopyBtnClass}
					aria-label={t('replyToMessageAria')}
					onPointerDown={(e) => e.stopPropagation()}
					onClick={(e) => {
						e.stopPropagation();
						onReply(msg);
					}}
				>
					<ArrowUturnLeftIcon
						className="h-4 w-4"
						aria-hidden
						strokeWidth={lucideStroke}
					/>
				</DesktopAppButton>
			</GafChatDesktopIconTooltip>
		) : null;

	const canEdit = Boolean(
		isMine &&
			!isDeleted &&
			!isE2eeMessage &&
			bodyStr.trim().length > 0 &&
			onEditMessage
	);
	const canDeleteForEveryone = Boolean(
		isMine && !isDeleted && onDeleteMessageForEveryone
	);
	const showOverflow = !isDeleted && Boolean(onDeleteMessageForMe);

	const overflowMenu = showOverflow ? (
		<GafChatMessageOverflowMenu
			canEdit={canEdit}
			canDeleteForEveryone={canDeleteForEveryone}
			onEdit={() => onEditMessage?.(msg)}
			onDeleteForMe={() => onDeleteMessageForMe?.(msg)}
			onDeleteForEveryone={
				canDeleteForEveryone && onDeleteMessageForEveryone
					? () => onDeleteMessageForEveryone(msg)
					: undefined
			}
			buttonClassName={bubbleCopyBtnClass}
		/>
	) : null;

	const replyToId = msg.reply_to_message_id?.trim();
	const referenced =
		replyToId && messageById ? messageById.get(replyToId) : undefined;
	const replyQuoteBlock =
		replyToId && onJumpToMessage ? (
			<GafChatReplyQuote
				replyToId={replyToId}
				referenced={referenced}
				isMineBubble={isMine}
				myUserId={myUserId ?? null}
				partner={partner}
				onJump={onJumpToMessage}
			/>
		) : null;

	const hasAttachment = Boolean(msg.attachment_content_id);
	const hq = highlightQuery.trim();
	const attachmentBlock =
		!isDeleted && hasAttachment ? (
			<GafChatAttachmentBlock
				msg={msg}
				isMine={isMine}
				onAcceptAttachment={onAcceptAttachment}
				acceptBusyMessageId={acceptBusyMessageId}
				mediaPrefs={mediaPrefs ?? null}
			/>
		) : null;
	const gafDesktop = useDesktopGafOpenActions();
	const bodyMarkdownProse = isMine
		? GAF_BUBBLE_MARKDOWN_PROSE_OUTGOING
		: GAF_BUBBLE_MARKDOWN_PROSE_INCOMING;
	const plainShellClass = isMine
		? GAF_PLAIN_BODY_OUTGOING
		: GAF_PLAIN_BODY_INCOMING;
	const e2eeDecryptFailed =
		isE2eeMessage && (!bodyStr.trim() || bodyStr.trim() === '[encrypted]');
	const renderedBody = isDeleted ? null : isE2eeMessage ? (
		<div className="flex max-w-full flex-col gap-1.5">
			<div
				className={cn(
					'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1',
					'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] text-(--desktop-text-primary)',
					plainShellClass
				)}
			>
				<LockClosedIcon
					className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
					strokeWidth={lucideStroke}
					aria-hidden
				/>
				<span className="truncate">
					{e2eeDecryptFailed
						? t('e2eeMessageDecryptFailed')
						: bodyStr.trim() && bodyStr.trim() !== '[encrypted]'
							? bodyStr.trim()
							: t('e2eeMessagePlaceholder')}
				</span>
			</div>
			{e2eeDecryptFailed ? (
				<p
					className={cn(
						'max-w-full leading-snug text-(--desktop-text-muted)',
						DESKTOP_TYPOGRAPHY.captionInherit,
						plainShellClass
					)}
				>
					{t('e2eeMessageDecryptHint')}
				</p>
			) : null}
			{e2eeDecryptFailed && gafDesktop?.openSocialHubTab ? (
				<DesktopChromeTooltip
					content={t('e2eeReadinessBannerAction')}
					placement="top"
					offsetExtra={4}
				>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							'h-7 w-fit px-2 font-semibold',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
						onClick={() => gafDesktop.openSocialHubTab?.('phone')}
					>
						{t('e2eeReadinessBannerAction')}
					</DesktopAppButton>
				</DesktopChromeTooltip>
			) : null}
		</div>
	) : hq && !bodyStr.includes('```') ? (
		<div
			className={cn(
				'wrap-anywhere leading-relaxed whitespace-pre-wrap',
				plainShellClass
			)}
		>
			{highlightSearchInPlainText(bodyStr, hq)}
		</div>
	) : (
		renderGafMessageContent(bodyStr, bodyMarkdownProse, plainShellClass)
	);
	const showTextBody = bodyStr.trim().length > 0;
	const videoCallEvent = useMemo(
		() => getVideoCallEventMeta(msg.metadata),
		[msg.metadata]
	);
	const legacyPostCallLabel = useMemo(
		() => getLegacyPostCallSummaryLabel(bodyStr),
		[bodyStr]
	);
	// Single pass over metadata: structured onboarding vs legacy (buttons at bottom).
	const onboardingMeta = useMemo(() => {
		if (isMine || !msg.metadata || typeof msg.metadata !== 'object') {
			return {
				structured: null as OnboardingStructuredPayload | null,
				legacySteps: [] as Array<{
					open_app_component?: string;
					button_label?: string;
				}>,
			};
		}
		const m = msg.metadata as {
			kind?: string;
			welcome_text?: unknown;
			thanks_text?: unknown;
			steps?: Array<{
				title?: string;
				body?: string;
				open_app_component?: string;
				button_label?: string;
			}>;
		};
		if (m.kind !== 'onboarding_instruction') {
			return { structured: null, legacySteps: [] };
		}
		if (
			typeof m.welcome_text === 'string' &&
			typeof m.thanks_text === 'string'
		) {
			return {
				structured: {
					welcome: m.welcome_text,
					thanks: m.thanks_text,
					steps: m.steps ?? [],
				},
				legacySteps: [],
			};
		}
		const legacySteps = (m.steps ?? []).filter((s) =>
			Boolean(s?.open_app_component)
		);
		return { structured: null, legacySteps };
	}, [isMine, msg.metadata]);

	const desktopAppLinkMeta = useMemo(
		() => getGafDesktopAppLinkMeta(msg.metadata),
		[msg.metadata]
	);
	const surveyAnnouncementMeta = useMemo(
		() => getGafSurveyAnnouncementMeta(msg.metadata),
		[msg.metadata]
	);

	const showOnboardingButtons =
		!isDeleted &&
		!onboardingMeta.structured &&
		onboardingMeta.legacySteps.length > 0 &&
		Boolean(gafDesktop);
	const showOnboardingDesktopHint =
		!isDeleted &&
		!gafDesktop &&
		(onboardingMeta.structured
			? onboardingMeta.structured.steps.some((s) =>
					Boolean((s.open_app_component ?? '').trim())
				)
			: onboardingMeta.legacySteps.length > 0);

	const bubbleBody = (
		<>
			{replyQuoteBlock}
			{attachmentBlock}
			{isDeleted ? (
				<span className="italic text-(--desktop-text-dim)">
					{t('messageDeleted')}
				</span>
			) : isMine ? (
				desktopAppLinkMeta ? (
					<GafChatDesktopAppLinkBlock
						messageId={msg.id}
						body={bodyStr}
						meta={desktopAppLinkMeta}
						highlightQuery={highlightQuery}
						plainShellClass={plainShellClass}
						bodyMarkdownProse={bodyMarkdownProse}
						gafDesktop={gafDesktop}
						t={t}
					/>
				) : showTextBody ? (
					renderedBody
				) : null
			) : onboardingMeta.structured ? (
				<GafChatOnboardingStructuredBody
					messageId={msg.id}
					data={onboardingMeta.structured}
					highlightQuery={highlightQuery}
					plainShellClass={plainShellClass}
					bodyMarkdownProse={bodyMarkdownProse}
					gafDesktop={gafDesktop}
					t={t}
				/>
			) : surveyAnnouncementMeta ? (
				<GafChatSurveyAnnouncementBlock
					body={bodyStr}
					meta={surveyAnnouncementMeta}
					highlightQuery={highlightQuery}
					plainShellClass={plainShellClass}
					bodyMarkdownProse={bodyMarkdownProse}
					gafDesktop={gafDesktop}
					t={t}
				/>
			) : desktopAppLinkMeta ? (
				<GafChatDesktopAppLinkBlock
					messageId={msg.id}
					body={bodyStr}
					meta={desktopAppLinkMeta}
					highlightQuery={highlightQuery}
					plainShellClass={plainShellClass}
					bodyMarkdownProse={bodyMarkdownProse}
					gafDesktop={gafDesktop}
					t={t}
				/>
			) : showTextBody ? (
				renderedBody
			) : null}
			{!isMine && showOnboardingButtons ? (
				<div className="mt-2 flex flex-wrap gap-1.5">
					{onboardingMeta.legacySteps.map((s) => (
						<DesktopAppButton
							key={`${msg.id}-leg-${String(s.open_app_component)}-${(s.button_label ?? '').slice(0, 48)}`}
							type="button"
							variant="neutral"
							size="sm"
							className="touch-manipulation"
							onClick={() =>
								gafDesktop?.openAppByComponent(String(s.open_app_component))
							}
						>
							{s.button_label?.trim() || t('onboardingOpenDefault')}
						</DesktopAppButton>
					))}
				</div>
			) : null}
			{!isMine && showOnboardingDesktopHint ? (
				<p
					className={cn(
						'mt-2 text-(--desktop-text-muted)',
						DESKTOP_TYPOGRAPHY.captionInherit
					)}
				>
					{t('onboardingDesktopOnlyHint')}
				</p>
			) : null}
		</>
	);

	return (
		<GafChatMessageListRow
			messageId={msg.id}
			isMine={isMine}
			isReadByPartner={isReadByPartner}
			partner={partner}
			footer={footer}
			bubbleOutgoingClass={bubbleOutgoingClass}
			bubbleIncomingClass={bubbleIncomingClass}
			lucideStroke={lucideStroke}
			t={t}
			videoCallEvent={videoCallEvent}
			legacyPostCallLabel={legacyPostCallLabel}
			showVideoCallRow={
				!isDeleted && Boolean(videoCallEvent || legacyPostCallLabel)
			}
			onMessageRowContextMenuCapture={onMessageRowContextMenuCapture}
			onBubblePointerDown={onBubblePointerDown}
			clearLongPressTimer={clearLongPressTimer}
			replyButton={replyButton}
			copyButton={copyButton}
			overflowMenu={overflowMenu}
			bubbleBody={bubbleBody}
		/>
	);
});
