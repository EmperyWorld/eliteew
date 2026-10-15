/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders relationship history and actionable empty-state shortcuts.
 *
 * Invariants:
 * - An empty history continues to offer chat and notes next actions.
 *
 * Related:
 * - ../../FriendPersonCard.tsx
 * ---
 */

import type { TFunction } from 'i18next';
import {
	ChatBubbleLeftRightIcon,
	ClockIcon,
	DocumentTextIcon,
} from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';

import type {
	FriendCardTimelineItem,
	FriendProfile,
} from '../friendPersonCardTypes';

type Props = {
	t: TFunction;
	friend: FriendProfile;
	items: FriendCardTimelineItem[];
	onOpenChat?: (friend: FriendProfile) => void;
	onSelectNotes: () => void;
};

export function FriendCardTimelineTab({
	t,
	friend,
	items,
	onOpenChat,
	onSelectNotes,
}: Props): JSX.Element {
	return (
		<div>
			<div className="flex items-center gap-2">
				<ClockIcon className="h-4 w-4 text-cyan-400" aria-hidden />
				<h4>{t('friends.personCardTimelineTitle')}</h4>
			</div>
			<div className="mt-4 space-y-3">
				{items.length === 0 ? (
					<DesktopAppEmptyState
						role="region"
						aria-label={t('friends.personCardTimelineEmptyTitle')}
						icon={
							<ClockIcon
								className="h-7 w-7 text-(--desktop-text-dim)"
								aria-hidden
							/>
						}
						title={t('friends.personCardTimelineEmptyTitle')}
						description={t('friends.personCardTimelineEmptyDescription')}
					>
						<div className="flex flex-wrap justify-center gap-2">
							{onOpenChat ? (
								<DesktopAppButton
									type="button"
									variant="accent"
									size="sm"
									onClick={() => onOpenChat(friend)}
								>
									<ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden />
									{t('friends.personCardTimelineChatAction')}
								</DesktopAppButton>
							) : null}
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={onSelectNotes}
							>
								<DocumentTextIcon className="h-4 w-4" aria-hidden />
								{t('friends.personCardTimelineNotesAction')}
							</DesktopAppButton>
						</div>
					</DesktopAppEmptyState>
				) : (
					items.map((item) => (
						<div key={item.id} className="rounded-xl border p-3">
							<div className="font-medium">{item.label}</div>
							<div className="text-xs">{item.value}</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
