/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal to start a new GAF Chat thread via friends list or username search.
 *
 * Invariants:
 * - Username is required before create; blocked friends cannot be picked.
 * - Search debounces at 300ms; results clear when query is empty.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 * - src/pages/Desktop/components/GAFChat/api/gafChatApi.ts
 */
import { FriendPicker } from '@/features/friends/components/FriendPicker';
import { useFriendsList } from '@/features/friends/hooks/useFriends';
import {
	ArrowPathIcon,
	MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { m } from 'framer-motion';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	DesktopAppInput,
	DesktopAppListRow,
	DesktopAppModalFrame,
	DesktopAppSectionLabel,
} from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import { GAFChatAvatar } from './GAFChatAvatar';

export type GAFChatNewChatModalProps = {
	onClose: () => void;
	onSelectChat: (chatId: string) => void;
	searchUsers: (
		q: string,
		limit?: number
	) => Promise<
		Array<{
			id: string;
			username: string | null;
			display_name: string | null;
			full_name: string | null;
			avatar_url: string | null;
		}>
	>;
	getOrCreateChatByUsername: (username: string) => Promise<{ chat_id: string }>;
	toast: { error: (m: string) => void };
};

export const GAFChatNewChatModal = memo(function GAFChatNewChatModal({
	onClose,
	onSelectChat,
	searchUsers: searchUsersFn,
	getOrCreateChatByUsername: getOrCreate,
	toast: toastFn,
}: GAFChatNewChatModalProps) {
	const { t } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;
	const [q, setQ] = useState('');
	const [results, setResults] = useState<
		Array<{
			id: string;
			username: string | null;
			display_name: string | null;
			full_name: string | null;
			avatar_url: string | null;
		}>
	>([]);
	const [loading, setLoading] = useState(false);
	const [creating, setCreating] = useState(false);
	const friendsQuery = useFriendsList();
	const friends = friendsQuery.data ?? [];

	useEffect(() => {
		if (!q.trim()) {
			setResults([]);
			return;
		}
		const timer = setTimeout(() => {
			setLoading(true);
			searchUsersFn(q, 20)
				.then((r) => setResults(Array.isArray(r) ? r : []))
				.finally(() => setLoading(false));
		}, 300);
		return () => clearTimeout(timer);
	}, [q, searchUsersFn]);

	const startChat = async (username: string | null) => {
		const normalizedUsername = username?.trim() || '';
		if (!normalizedUsername) {
			toastFn.error(t('modalNeedsUsername'));
			return;
		}
		setCreating(true);
		try {
			const { chat_id } = await getOrCreate(normalizedUsername);
			onSelectChat(chat_id);
		} catch (e: unknown) {
			toastFn.error(
				e instanceof Error ? e.message : t('modalCreateChatFailed')
			);
		} finally {
			setCreating(false);
		}
	};

	return (
		<DesktopAppModalFrame
			title={t('modalNewChatTitle')}
			onClose={onClose}
			className="max-w-md"
			onClick={(e) => e.stopPropagation()}
		>
			<m.div
				initial={{ opacity: 0, scale: 0.96 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.96 }}
				transition={{ duration: 0.2 }}
			>
				<div className="flex items-center gap-2 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/35 px-3 py-3">
					<MagnifyingGlassIcon
						className="h-4 w-4 shrink-0 text-(--desktop-text-muted)"
						aria-hidden
						strokeWidth={lucideStroke}
					/>
					<DesktopAppInput
						type="text"
						placeholder={t('modalSearchPlaceholder')}
						value={q}
						onChange={(e) => setQ(e.target.value)}
						className="min-w-0 flex-1 border-transparent bg-transparent py-2 shadow-none"
					/>
				</div>
				<div className="flex-1 overflow-y-auto p-2 min-h-0 space-y-4">
					<FriendPicker
						title={t('modalFriendsTitle')}
						friends={friends}
						loading={friendsQuery.isLoading}
						error={friendsQuery.error?.message ?? null}
						emptyMessage={t('modalNoFriends')}
						onPick={(friend) => void startChat(friend.username)}
						isPickDisabled={(friend) =>
							creating || !friend.username || Boolean(friend.is_blocked)
						}
						getHelperText={(friend) => {
							if (friend.is_blocked) {
								return t('friendBlockedHint');
							}
							if (!friend.username) {
								return t('friendNeedUsername');
							}
							if (friend.is_muted) {
								return t('friendMutedNotif');
							}
							const fn = friend.full_name?.trim();
							const un = friend.username.trim();
							if (fn && un && fn.toLowerCase() !== un.toLowerCase()) {
								return `@${un}`;
							}
							return null;
						}}
					/>
					<div>
						<div className="px-2 pb-1">
							<DesktopAppSectionLabel>
								{t('modalSearchSection')}
							</DesktopAppSectionLabel>
						</div>
						{loading && (
							<div
								className={cn(
									'flex items-center gap-2 px-2 pb-2 antialiased',
									DESKTOP_TYPOGRAPHY.bodyMuted
								)}
							>
								<ArrowPathIcon
									className="h-4 w-4 animate-spin motion-reduce:animate-none"
									aria-hidden
									strokeWidth={lucideStroke}
								/>{' '}
								{t('modalSearchLoading')}
							</div>
						)}
						{(results ?? []).map((u) => {
							const displayLabel =
								u.full_name || u.username || t('modalNoUsernameLabel');
							const rowTooltip = u.username?.trim()
								? `${displayLabel}\n@${u.username.trim()}`
								: displayLabel;
							return (
								<DesktopAppListRow
									key={u.id}
									type="button"
									onClick={() => startChat(u.username)}
									disabled={creating || !u.username}
									className="flex items-center gap-3"
								>
									<GAFChatAvatar
										avatarUrl={u.avatar_url ?? null}
										className="w-9 h-9 rounded-full object-cover shrink-0"
										alt=""
									/>
									<DesktopChromeTooltip
										content={rowTooltip}
										placement="top"
										offsetExtra={4}
									>
										<div className="min-w-0">
											<span
												className={cn(
													'block truncate font-medium text-(--desktop-text-primary)',
													DESKTOP_TYPOGRAPHY.body
												)}
											>
												{displayLabel}
											</span>
											{!u.username && (
												<span
													className={cn(
														'block truncate text-amber-300/90',
														DESKTOP_TYPOGRAPHY.captionInherit
													)}
												>
													{t('modalUsernameRequired')}
												</span>
											)}
										</div>
									</DesktopChromeTooltip>
								</DesktopAppListRow>
							);
						})}
					</div>
				</div>
			</m.div>
		</DesktopAppModalFrame>
	);
});
