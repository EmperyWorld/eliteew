/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Multi-select friend picker for starting or extending group video calls.
 *
 * Invariants:
 * - Locked participants (e.g. chat partner) are always included and cannot be toggled off.
 *
 * Related:
 * - GAFChatApp.tsx, VideoCallApp.tsx, api/videoCallApi.ts
 * - DesktopChromeTooltip.tsx
 */
import {
	FriendAvatar,
	getFriendDisplayName,
} from '@/features/friends/components/FriendAvatar';
import { useFriendsList } from '@/features/friends/hooks/useFriends';
import type { Friend } from '@/features/friends/types';
import { cn } from '@/utils/cn';
import { AnimatePresence, m } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppModalFrame,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	ArrowPathIcon,
	UsersIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export type VideoCallParticipantPickerModalProps = {
	open: boolean;
	onClose: () => void;
	onConfirm: (participantIds: string[]) => void;
	confirmLabel: string;
	title: string;
	description?: string;
	lockedParticipantIds?: string[];
	excludeParticipantIds?: string[];
	submitting?: boolean;
	minSelectable?: number;
};

export function VideoCallParticipantPickerModal({
	open,
	onClose,
	onConfirm,
	confirmLabel,
	title,
	description,
	lockedParticipantIds = [],
	excludeParticipantIds = [],
	submitting = false,
	minSelectable = 1,
}: VideoCallParticipantPickerModalProps) {
	const { t } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;
	const friendsQuery = useFriendsList({ enabled: open });
	const friends = friendsQuery.data ?? [];
	const lockedIds = useMemo(
		() => new Set(lockedParticipantIds.map((id) => id.trim()).filter(Boolean)),
		[lockedParticipantIds]
	);
	const excludedIds = useMemo(
		() => new Set(excludeParticipantIds.map((id) => id.trim()).filter(Boolean)),
		[excludeParticipantIds]
	);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(
		() => new Set(lockedIds)
	);

	useEffect(() => {
		if (!open) return;
		setSelectedIds(new Set(lockedIds));
	}, [open, lockedIds]);

	const selectableFriends = useMemo(
		() =>
			friends.filter(
				(friend) => !excludedIds.has(friend.id) && !lockedIds.has(friend.id)
			),
		[excludedIds, friends, lockedIds]
	);
	const lockedFriends = useMemo(
		() => friends.filter((friend) => lockedIds.has(friend.id)),
		[friends, lockedIds]
	);
	const additionalSelectedCount = useMemo(() => {
		let count = 0;
		for (const id of selectedIds) {
			if (!lockedIds.has(id)) count += 1;
		}
		return count;
	}, [lockedIds, selectedIds]);
	const canConfirm = additionalSelectedCount >= minSelectable && !submitting;

	const toggleFriend = useCallback(
		(friend: Friend) => {
			if (lockedIds.has(friend.id) || friend.is_blocked) return;
			setSelectedIds((prev) => {
				const next = new Set(prev);
				if (next.has(friend.id)) {
					next.delete(friend.id);
				} else {
					next.add(friend.id);
				}
				for (const lockedId of lockedIds) {
					next.add(lockedId);
				}
				return next;
			});
		},
		[lockedIds]
	);

	const handleConfirm = useCallback(() => {
		if (!canConfirm) return;
		const ids = Array.from(selectedIds).filter((id) => !lockedIds.has(id));
		onConfirm(ids);
	}, [canConfirm, lockedIds, onConfirm, selectedIds]);

	const renderFriendRow = (friend: Friend, locked: boolean) => {
		const checked = selectedIds.has(friend.id);
		const disabled = locked || Boolean(friend.is_blocked) || submitting;
		return (
			<label
				key={friend.id}
				className={cn(
					'flex cursor-pointer items-center gap-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-3',
					disabled && !locked
						? 'cursor-not-allowed opacity-60'
						: 'hover:bg-(--desktop-surface-elevated)'
				)}
			>
				<input
					type="checkbox"
					className="h-4 w-4 rounded border-white/20 bg-white/10"
					checked={checked}
					disabled={disabled}
					onChange={() => toggleFriend(friend)}
				/>
				<FriendAvatar
					avatarUrl={friend.avatar_url}
					username={friend.username}
					fullName={friend.full_name}
					className="h-9 w-9"
					alt={title}
				/>
				<div className="min-w-0 flex-1">
					<span className="block truncate text-sm font-medium text-(--desktop-text-primary)">
						{getFriendDisplayName(friend.username, friend.full_name)}
					</span>
					{locked ? (
						<span className="block truncate text-[11px] text-(--desktop-text-muted)">
							{t('videoCallGroupLockedParticipant')}
						</span>
					) : friend.is_blocked ? (
						<span className="block truncate text-[11px] text-amber-300">
							{t('friendBlockedHint')}
						</span>
					) : null}
				</div>
			</label>
		);
	};

	return (
		<AnimatePresence>
			{open ? (
				<m.div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
				>
					<m.div
						initial={{ opacity: 0, scale: 0.98, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.98, y: 8 }}
						className="flex max-h-[min(80vh,640px)] w-full max-w-md flex-col"
						onClick={(event) => event.stopPropagation()}
					>
						<DesktopAppModalFrame
							title={title}
							onClose={onClose}
							closeLabel={t('videoCallGroupPickerClose')}
							className="flex min-h-0 flex-1 flex-col"
						>
							<div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
								{description ? (
									<p className="text-xs text-(--desktop-text-secondary)">
										{description}
									</p>
								) : null}
								<div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
									{friendsQuery.isLoading ? (
										<div className="flex items-center justify-center py-8 text-(--desktop-text-muted)">
											<ArrowPathIcon
												className="mr-2 h-5 w-5 animate-spin"
												aria-hidden
												strokeWidth={lucideStroke}
											/>
											<span>{t('videoCallGroupPickerLoading')}</span>
										</div>
									) : lockedFriends.length === 0 &&
										selectableFriends.length === 0 ? (
										<DesktopAppEmptyState
											icon={<UsersIcon className="h-7 w-7" aria-hidden />}
											title={t('videoCallGroupPickerEmpty')}
											className="py-6"
										/>
									) : (
										<>
											{lockedFriends.map((friend) =>
												renderFriendRow(friend, true)
											)}
											{selectableFriends.map((friend) =>
												renderFriendRow(friend, false)
											)}
										</>
									)}
								</div>
								<div className="flex justify-end gap-2 border-t border-(--desktop-border-subtle)/60 pt-3">
									<DesktopChromeTooltip
										content={t('videoCallGroupPickerCancel')}
										placement="top"
										offsetExtra={4}
									>
										<DesktopAppButton
											type="button"
											variant="neutral"
											onClick={onClose}
											disabled={submitting}
										>
											<XMarkIcon className="h-4 w-4" aria-hidden />
											{t('videoCallGroupPickerCancel')}
										</DesktopAppButton>
									</DesktopChromeTooltip>
									<DesktopChromeTooltip
										content={confirmLabel}
										placement="top"
										offsetExtra={4}
									>
										<DesktopAppButton
											type="button"
											variant="accent"
											onClick={handleConfirm}
											disabled={!canConfirm}
										>
											{submitting ? (
												<ArrowPathIcon
													className="h-4 w-4 animate-spin"
													aria-hidden
													strokeWidth={lucideStroke}
												/>
											) : (
												<UsersIcon
													className="h-4 w-4"
													aria-hidden
													strokeWidth={lucideStroke}
												/>
											)}
											<span>{confirmLabel}</span>
										</DesktopAppButton>
									</DesktopChromeTooltip>
								</div>
							</div>
						</DesktopAppModalFrame>
					</m.div>
				</m.div>
			) : null}
		</AnimatePresence>
	);
}
