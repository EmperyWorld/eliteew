/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Present the add-friend search flow and its explicit loading, error, and empty states.
 * Request mutations are delegated to the Friends Directory action hook.
 *
 * Invariants:
 * - Search calls remain paused until the user enters at least two characters.
 *
 * Related:
 * - ../FriendsDirectory.tsx
 * - ../../hooks/useFriendsDirectoryActions.ts
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	ArrowPathIcon,
	ChatBubbleLeftRightIcon,
	CheckIcon,
	UserPlusIcon,
	UsersIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import useDebounce from '@/hooks/useDebounce';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { UserAccountBadges } from '@/components/ui/UserAccountBadges';
import { cn } from '@/utils/cn';

import {
	getActivitySummary,
	getRelationshipFlagsSummary,
} from '../../utils/friendDirectoryFormat';
import type { Friend, FriendSearchCandidate } from '../../types';
import { useFriendSearch } from '../../hooks/useFriends';
import { FriendAvatar, getFriendDisplayName } from '../FriendAvatar';
import { FriendsInfoButton } from '../FriendsInfoButton';

interface FriendsDirectorySearchSectionProps {
	anchorPrefix: string;
	anonymousLabel: string;
	execute: <T>(
		run: () => Promise<T>,
		successMessage: string,
		afterSuccess?: () => void
	) => Promise<void>;
	localError: string | null;
	onOpenChat: (friend: Friend) => void;
	relationshipActions: {
		acceptRequest: {
			isPending: boolean;
			mutateAsync: (id: string) => Promise<unknown>;
		};
		cancelRequest: {
			isPending: boolean;
			mutateAsync: (id: string) => Promise<unknown>;
		};
		rejectRequest: { isPending: boolean };
		sendRequest: {
			isPending: boolean;
			mutateAsync: (username: string) => Promise<unknown>;
		};
		sendRequestToUser: {
			isPending: boolean;
			mutateAsync: (userId: string) => Promise<unknown>;
		};
	};
	shellField: string;
	shellInset: string;
	shellPanel: string;
}

export function FriendsDirectorySearchSection({
	anchorPrefix,
	anonymousLabel,
	execute,
	localError,
	onOpenChat,
	relationshipActions,
	shellField,
	shellInset,
	shellPanel,
}: FriendsDirectorySearchSectionProps): JSX.Element {
	const { t, i18n } = useTranslation('contentManager');
	const [value, setValue] = useState('');
	const normalized = value.trim();
	const searchQuery = useFriendSearch(useDebounce(normalized, 250), {
		enabled: normalized.length >= 2,
	});
	const candidates = searchQuery.data ?? [];
	const exactCandidate = useMemo(() => {
		const query = normalized.toLowerCase();
		return (
			candidates.find(
				(candidate) =>
					candidate.username?.trim().toLowerCase() === query ||
					candidate.full_name?.trim().toLowerCase() === query
			) ?? null
		);
	}, [candidates, normalized]);
	const formatter = useMemo(
		() =>
			new Intl.RelativeTimeFormat(
				i18n.resolvedLanguage || i18n.language || 'en',
				{
					numeric: 'auto',
				}
			),
		[i18n.language, i18n.resolvedLanguage]
	);
	const canSubmit =
		Boolean(normalized) &&
		(!exactCandidate || exactCandidate.relationshipStatus === 'can_send');
	const send = () => {
		void execute(
			() =>
				exactCandidate?.relationshipStatus === 'can_send'
					? relationshipActions.sendRequestToUser.mutateAsync(exactCandidate.id)
					: relationshipActions.sendRequest.mutateAsync(normalized),
			t('friends.requestSent', {
				nick: exactCandidate?.username?.trim() || normalized,
			}),
			() => setValue('')
		);
	};
	const renderAction = (
		candidate: FriendSearchCandidate
	): JSX.Element | null => {
		if (candidate.relationshipStatus === 'friend') {
			return candidate.username ? (
				<DesktopAppButton
					size="sm"
					variant="neutral"
					onClick={() => onOpenChat(candidate)}
				>
					<ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden />
					{t('friends.startChat')}
				</DesktopAppButton>
			) : null;
		}
		if (candidate.relationshipStatus === 'incoming_request') {
			return (
				<DesktopAppButton
					size="sm"
					variant="accent"
					disabled={
						!candidate.requestId ||
						relationshipActions.acceptRequest.isPending ||
						relationshipActions.rejectRequest.isPending
					}
					onClick={() =>
						candidate.requestId &&
						void execute(
							() =>
								relationshipActions.acceptRequest.mutateAsync(
									candidate.requestId as string
								),
							t('friends.requestAccepted')
						)
					}
				>
					<CheckIcon className="h-4 w-4" aria-hidden />
					{t('friends.accept')}
				</DesktopAppButton>
			);
		}
		if (candidate.relationshipStatus === 'outgoing_request') {
			return (
				<DesktopAppButton
					size="sm"
					variant="neutral"
					disabled={
						!candidate.requestId || relationshipActions.cancelRequest.isPending
					}
					onClick={() =>
						candidate.requestId &&
						void execute(
							() =>
								relationshipActions.cancelRequest.mutateAsync(
									candidate.requestId as string
								),
							t('friends.requestCancelled')
						)
					}
				>
					<XMarkIcon className="h-4 w-4" aria-hidden />
					{t('friends.cancelRequest')}
				</DesktopAppButton>
			);
		}
		return (
			<DesktopAppButton
				size="sm"
				variant="accent"
				disabled={relationshipActions.sendRequestToUser.isPending}
				onClick={() =>
					void execute(
						() =>
							relationshipActions.sendRequestToUser.mutateAsync(candidate.id),
						t('friends.requestSent', {
							nick: getFriendDisplayName(
								candidate.username,
								candidate.full_name,
								anonymousLabel
							),
						}),
						() => setValue('')
					)
				}
			>
				<UserPlusIcon className="h-4 w-4" aria-hidden />
				{t('friends.searchActionSend')}
			</DesktopAppButton>
		);
	};

	return (
		<div
			id={`${anchorPrefix}-search`}
			className={cn('min-h-0', shellPanel, 'p-5')}
		>
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<h3 className="flex items-center gap-2 text-sm font-medium text-slate-300">
						<UserPlusIcon className="h-4 w-4 text-cyan-400" aria-hidden />
						{t('friends.addTitle')}
					</h3>
					<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
						{t('friends.addHint')}
					</p>
				</div>
				<FriendsInfoButton
					title={t('friends.addTitle')}
					description={t('friends.helpAdd')}
				/>
			</div>
			<div className="flex flex-wrap gap-2">
				<input
					value={value}
					onChange={(event) => setValue(event.target.value)}
					placeholder={t('friends.usernamePlaceholder')}
					className={cn(
						shellField,
						'min-w-[220px] flex-1 rounded-xl px-3 py-2.5 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)'
					)}
					aria-label={t('friends.usernameAriaLabel')}
				/>
				<DesktopAppButton
					onClick={send}
					disabled={
						!canSubmit ||
						relationshipActions.sendRequest.isPending ||
						relationshipActions.sendRequestToUser.isPending
					}
					variant="accent"
				>
					{relationshipActions.sendRequest.isPending ||
					relationshipActions.sendRequestToUser.isPending ? (
						<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
					) : (
						<UserPlusIcon className="h-4 w-4" aria-hidden />
					)}
					{t('friends.addButton')}
				</DesktopAppButton>
			</div>
			{normalized ? (
				<div className={cn(shellInset, 'mt-4 overflow-hidden rounded-2xl')}>
					<div className="border-b border-(--desktop-border-subtle) px-4 py-3 text-sm text-(--desktop-text-secondary)">
						{t('friends.searchTitle')}
					</div>
					{normalized.length < 2 ? (
						<p className="p-4 text-sm text-(--desktop-text-muted)">
							{t('friends.searchMinChars')}
						</p>
					) : searchQuery.isLoading ? (
						<p className="flex gap-2 p-4 text-sm text-(--desktop-text-muted)">
							<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
							{t('friends.searchLoading')}
						</p>
					) : searchQuery.error ? (
						<p className="p-4 text-sm text-rose-300">
							{searchQuery.error.message}
						</p>
					) : candidates.length === 0 ? (
						<DesktopAppEmptyState
							className="py-8"
							icon={
								<UsersIcon
									className="h-6 w-6 text-(--desktop-text-dim)"
									aria-hidden
								/>
							}
							title={t('friends.searchEmptyTitle')}
							description={t('friends.searchEmptyDescription')}
						/>
					) : (
						<div className="space-y-2 p-3">
							{candidates.map((candidate) => (
								<div
									key={candidate.id}
									className={cn(
										shellPanel,
										'flex items-center justify-between gap-3 px-3 py-3'
									)}
								>
									<div className="flex min-w-0 items-center gap-3">
										<FriendAvatar
											avatarUrl={candidate.avatar_url}
											username={candidate.username}
											fullName={candidate.full_name}
											alt={t('friends.avatarAlt')}
											className="h-10 w-10"
										/>
										<div className="min-w-0">
											<div className="flex gap-1.5 truncate text-sm font-medium text-(--desktop-text-primary)">
												<span className="truncate">
													{getFriendDisplayName(
														candidate.username,
														candidate.full_name,
														anonymousLabel
													)}
												</span>
												<UserAccountBadges
													isTrusted={candidate.is_trusted}
													adminBadgeLabel={candidate.admin_badge_label}
													adminBadgeHint={candidate.admin_badge_hint}
													className="shrink-0"
												/>
											</div>
											<div className="truncate text-[11px] text-(--desktop-text-muted)">
												{[
													candidate.username &&
													candidate.full_name &&
													candidate.username.toLowerCase() !==
														candidate.full_name.toLowerCase()
														? `@${candidate.username}`
														: null,
													t(
														`friends.searchStatus${candidate.relationshipStatus === 'can_send' ? 'CanSend' : candidate.relationshipStatus === 'friend' ? 'Friend' : candidate.relationshipStatus === 'incoming_request' ? 'Incoming' : 'Outgoing'}`
													),
													...getRelationshipFlagsSummary(candidate, t),
													...getActivitySummary(candidate, formatter, t),
												]
													.filter(Boolean)
													.join(' · ')}
											</div>
										</div>
									</div>
									{renderAction(candidate)}
								</div>
							))}
						</div>
					)}
				</div>
			) : null}
			{localError ? (
				<p className="mt-3 text-sm text-rose-300">{localError}</p>
			) : null}
		</div>
	);
}
