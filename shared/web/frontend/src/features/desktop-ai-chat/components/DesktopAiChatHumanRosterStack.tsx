/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stacked human participant avatars for Desktop AI Chat header/sidebar (mirrors AI hero stack chrome).
 *
 * Invariants:
 * - Max visible circles capped; overflow as +N chip.
 * - Uses SecureAvatar for profile URLs; initials fallback otherwise.
 *
 * Related:
 * - DesktopAiChatMainHeader.tsx, DesktopAiChatSidebar.tsx
 * - api/desktopChatClient.ts DesktopAiChatParticipant
 */
import { SecureAvatar } from '@/components/profile/SecureAvatar';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { DesktopAiChatParticipant } from '../api/desktopChatClient';
import { desktopAiChatAuthorInitials } from '../utils/desktopAiChatOwnUserMessage';

const DEFAULT_MAX = 4;

export type DesktopAiChatHumanRosterStackProps = {
	participants: readonly DesktopAiChatParticipant[];
	currentUserId?: string | null;
	/** Circle size class (header h-7, sidebar h-6). */
	sizeClass?: string;
	maxVisible?: number;
	className?: string;
	/** i18n label for self tooltip override. */
	youLabel?: string;
};

export function DesktopAiChatHumanRosterStack({
	participants,
	currentUserId,
	sizeClass = 'h-7 w-7',
	maxVisible = DEFAULT_MAX,
	className,
	youLabel = 'Вы',
}: DesktopAiChatHumanRosterStackProps) {
	if (!participants.length) return null;
	const visible = participants.slice(0, maxVisible);
	const overflow = participants.length - visible.length;
	const selfId = currentUserId?.trim() || '';

	return (
		<div className={cn('flex shrink-0 items-center pl-0.5', className)}>
			{visible.map((p, i) => {
				const isSelf = Boolean(selfId) && p.user_id === selfId;
				const tip = isSelf ? youLabel : p.display_name;
				return (
					<span
						key={p.user_id}
						className={['relative inline-flex', i > 0 ? '-ml-2' : ''].join(' ')}
						style={{ zIndex: i + 1 }}
					>
						<DesktopChromeTooltip content={tip} placement="top" offsetExtra={4}>
							<span
								className={cn(
									sizeClass,
									'shrink-0 overflow-hidden rounded-full border-2 border-[color-mix(in_srgb,var(--glass-bg-strong)_90%,#0a0520)] bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)]'
								)}
							>
								{p.avatar_url ? (
									<SecureAvatar
										avatarUrl={p.avatar_url}
										alt={tip}
										className="h-full w-full object-cover"
									/>
								) : (
									<span
										className={cn(
											'flex h-full w-full items-center justify-center font-semibold text-(--desktop-text-secondary)',
											DESKTOP_TYPOGRAPHY.captionInherit
										)}
									>
										{desktopAiChatAuthorInitials(p.display_name || '?')}
									</span>
								)}
							</span>
						</DesktopChromeTooltip>
					</span>
				);
			})}
			{overflow > 0 ? (
				<span
					className={cn(
						sizeClass,
						'-ml-2 inline-flex shrink-0 items-center justify-center rounded-full border-2 border-[color-mix(in_srgb,var(--glass-bg-strong)_90%,#0a0520)] bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.16)_100%,transparent)] text-[0.625rem] font-semibold text-(--desktop-text-secondary)'
					)}
					style={{ zIndex: visible.length + 1 }}
				>
					+{overflow}
				</span>
			) : null}
		</div>
	);
}
