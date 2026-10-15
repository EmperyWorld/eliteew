/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owner-only members panel: roster (pending + accepted), invite from friends, remove with confirm.
 * Friend/participant display names + SecureAvatar (avatarUrl prop); opaque dialog chrome over chat.
 *
 * Invariants:
 * - Only rendered when caller verified can_manage_members; API remains owner-only gate.
 *
 * Related:
 * - hooks/useDesktopAiChatCollab.ts, api/desktopChatClient.ts
 */
import { SecureAvatar } from '@/components/profile/SecureAvatar';
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import {
	inviteDesktopAiChatMember,
	listDesktopAiChatMembers,
	removeDesktopAiChatMember,
	type DesktopAiChatItem,
	type DesktopAiChatMember,
} from '../api/desktopChatClient';
import { listFriends } from '@/features/friends/api/friendsApi';
import type { Friend } from '@/features/friends/types';
import { useDesktopAiDialogFocusTrap } from '../useDesktopAiDialogFocusTrap';
import {
	ArrowPathIcon,
	UserMinusIcon,
	UserPlusIcon,
} from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
} from '../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

export type DesktopAiChatMembersPanelProps = {
	open: boolean;
	onClose: () => void;
	activeChat: DesktopAiChatItem | null;
	embeddedModalZ: { backdrop: number; content: number };
	onMembersChanged: () => void | Promise<void>;
	lucideStroke: number;
	t: TFunction<'desktopAiChat'>;
};

function friendLabel(f: Friend): string {
	return (f.full_name?.trim() || f.username?.trim() || f.id.slice(0, 8)).trim();
}

function memberDisplayName(
	userId: string,
	friendsById: Map<string, Friend>,
	participantsById: Map<
		string,
		{ display_name: string; avatar_url?: string | null }
	>
): { label: string; avatarUrl: string | null } {
	const friend = friendsById.get(userId);
	if (friend) {
		return {
			label: friendLabel(friend),
			avatarUrl: friend.avatar_url?.trim() || null,
		};
	}
	const participant = participantsById.get(userId);
	if (participant?.display_name?.trim()) {
		return {
			label: participant.display_name.trim(),
			avatarUrl: participant.avatar_url?.trim() || null,
		};
	}
	return { label: userId.slice(0, 8), avatarUrl: null };
}

export function DesktopAiChatMembersPanel({
	open,
	onClose,
	activeChat,
	embeddedModalZ,
	onMembersChanged,
	lucideStroke,
	t,
}: DesktopAiChatMembersPanelProps) {
	const dialogRef = React.useRef<HTMLDivElement>(null);
	useDesktopAiDialogFocusTrap(dialogRef, open);

	const [members, setMembers] = React.useState<DesktopAiChatMember[]>([]);
	const [friends, setFriends] = React.useState<Friend[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [inviteBusyId, setInviteBusyId] = React.useState<string | null>(null);
	const [removeTarget, setRemoveTarget] =
		React.useState<DesktopAiChatMember | null>(null);
	const [removeBusy, setRemoveBusy] = React.useState(false);

	const chatId = activeChat?.id ?? null;

	const refresh = React.useCallback(async () => {
		if (!chatId) return;
		setLoading(true);
		try {
			const [memberRows, friendRows] = await Promise.all([
				listDesktopAiChatMembers(chatId),
				listFriends(),
			]);
			setMembers(memberRows);
			setFriends(friendRows);
		} catch {
			toast.error(t('collabMembersLoadError'));
		} finally {
			setLoading(false);
		}
	}, [chatId, t]);

	React.useEffect(() => {
		if (open && chatId) {
			void refresh();
		}
	}, [open, chatId, refresh]);

	const memberUserIds = React.useMemo(
		() => new Set(members.map((m) => m.user_id)),
		[members]
	);

	const inviteCandidates = React.useMemo(
		() =>
			friends.filter(
				(f) =>
					!memberUserIds.has(f.id) &&
					f.id !== activeChat?.owner_user_id &&
					f.id !== activeChat?.user_id
			),
		[friends, memberUserIds, activeChat?.owner_user_id, activeChat?.user_id]
	);

	const friendsById = React.useMemo(() => {
		const map = new Map<string, Friend>();
		for (const f of friends) map.set(f.id, f);
		return map;
	}, [friends]);

	const participantsById = React.useMemo(() => {
		const map = new Map<
			string,
			{ display_name: string; avatar_url?: string | null }
		>();
		for (const p of activeChat?.participants ?? []) {
			map.set(p.user_id, {
				display_name: p.display_name,
				avatar_url: p.avatar_url,
			});
		}
		return map;
	}, [activeChat?.participants]);

	const handleInvite = async (friendUserId: string) => {
		if (!chatId) return;
		setInviteBusyId(friendUserId);
		try {
			await inviteDesktopAiChatMember(chatId, friendUserId);
			await refresh();
			await onMembersChanged();
			toast.success(t('collabInviteSentToast'));
		} catch {
			toast.error(t('collabInviteSendErrorToast'));
		} finally {
			setInviteBusyId(null);
		}
	};

	const handleRemoveConfirmed = async () => {
		if (!chatId || !removeTarget) return;
		setRemoveBusy(true);
		try {
			await removeDesktopAiChatMember(chatId, removeTarget.user_id);
			setRemoveTarget(null);
			await refresh();
			await onMembersChanged();
			toast.success(t('collabMemberRemovedToast'));
		} catch {
			toast.error(t('collabMemberRemoveErrorToast'));
		} finally {
			setRemoveBusy(false);
		}
	};

	if (!open) return null;

	const accepted = members.filter((m) => m.status === 'accepted');
	const pending = members.filter((m) => m.status === 'pending');

	return (
		<>
			<button
				type="button"
				className={DESKTOP_OVERLAY.backdrop}
				style={{ zIndex: embeddedModalZ.backdrop }}
				aria-label={t('collabMembersCloseAria')}
				onClick={() => {
					if (!removeBusy) onClose();
				}}
			/>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="desktop-ai-chat-members-title"
				className={cn(
					DESKTOP_OVERLAY.panelSurfaceStrong,
					'fixed left-1/2 top-1/2 w-[min(92vw,28rem)] max-h-[min(82vh,520px)] -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden text-(--desktop-text-primary)'
				)}
				style={{ zIndex: embeddedModalZ.content }}
				data-testid="desktop-ai-chat-members-panel"
			>
				<header className="flex items-start justify-between gap-2 border-b border-(--desktop-border-subtle) px-4 py-3">
					<div className="min-w-0">
						<h2
							id="desktop-ai-chat-members-title"
							className={cn(
								'font-semibold text-(--desktop-text-primary)',
								DESKTOP_TYPOGRAPHY.shellCopy13
							)}
						>
							{t('collabMembersTitle')}
						</h2>
						<p
							className={cn(
								'mt-0.5 truncate text-(--desktop-text-muted)',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
						>
							{activeChat?.title || t('defaultChatTitle')}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						disabled={removeBusy}
						className={cn(
							'shrink-0 rounded-lg px-2 py-1 text-(--desktop-text-muted) hover:text-(--desktop-text-primary)',
							DESKTOP_INTERACTIVE.btnRounded
						)}
					>
						{t('cancel')}
					</button>
				</header>
				<div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
					{loading ? (
						<div className="flex items-center gap-2 text-(--desktop-text-muted)">
							<ArrowPathIcon
								className="h-4 w-4 animate-spin motion-reduce:animate-none"
								strokeWidth={lucideStroke}
							/>
							<span className={DESKTOP_TYPOGRAPHY.shellMeta10}>
								{t('collabMembersLoading')}
							</span>
						</div>
					) : (
						<>
							<section>
								<h3
									className={cn(
										'mb-2 font-semibold uppercase tracking-wide text-(--desktop-text-muted)',
										DESKTOP_TYPOGRAPHY.micro
									)}
								>
									{t('collabMembersAcceptedHeading', {
										count: accepted.length,
									})}
								</h3>
								{accepted.length === 0 ? (
									<p
										className={cn(
											'text-(--desktop-text-muted)',
											DESKTOP_TYPOGRAPHY.shellMeta10
										)}
									>
										{t('collabMembersAcceptedEmpty')}
									</p>
								) : (
									<ul className="space-y-1">
										{accepted.map((m) => {
											const { label, avatarUrl } = memberDisplayName(
												m.user_id,
												friendsById,
												participantsById
											);
											return (
												<li
													key={m.id}
													className="flex items-center justify-between gap-2 rounded-lg border border-(--desktop-border-subtle) px-2 py-1.5"
												>
													<div className="flex min-w-0 items-center gap-2">
														<SecureAvatar
															avatarUrl={avatarUrl}
															alt=""
															className="h-7 w-7 shrink-0 rounded-full object-cover"
														/>
														<span
															className={cn(
																'truncate font-medium text-(--desktop-text-primary)',
																DESKTOP_TYPOGRAPHY.shellCopy13
															)}
														>
															{label}
														</span>
													</div>
													<button
														type="button"
														onClick={() => setRemoveTarget(m)}
														className={cn(
															'inline-flex items-center gap-1 rounded-md px-2 py-1 text-amber-200/90 hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)]',
															DESKTOP_TYPOGRAPHY.shellMeta10
														)}
														aria-label={t('collabRemoveMemberAria')}
													>
														<UserMinusIcon
															className="h-3.5 w-3.5"
															strokeWidth={lucideStroke}
														/>
														{t('collabRemoveMemberShort')}
													</button>
												</li>
											);
										})}
									</ul>
								)}
							</section>
							{pending.length > 0 ? (
								<section>
									<h3
										className={cn(
											'mb-2 font-semibold uppercase tracking-wide text-(--desktop-text-muted)',
											DESKTOP_TYPOGRAPHY.micro
										)}
									>
										{t('collabMembersPendingHeading', {
											count: pending.length,
										})}
									</h3>
									<ul className="space-y-1">
										{pending.map((m) => {
											const { label, avatarUrl } = memberDisplayName(
												m.user_id,
												friendsById,
												participantsById
											);
											return (
												<li
													key={m.id}
													className="flex items-center gap-2 rounded-lg border border-dashed border-(--desktop-border-subtle) px-2 py-1.5 text-(--desktop-text-muted)"
												>
													<SecureAvatar
														avatarUrl={avatarUrl}
														alt=""
														className="h-7 w-7 shrink-0 rounded-full object-cover opacity-80"
													/>
													<span
														className={cn(
															'truncate',
															DESKTOP_TYPOGRAPHY.shellMeta10
														)}
													>
														{t('collabMemberPendingLabel', {
															id: label,
														})}
													</span>
												</li>
											);
										})}
									</ul>
								</section>
							) : null}
							<section>
								<h3
									className={cn(
										'mb-2 font-semibold uppercase tracking-wide text-(--desktop-text-muted)',
										DESKTOP_TYPOGRAPHY.micro
									)}
								>
									{t('collabInviteHeading')}
								</h3>
								{inviteCandidates.length === 0 ? (
									<p
										className={cn(
											'text-(--desktop-text-muted)',
											DESKTOP_TYPOGRAPHY.shellMeta10
										)}
									>
										{t('collabInviteEmptyFriends')}
									</p>
								) : (
									<ul className="space-y-1 max-h-40 overflow-y-auto">
										{inviteCandidates.map((f) => (
											<li
												key={f.id}
												className="flex items-center justify-between gap-2 rounded-lg border border-(--desktop-border-subtle) px-2 py-1.5"
											>
												<div className="flex min-w-0 items-center gap-2">
													<SecureAvatar
														avatarUrl={f.avatar_url}
														alt=""
														className="h-7 w-7 shrink-0 rounded-full object-cover"
													/>
													<span
														className={cn(
															'truncate font-medium text-(--desktop-text-primary)',
															DESKTOP_TYPOGRAPHY.shellCopy13
														)}
													>
														{friendLabel(f)}
													</span>
												</div>
												<button
													type="button"
													disabled={inviteBusyId === f.id}
													onClick={() => void handleInvite(f.id)}
													className={cn(
														'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[rgb(var(--desktop-accent-rgb)/0.95)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.12)] disabled:opacity-50',
														DESKTOP_TYPOGRAPHY.shellMeta10
													)}
												>
													{inviteBusyId === f.id ? (
														<ArrowPathIcon
															className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
															strokeWidth={lucideStroke}
														/>
													) : (
														<UserPlusIcon
															className="h-3.5 w-3.5"
															strokeWidth={lucideStroke}
														/>
													)}
													{t('collabInviteFriendShort')}
												</button>
											</li>
										))}
									</ul>
								)}
							</section>
						</>
					)}
				</div>
			</div>
			{removeTarget ? (
				<>
					<button
						type="button"
						className={DESKTOP_OVERLAY.backdrop}
						style={{ zIndex: embeddedModalZ.content + 1 }}
						aria-hidden
						onClick={() => {
							if (!removeBusy) setRemoveTarget(null);
						}}
					/>
					<div
						role="alertdialog"
						aria-modal="true"
						className={cn(
							DESKTOP_OVERLAY.panelSurfaceStrong,
							'fixed left-1/2 top-1/2 w-[min(88vw,22rem)] -translate-x-1/2 -translate-y-1/2 p-4 text-(--desktop-text-primary)'
						)}
						style={{ zIndex: embeddedModalZ.content + 2 }}
					>
						<h3 className={cn('font-semibold', DESKTOP_TYPOGRAPHY.shellCopy13)}>
							{t('collabRemoveConfirmTitle')}
						</h3>
						<p
							className={cn(
								'mt-2 text-(--desktop-text-secondary) leading-relaxed',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
						>
							{t('collabRemoveConfirmBody')}
						</p>
						<div className="mt-4 flex justify-end gap-2">
							<DesktopAppButton
								type="button"
								variant="ghost"
								disabled={removeBusy}
								onClick={() => setRemoveTarget(null)}
							>
								{t('cancel')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="danger"
								disabled={removeBusy}
								onClick={() => void handleRemoveConfirmed()}
							>
								{removeBusy
									? t('collabRemoveConfirmLoading')
									: t('collabRemoveConfirmButton')}
							</DesktopAppButton>
						</div>
					</div>
				</>
			) : null}
		</>
	);
}
