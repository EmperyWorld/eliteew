/**
 * Virtualized message list + older-messages sentinel for GAF Chat.
 */
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { GAFChatMessageBubble } from './GAFChatMessageBubble';
import { LOAD_MORE_SENTINEL_HEIGHT_PX } from './gafChatMessageViewUtils';
import type { GafChatThreadPrefs } from './gafChatThreadPrefs';
import type { GAFChatListItem, GAFMessageItem } from './types';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

type GafThreadRow =
	| { kind: 'date'; key: string; label: string }
	| { kind: 'msg'; key: string; msg: GAFMessageItem };

export const GafChatVirtualizedThread = memo(function GafChatVirtualizedThread({
	messagesScrollRef,
	loadMoreSentinelRef,
	messageGroups,
	hasNextPage,
	isFetchingNextPage,
	messageOrder,
	partnerLastReadIndex,
	myUserId,
	partner,
	meLabel,
	threadSearchQuery,
	onCopyPlainText,
	activeChatId: _activeChatId,
	onAcceptAttachment,
	acceptBusyMessageId,
	onLoadOlder,
	messageById,
	onReply,
	onJumpToMessage,
	mediaPrefs,
	scrollToMessageId,
	onConsumedScrollToMessage,
	onEditMessage,
	onDeleteMessageForMe,
	onDeleteMessageForEveryone,
}: {
	messagesScrollRef: React.RefObject<HTMLDivElement | null>;
	loadMoreSentinelRef: React.RefObject<HTMLDivElement | null>;
	messageGroups: Array<{
		dateKey: string;
		label: string;
		messages: GAFMessageItem[];
	}>;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	messageOrder: Map<string, number>;
	partnerLastReadIndex: number;
	myUserId: string | null;
	partner: GAFChatListItem['partner'] | null | undefined;
	meLabel: string;
	threadSearchQuery: string;
	onCopyPlainText: (text: string) => void;
	activeChatId: string | null;
	onAcceptAttachment?: (m: GAFMessageItem) => void;
	acceptBusyMessageId?: string | null;
	/** Ручная подгрузка более старых сообщений (по кнопке). */
	onLoadOlder?: () => void;
	messageById?: Map<string, GAFMessageItem>;
	onReply?: (m: GAFMessageItem) => void;
	onJumpToMessage?: (messageId: string) => void;
	mediaPrefs?: GafChatThreadPrefs | null;
	/** Прокрутить к сообщению (ответ/цитата). */
	scrollToMessageId?: string | null;
	onConsumedScrollToMessage?: () => void;
	onEditMessage?: (m: GAFMessageItem) => void;
	onDeleteMessageForMe?: (m: GAFMessageItem) => void;
	onDeleteMessageForEveryone?: (m: GAFMessageItem) => void;
}) {
	const { t } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;
	const reduceMotion = useReducedMotion();
	const rows = useMemo(() => {
		const out: GafThreadRow[] = [];
		for (const g of messageGroups) {
			out.push({ kind: 'date', key: `d-${g.dateKey}`, label: g.label });
			for (const m of g.messages) {
				out.push({ kind: 'msg', key: m.id, msg: m });
			}
		}
		return out;
	}, [messageGroups]);

	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => messagesScrollRef.current,
		estimateSize: (index) => (rows[index]?.kind === 'date' ? 42 : 112),
		overscan: reduceMotion ? 4 : 6,
		getItemKey: (index) => rows[index]?.key ?? index,
	});
	const virtualizerRef = useRef(virtualizer);
	virtualizerRef.current = virtualizer;

	/** Прокрутка к процитированному сообщению. */
	useLayoutEffect(() => {
		if (!scrollToMessageId || rows.length === 0) return;
		const idx = rows.findIndex(
			(r) => r.kind === 'msg' && r.msg.id === scrollToMessageId
		);
		if (idx < 0) return;
		virtualizerRef.current.scrollToIndex(idx, { align: 'center' });
		requestAnimationFrame(() => {
			onConsumedScrollToMessage?.();
		});
	}, [scrollToMessageId, rows, onConsumedScrollToMessage]);

	const sentinelH = hasNextPage ? LOAD_MORE_SENTINEL_HEIGHT_PX : 0;

	return (
		<>
			{hasNextPage ? (
				<div
					ref={loadMoreSentinelRef}
					className={cn(
						'flex min-h-9 shrink-0 flex-col items-center justify-center gap-1 py-1',
						DESKTOP_TYPOGRAPHY.caption
					)}
				>
					<DesktopChromeTooltip
						content={t('loadOlderManual')}
						placement="top"
						offsetExtra={4}
					>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="touch-manipulation motion-safe:transition-[transform,box-shadow] motion-safe:duration-200 motion-reduce:transition-none motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.99]"
							disabled={isFetchingNextPage}
							onClick={() => onLoadOlder?.()}
							aria-label={t('loadOlderManualAria')}
						>
							{isFetchingNextPage ? (
								<ArrowPathIcon
									className="mr-1.5 h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
							) : null}
							{t('loadOlderManual')}
						</DesktopAppButton>
					</DesktopChromeTooltip>
				</div>
			) : null}
			<div
				className="relative min-h-0 w-full"
				style={{
					height: `${sentinelH + virtualizer.getTotalSize()}px`,
				}}
			>
				{virtualizer.getVirtualItems().map((vi) => {
					const row = rows[vi.index];
					if (!row) return null;
					const top = sentinelH + vi.start;
					const prevRow = vi.index > 0 ? rows[vi.index - 1] : undefined;
					const gapBetweenDays =
						row.kind === 'date' && prevRow != null && prevRow.kind === 'msg';
					const firstMsgAfterDate =
						row.kind === 'msg' && prevRow?.kind === 'date';
					if (row.kind === 'date') {
						return (
							<div
								key={row.key}
								data-index={vi.index}
								ref={virtualizer.measureElement}
								className={cn(
									'absolute top-0 left-0 w-full',
									gapBetweenDays && 'pt-4'
								)}
								style={{
									transform: `translateY(${top}px)`,
								}}
							>
								<div className="flex justify-center py-2">
									<span
										className={cn(
											DESKTOP_APP_STYLE_CONTRACT.counterBadge,
											'border border-(--desktop-border-subtle)/80 bg-[color-mix(in_srgb,var(--desktop-surface-panel)_94%,transparent)] px-3 py-1 font-semibold tracking-[0.06em] text-(--desktop-text-secondary)',
											DESKTOP_TYPOGRAPHY.captionInherit,
											'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--desktop-border-strong)_38%,transparent)]'
										)}
									>
										{row.label}
									</span>
								</div>
							</div>
						);
					}
					const m = row.msg;
					const isMine = myUserId != null && m.sender_id === myUserId;
					const isDeleted = isMine
						? m.deleted_for_sender
						: m.deleted_for_recipient;
					const isReadByPartner =
						isMine &&
						partnerLastReadIndex >= 0 &&
						(messageOrder.get(m.id) ?? Number.POSITIVE_INFINITY) <=
							partnerLastReadIndex;
					return (
						<div
							key={row.key}
							data-index={vi.index}
							ref={virtualizer.measureElement}
							className={cn(
								'absolute top-0 left-0 w-full',
								firstMsgAfterDate && 'mt-3'
							)}
							style={{
								transform: `translateY(${top}px)`,
							}}
						>
							<GAFChatMessageBubble
								msg={m}
								isMine={isMine}
								isDeleted={isDeleted}
								isReadByPartner={isReadByPartner}
								partner={partner ?? null}
								meLabel={meLabel}
								myUserId={myUserId}
								messageById={messageById}
								highlightQuery={threadSearchQuery}
								onCopyPlainText={onCopyPlainText}
								onAcceptAttachment={onAcceptAttachment}
								acceptBusyMessageId={acceptBusyMessageId ?? null}
								onReply={onReply}
								onJumpToMessage={onJumpToMessage}
								mediaPrefs={mediaPrefs ?? null}
								onEditMessage={onEditMessage}
								onDeleteMessageForMe={onDeleteMessageForMe}
								onDeleteMessageForEveryone={onDeleteMessageForEveryone}
							/>
						</div>
					);
				})}
			</div>
		</>
	);
});
