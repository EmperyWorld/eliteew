/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact reply quote strip above a message bubble with jump-to-original.
 *
 * Invariants:
 * - Click navigates to `replyToId` via parent `onJump`.
 *
 * Related:
 * - GAFChatMessageBubble.tsx, DesktopChromeTooltip.tsx
 */
import { getFriendDisplayName } from '@/features/friends/components/FriendAvatar';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { DesktopAppButton } from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import type { GAFChatListItem, GAFMessageItem } from '../types';
import { ArrowDownRightIcon } from '@heroicons/react/24/outline';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;

export function GafChatReplyQuote({
	replyToId,
	referenced,
	isMineBubble,
	myUserId,
	partner,
	onJump,
}: {
	replyToId: string;
	referenced: GAFMessageItem | undefined;
	isMineBubble: boolean;
	myUserId: string | null;
	partner: GAFChatListItem['partner'] | null;
	onJump: (messageId: string) => void;
}): JSX.Element {
	const { t } = useTranslation('gafChat');
	const snippet =
		referenced?.attachment_name?.trim() ||
		String(referenced?.body || '')
			.trim()
			.slice(0, 140) ||
		t('replyQuoteFallback');
	const authorLabel =
		referenced && myUserId
			? referenced.sender_id === myUserId
				? t('replyQuoteYou')
				: getFriendDisplayName(
						partner?.username ?? null,
						partner?.full_name ?? null,
						t('counterpartFallback')
					)
			: t('replyQuoteNotLoaded');

	const fullQuoteText =
		referenced?.attachment_name?.trim() ||
		String(referenced?.body || '').trim() ||
		snippet;
	const jumpLabel = t('replyJumpAria');

	return (
		<DesktopChromeTooltip
			content={fullQuoteText}
			placement="top"
			offsetExtra={4}
		>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={cn(
					'mb-1.5 h-auto w-full max-w-full justify-start gap-1.5 rounded-md border px-2 py-1 text-left',
					isMineBubble
						? 'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.08)]'
						: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80'
				)}
				onClick={() => onJump(replyToId)}
				aria-label={jumpLabel}
			>
				<ArrowDownRightIcon
					className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--desktop-text-muted)"
					aria-hidden
					strokeWidth={LUCIDE_SW}
				/>
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.shellMeta10,
							'mb-0.5 font-semibold text-[rgb(var(--desktop-accent-rgb)/0.95)]'
						)}
					>
						{authorLabel}
					</p>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'line-clamp-2 text-left leading-snug text-(--desktop-text-secondary)'
						)}
					>
						{snippet}
					</p>
				</div>
			</DesktopAppButton>
		</DesktopChromeTooltip>
	);
}
