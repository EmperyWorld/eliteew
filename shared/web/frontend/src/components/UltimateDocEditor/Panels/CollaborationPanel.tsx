/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Doc Editor collaboration side panel — invites, participants, activity (display only; join/leave owned by parent).
 *
 * Invariants:
 * - Closing the panel must not disconnect collaboration.
 * - Section headings stay sentence-case (collabPanelChrome tokens).
 *
 * Related:
 * - Panels/collabPanelChrome.ts
 * - documentation/product/DOC-EDITOR-COLLABORATION.md
 */

import { FriendPicker, useFriendsList, type Friend } from '@/features/friends';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import { useNotifications } from '@/notifications';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { apiClient } from '../../../services/api';
import { API_PATHS } from '../../../services/api/config';
import { SecureAvatar } from '../../profile/SecureAvatar';
import type { CollaborationPanelProps } from '../types/editor.types';
import type { DocEditorYjsConnectionStatus } from '../utils/docEditorYjsConnectionStatus';
import {
	collabInviteBlockedMessageKey,
	resolveCollabInviteBlockedReason,
} from './collabInviteBlockedReason';
import {
	DOC_EDITOR_COLLAB_BODY_CLASS,
	DOC_EDITOR_COLLAB_HEADER_CLASS,
	DOC_EDITOR_COLLAB_HEADER_ICON_CLASS,
	DOC_EDITOR_COLLAB_META_LABEL_CLASS,
	DOC_EDITOR_COLLAB_SECTION_CLASS,
	DOC_EDITOR_COLLAB_SECTION_TITLE_CLASS,
	DOC_EDITOR_COLLAB_SHELL_CLASS,
	DOC_EDITOR_COLLAB_STATUS_STRIP_CLASS,
	DOC_EDITOR_COLLAB_SUBTITLE_CLASS,
	DOC_EDITOR_COLLAB_TITLE_CLASS,
} from './collabPanelChrome';
import {
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	CheckIcon,
	EnvelopeIcon,
	ExclamationCircleIcon,
	SignalIcon,
	TrashIcon,
	UserCircleIcon,
	UserMinusIcon,
	UserPlusIcon,
	UsersIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

const DOC_EDITOR = API_PATHS.DOC_EDITOR;

/** Matches backend `doc_collab_invite_{invite_id}` notification ids (Socket.IO + center dismiss). */
function docCollabInviteNotificationId(inviteId: string): string {
	return `doc_collab_invite_${inviteId}`;
}

interface IncomingInvite {
	id: string;
	document_id: string;
	document_title: string;
	from_user_id: string;
	from_username: string | null;
	from_full_name: string | null;
	from_avatar_url: string | null;
	status: string;
	created_at: string;
}

interface SentInvite {
	id: string;
	to_user_id: string;
	to_username: string | null;
	to_full_name: string | null;
	to_avatar_url: string | null;
	status: string;
	created_at: string;
	/** Разрешено сохранять канонический документ (PUT / черновик на сервере) */
	allow_collaborators_save?: boolean;
}

/** Distinguish collaborators via accent/surface mixes (shell theme-safe). */
const USER_COLORS = [
	{
		bg: 'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_22%,var(--desktop-surface-soft))]',
		text: 'text-[var(--desktop-text-primary)]',
		border: 'border-[rgb(var(--desktop-accent-rgb))]/35',
	},
	{
		bg: 'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_92%,rgb(var(--desktop-accent-rgb))_8%)]',
		text: 'text-[var(--desktop-text-primary)]',
		border: 'border-[var(--desktop-border-strong)]',
	},
	{
		bg: 'bg-[var(--desktop-surface-soft)]',
		text: 'text-[var(--desktop-text-secondary)]',
		border: 'border-[rgb(var(--desktop-accent-rgb))]/25',
	},
	{
		bg: 'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,var(--desktop-surface-panel))]',
		text: 'text-[var(--desktop-text-primary)]',
		border: 'border-[var(--desktop-border-subtle)]',
	},
	{
		bg: 'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(var(--desktop-accent-rgb))_12%)]',
		text: 'text-[var(--desktop-text-primary)]',
		border: 'border-[rgb(var(--desktop-accent-rgb))]/28',
	},
	{
		bg: 'bg-[var(--desktop-surface-panel)]',
		text: 'text-[var(--desktop-text-secondary)]',
		border: 'border-[rgb(var(--desktop-accent-rgb))]/32',
	},
];

interface ActivityItem {
	id: string;
	type: 'join' | 'leave' | 'edit';
	username: string;
	timestamp: Date;
}

function yjsStatusBadgeClass(status: DocEditorYjsConnectionStatus): string {
	switch (status) {
		case 'synced':
			return 'border-[rgb(var(--desktop-accent-rgb))]/35 bg-[color-mix(in_srgb,var(--desktop-surface-accent)_50%,transparent)] text-(--desktop-text-primary)';
		case 'offline':
			return 'border-red-400/35 bg-red-500/15 text-red-100';
		case 'reconnecting':
			return 'border-amber-400/35 bg-amber-500/15 text-amber-100';
		default:
			return 'border-(--desktop-border-strong) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)';
	}
}

function yjsStatusLabelKey(
	status: DocEditorYjsConnectionStatus
): string | null {
	switch (status) {
		case 'synced':
			return 'collab.connection.yjsSynced';
		case 'connecting':
			return 'collab.connection.yjsConnecting';
		case 'reconnecting':
			return 'collab.connection.yjsReconnecting';
		case 'offline':
			return 'collab.connection.yjsOffline';
		default:
			return null;
	}
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
	isOpen,
	onClose,
	documentId,
	collaborators,
	isConnected: isConnectedProp,
	connectionError,
	yjsConnectionStatus = 'idle',
	onAcceptInvite,
	canSendInvites = false,
	isDocumentOwner = false,
	mySocketId = null,
	onKickParticipant,
}) => {
	const { t } = useTranslation('docEditorPanels');
	const isConnected = isConnectedProp ?? false;
	const error = connectionError;
	const yjsStatusLabel = yjsStatusLabelKey(yjsConnectionStatus);
	const inviteBlockedReason = resolveCollabInviteBlockedReason({
		canSendInvites,
		isDocumentOwner,
	});
	const inviteBlockedMessageKey =
		collabInviteBlockedMessageKey(inviteBlockedReason);
	const { success, error: showError, dismiss } = useNotifications();
	const docSidePanelZ = useDocEditorSidePanelZIndex();
	const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
	const [linkCopied, setLinkCopied] = useState(false);
	const [pendingInvites, setPendingInvites] = useState<IncomingInvite[]>([]);
	const [pendingInvitesLoading, setPendingInvitesLoading] = useState(false);
	const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
	const [sentInvitesLoading, setSentInvitesLoading] = useState(false);
	const [acceptingId, setAcceptingId] = useState<string | null>(null);
	const [decliningId, setDecliningId] = useState<string | null>(null);
	/** При отправке приглашения: можно ли соавтору сохранять документ владельца (по умолчанию нет). */
	const [inviteAllowCollaboratorsSave, setInviteAllowCollaboratorsSave] =
		useState(false);

	const shareUrl = documentId
		? `${window.location.origin}/?doc=${documentId}`
		: '';
	const friendsQuery = useFriendsList({ enabled: isOpen });
	const friends = friendsQuery.data ?? [];
	const friendsLoading = friendsQuery.isLoading;
	const friendsError = friendsQuery.error?.message ?? null;

	const loadPendingInvites = useCallback(async (): Promise<void> => {
		setPendingInvitesLoading(true);
		try {
			const res = await apiClient.get<IncomingInvite[]>(
				`${DOC_EDITOR}/invites`
			);
			setPendingInvites(Array.isArray(res.data) ? res.data : []);
		} catch {
			setPendingInvites([]);
		} finally {
			setPendingInvitesLoading(false);
		}
	}, []);

	const loadSentInvites = useCallback(async (): Promise<void> => {
		if (!documentId) {
			setSentInvites([]);
			return;
		}
		setSentInvitesLoading(true);
		try {
			const res = await apiClient.get<SentInvite[]>(
				`${DOC_EDITOR}/documents/${documentId}/invites`
			);
			setSentInvites(Array.isArray(res.data) ? res.data : []);
		} catch {
			setSentInvites([]);
		} finally {
			setSentInvitesLoading(false);
		}
	}, [documentId]);

	useEffect(() => {
		if (isOpen) {
			loadPendingInvites();
		}
	}, [isOpen, loadPendingInvites]);

	useEffect(() => {
		if (isOpen && documentId) {
			loadSentInvites();
		} else {
			setSentInvites([]);
		}
	}, [isOpen, documentId, loadSentInvites]);

	const handleAcceptInvite = useCallback(
		async (invite: IncomingInvite) => {
			setAcceptingId(invite.id);
			try {
				const res = await apiClient.post<{ document_id: string }>(
					`${DOC_EDITOR}/invites/${invite.id}/accept`
				);
				const docId = res.data?.document_id;
				if (docId && onAcceptInvite) {
					onAcceptInvite(docId);
					setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
					dismiss(docCollabInviteNotificationId(invite.id));
					success(
						t('collab.toasts.inviteAcceptedTitle'),
						t('collab.toasts.inviteAcceptedBody')
					);
				}
			} catch (err) {
				const msg =
					err instanceof Error
						? err.message
						: t('collab.errors.acceptInviteFailed');
				showError(t('collab.errors.genericTitle'), msg);
			} finally {
				setAcceptingId(null);
			}
		},
		[onAcceptInvite, success, showError, dismiss, t]
	);

	const handleDeclineInvite = useCallback(
		async (invite: IncomingInvite) => {
			setDecliningId(invite.id);
			try {
				await apiClient.post(`${DOC_EDITOR}/invites/${invite.id}/decline`);
				setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
				dismiss(docCollabInviteNotificationId(invite.id));
				success(t('collab.toasts.inviteDeclinedTitle'), '');
			} catch (err) {
				const msg =
					err instanceof Error
						? err.message
						: t('collab.errors.declineInviteFailed');
				showError(t('collab.errors.genericTitle'), msg);
			} finally {
				setDecliningId(null);
			}
		},
		[success, showError, dismiss, t]
	);

	const handleSendInvite = useCallback(
		async (friend: Friend) => {
			if (!documentId) {
				showError(
					t('collab.errors.noDocumentTitle'),
					t('collab.errors.noDocumentBody')
				);
				return;
			}
			if (friend.is_blocked) {
				showError(
					t('collab.errors.contactBlockedTitle'),
					t('collab.errors.contactBlockedBody')
				);
				return;
			}
			try {
				await apiClient.post(`${DOC_EDITOR}/documents/${documentId}/invites`, {
					to_user_id: friend.id,
					allow_collaborators_save: inviteAllowCollaboratorsSave,
				});
				await loadSentInvites();
				setInviteAllowCollaboratorsSave(false);
				const name =
					friend.username?.trim() ||
					friend.full_name?.trim() ||
					t('collab.inviteFriends.friendFallback');
				success(
					t('collab.toasts.inviteSentTitle'),
					t('collab.toasts.inviteSentBody', { name })
				);
			} catch (err) {
				const msg =
					err instanceof Error
						? err.message
						: t('collab.errors.sendInviteFailed');
				showError(t('collab.errors.genericTitle'), msg);
			}
		},
		[
			documentId,
			loadSentInvites,
			success,
			showError,
			inviteAllowCollaboratorsSave,
			t,
		]
	);

	const handleRevokeInvite = useCallback(
		async (invite: SentInvite) => {
			try {
				await apiClient.delete(`${DOC_EDITOR}/invites/${invite.id}`);
				await loadSentInvites();
				success(t('collab.toasts.inviteRevokedTitle'), '');
			} catch (err) {
				const msg =
					err instanceof Error
						? err.message
						: t('collab.errors.revokeInviteFailed');
				showError(t('collab.errors.genericTitle'), msg);
			}
		},
		[loadSentInvites, success, showError, t]
	);

	// Close on Escape
	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				onClose();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen, onClose]);

	// Connection (join/leave) is managed in the document header; closing the panel does not disconnect.

	// Track collaborator changes
	useEffect(() => {
		// Add activity for new collaborators
		const existingIds = new Set(activityFeed.map((a) => a.id));

		collaborators.forEach((collab) => {
			if (!existingIds.has(collab.user_id)) {
				const newActivity: ActivityItem = {
					id: collab.user_id,
					type: 'join',
					username: collab.username,
					timestamp: new Date(),
				};
				setActivityFeed((prev) => [newActivity, ...prev].slice(0, 20));
			}
		});
	}, [collaborators, activityFeed]);

	const handleShareLink = useCallback((): void => {
		if (!shareUrl) return;
		navigator.clipboard.writeText(shareUrl);
		setLinkCopied(true);
		success(
			t('collab.toasts.linkCopiedTitle'),
			t('collab.toasts.linkCopiedBody')
		);
		setTimeout(() => setLinkCopied(false), 2000);
	}, [shareUrl, success, t]);

	const isInvited = useCallback(
		(friendId: string) => sentInvites.some((s) => s.to_user_id === friendId),
		[sentInvites]
	);
	const getSentInvite = useCallback(
		(friendId: string) => sentInvites.find((s) => s.to_user_id === friendId),
		[sentInvites]
	);

	const getColorForUser = (index: number): (typeof USER_COLORS)[number] => {
		const color = USER_COLORS[index % USER_COLORS.length];
		if (color) {
			return color;
		}
		// Fallback to first color (should never happen as USER_COLORS is non-empty)
		return USER_COLORS[0] as (typeof USER_COLORS)[number];
	};

	const formatTime = useCallback(
		(date: Date): string => {
			const now = new Date();
			const diff = now.getTime() - date.getTime();
			const seconds = Math.floor(diff / 1000);
			const minutes = Math.floor(seconds / 60);
			const hours = Math.floor(minutes / 60);

			if (hours > 0) {
				return t('collab.relative.hoursAgo', { count: hours });
			}
			if (minutes > 0) {
				return t('collab.relative.minutesAgo', { count: minutes });
			}
			if (seconds > 10) {
				return t('collab.relative.secondsAgo', { count: seconds });
			}
			return t('collab.relative.justNow');
		},
		[t]
	);

	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			role="dialog"
			aria-modal="true"
			aria-labelledby="collab-panel-title"
			initial={{ opacity: 0, x: 100 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 100 }}
			transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as const }}
			className={DOC_EDITOR_COLLAB_SHELL_CLASS}
			style={{ zIndex: docSidePanelZ }}
		>
			{/* Header — shared chrome typography with other doc editor panels */}
			<div className={DOC_EDITOR_COLLAB_HEADER_CLASS}>
				<div className="flex items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2.5">
						<div className={DOC_EDITOR_COLLAB_HEADER_ICON_CLASS}>
							<UsersIcon width={16} height={16} aria-hidden />
						</div>
						<div className="min-w-0">
							<h3
								id="collab-panel-title"
								className={DOC_EDITOR_COLLAB_TITLE_CLASS}
							>
								{t('collab.title')}
							</h3>
							<p className={DOC_EDITOR_COLLAB_SUBTITLE_CLASS}>
								{t('collab.subtitle')}
							</p>
						</div>
					</div>
					<DesktopAppButton
						type="button"
						onClick={onClose}
						variant="ghost"
						size="icon"
						title={t('collab.close')}
						aria-label={t('collab.close')}
						className="min-h-11 min-w-11"
					>
						<XMarkIcon width={18} height={18} />
					</DesktopAppButton>
				</div>
			</div>

			{/* Connection Status */}
			<div className={DOC_EDITOR_COLLAB_STATUS_STRIP_CLASS}>
				<span className="relative inline-flex h-2 w-2 shrink-0">
					<span
						className={`absolute inset-0 rounded-full ${isConnected ? 'bg-[rgb(var(--desktop-accent-rgb))]' : 'bg-(--desktop-text-dim)'} animate-pulse`}
						aria-hidden
					/>
					<span className="sr-only">
						{isConnected
							? t('collab.connection.srOnlyConnected')
							: t('collab.connection.srOnlyConnecting')}
					</span>
				</span>
				<DesktopAppStatusBadge
					className={
						isConnected
							? 'border-[rgb(var(--desktop-accent-rgb))]/35 bg-[color-mix(in_srgb,var(--desktop-surface-accent)_50%,transparent)] text-(--desktop-text-primary)'
							: 'border-(--desktop-border-strong) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)'
					}
				>
					{isConnected
						? t('collab.connection.badgeConnected')
						: t('collab.connection.badgeConnecting')}
				</DesktopAppStatusBadge>
				{yjsStatusLabel ? (
					<DesktopAppStatusBadge
						className={yjsStatusBadgeClass(yjsConnectionStatus)}
					>
						{t(yjsStatusLabel)}
					</DesktopAppStatusBadge>
				) : null}
			</div>

			{/* Error */}
			{error && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-red-400/25 bg-red-500/15 px-3 py-2 text-sm text-red-100/95"
					role="alert"
				>
					<ExclamationCircleIcon
						width={16}
						height={16}
						className="mt-0.5 shrink-0 text-red-300/90"
						aria-hidden
					/>
					<span>{error}</span>
				</motion.div>
			)}

			<div className={DOC_EDITOR_COLLAB_BODY_CLASS}>
				{/* Входящие приглашения */}
				<div className={DOC_EDITOR_COLLAB_SECTION_CLASS}>
					<h4 className={DOC_EDITOR_COLLAB_SECTION_TITLE_CLASS}>
						<EnvelopeIcon
							width={16}
							height={16}
							className="text-[rgb(var(--desktop-accent-rgb)/0.9)]"
						/>
						{t('collab.incoming.heading')}
					</h4>
					{pendingInvitesLoading ? (
						<div className="flex items-center gap-2 py-3 text-sm text-(--desktop-text-dim)">
							<ArrowPathIcon width={16} height={16} className="animate-spin" />
							{t('collab.incoming.loading')}
						</div>
					) : pendingInvites.length === 0 ? (
						<DesktopAppPanel className="border-dashed bg-transparent px-3 py-4">
							<DesktopAppEmptyState
								icon={
									<EnvelopeIcon
										width={24}
										height={24}
										className="mx-auto text-(--desktop-text-muted)"
									/>
								}
								title={t('collab.incoming.emptyTitle')}
								description={t('collab.incoming.emptyDescription')}
								className="py-1"
							/>
						</DesktopAppPanel>
					) : (
						<div className="space-y-2">
							{pendingInvites.map((inv) => {
								const fromName =
									inv?.from_username ??
									inv?.from_full_name ??
									t('collab.incoming.userFallback');
								const initial = String(fromName).charAt(0).toUpperCase() || '?';
								return (
									<div
										key={inv.id}
										className="flex flex-col gap-2 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3"
									>
										<div className="flex items-center gap-2">
											{inv.from_avatar_url ? (
												<SecureAvatar
													avatarUrl={inv.from_avatar_url}
													className="w-8 h-8 rounded-full object-cover shrink-0"
													alt=""
												/>
											) : (
												<div className="w-8 h-8 rounded-full bg-amber-500/30 border border-amber-400/30 flex items-center justify-center text-amber-300 text-sm font-semibold shrink-0">
													{initial}
												</div>
											)}
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium text-(--desktop-text-primary)">
													{fromName}
												</p>
												<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'truncate')}>
													{t('collab.incoming.documentLabel', {
														title:
															inv.document_title?.trim() ||
															t('collab.incoming.untitled'),
													})}
												</p>
											</div>
										</div>
										<div className="flex gap-2">
											<DesktopAppButton
												type="button"
												disabled={acceptingId !== null}
												onClick={() => handleAcceptInvite(inv)}
												variant="accent"
												size="sm"
												className="flex-1 gap-1.5"
											>
												{acceptingId === inv.id ? (
													<ArrowPathIcon
														width={14}
														height={14}
														className="animate-spin"
													/>
												) : (
													<CheckIcon width={14} height={14} />
												)}
												{t('collab.incoming.accept')}
											</DesktopAppButton>
											<DesktopAppButton
												type="button"
												disabled={decliningId !== null}
												onClick={() => handleDeclineInvite(inv)}
												variant="neutral"
												size="sm"
												className="flex-1 gap-1.5"
											>
												{decliningId === inv.id ? (
													<ArrowPathIcon
														width={14}
														height={14}
														className="animate-spin"
													/>
												) : (
													t('collab.incoming.decline')
												)}
											</DesktopAppButton>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Share Button */}
				<div className="border-b border-(--desktop-border-subtle)/70 p-3">
					<DesktopAppButton
						type="button"
						onClick={handleShareLink}
						disabled={!shareUrl}
						variant="accent"
						className="w-full gap-2 py-2.5 font-medium"
					>
						{linkCopied ? (
							<>
								<CheckIcon width={16} height={16} />
								<span>{t('collab.share.copied')}</span>
							</>
						) : (
							<>
								<ArrowTopRightOnSquareIcon width={16} height={16} />
								<span>{t('collab.share.copyLink')}</span>
							</>
						)}
					</DesktopAppButton>
					<p
						className={cn(DOC_EDITOR_COLLAB_SUBTITLE_CLASS, 'mt-2 text-center')}
					>
						{t('collab.share.hint')}
					</p>
				</div>

				{/* Invite friends — совместная работа с друзьями */}
				<div className={DOC_EDITOR_COLLAB_SECTION_CLASS}>
					<h4 className={cn(DOC_EDITOR_COLLAB_SECTION_TITLE_CLASS, 'mb-1')}>
						<UserCircleIcon
							width={16}
							height={16}
							className="text-[rgb(var(--desktop-accent-rgb)/0.9)]"
						/>
						{t('collab.inviteFriends.heading')}
					</h4>
					{!documentId ? (
						<p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-2 text-xs text-amber-200/90">
							{t('collab.inviteFriends.needOpenDoc')}
						</p>
					) : (
						<>
							<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mb-3')}>
								{t('collab.inviteFriends.intro')}
							</p>
							<label
								className={cn(
									'mb-3 flex items-start gap-2 rounded-lg border border-[rgb(var(--desktop-accent-rgb))]/20 bg-(--desktop-surface-soft)/50 px-3 py-2 text-xs text-(--desktop-text-secondary)',
									canSendInvites
										? 'cursor-pointer'
										: 'cursor-not-allowed opacity-60'
								)}
							>
								<input
									type="checkbox"
									className="mt-0.5"
									disabled={!canSendInvites}
									checked={inviteAllowCollaboratorsSave}
									onChange={(e) =>
										setInviteAllowCollaboratorsSave(e.target.checked)
									}
								/>
								<span>
									<span className="font-medium text-(--desktop-text-primary)">
										{t('collab.inviteFriends.allowSaveLabel')}
									</span>{' '}
									{t('collab.inviteFriends.allowSaveHint')}
								</span>
							</label>
							{inviteBlockedMessageKey ? (
								<p className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-xs text-(--desktop-text-secondary)">
									{t(inviteBlockedMessageKey)}
								</p>
							) : null}
							{friendsLoading || sentInvitesLoading ? (
								<div className="flex items-center justify-center gap-2 py-4 text-(--desktop-text-dim)">
									<ArrowPathIcon
										width={18}
										height={18}
										className="animate-spin"
									/>
									<span>{t('collab.incoming.loading')}</span>
								</div>
							) : friends.length === 0 ? (
								<DesktopAppPanel className="border-dashed bg-transparent px-3 py-4">
									<DesktopAppEmptyState
										icon={
											<UsersIcon
												width={24}
												height={24}
												className="mx-auto text-(--desktop-text-muted)"
											/>
										}
										title={t('collab.inviteFriends.noFriendsTitle')}
										description={t('collab.inviteFriends.noFriendsDescription')}
										className="py-1"
									/>
								</DesktopAppPanel>
							) : (
								<FriendPicker
									title={t('collab.inviteFriends.friendsListTitle')}
									friends={friends}
									loading={friendsLoading}
									error={friendsError}
									emptyMessage={t('collab.inviteFriends.friendPickerEmpty')}
									className="max-h-48 overflow-y-auto custom-scrollbar"
									getHelperText={(friend) => {
										if (friend.is_blocked) {
											return t('collab.inviteFriends.helperBlocked');
										}
										if (friend.is_muted) {
											return t('collab.inviteFriends.helperMuted');
										}
										const fn = friend.full_name?.trim();
										const un = friend.username?.trim();
										if (fn && un && fn.toLowerCase() !== un.toLowerCase()) {
											return `@${un}`;
										}
										return null;
									}}
									renderAction={(friend) => {
										const invited = isInvited(friend.id);
										const sentInvite = getSentInvite(friend.id);
										return invited && sentInvite ? (
											<DesktopAppButton
												type="button"
												onClick={() => handleRevokeInvite(sentInvite)}
												disabled={!canSendInvites}
												variant="danger"
												size="sm"
												className="min-h-10 shrink-0 gap-1"
												title={
													inviteBlockedMessageKey
														? t(inviteBlockedMessageKey)
														: undefined
												}
											>
												<TrashIcon width={12} height={12} />
												{t('collab.inviteFriends.revoke')}
											</DesktopAppButton>
										) : (
											<DesktopAppButton
												type="button"
												onClick={() => handleSendInvite(friend)}
												disabled={
													!documentId ||
													Boolean(friend.is_blocked) ||
													!canSendInvites
												}
												variant="accent"
												size="sm"
												className="min-h-10 shrink-0 gap-1"
												title={
													inviteBlockedMessageKey
														? t(inviteBlockedMessageKey)
														: undefined
												}
											>
												<UserPlusIcon width={12} height={12} />
												{canSendInvites
													? t('collab.inviteFriends.invite')
													: inviteBlockedReason === 'owner'
														? t('collab.inviteFriends.ownerOnly')
														: t('collab.inviteFriends.connectFirst')}
											</DesktopAppButton>
										);
									}}
								/>
							)}
						</>
					)}
				</div>

				{/* Active Collaborators */}
				<div className={cn(DOC_EDITOR_COLLAB_SECTION_CLASS, 'shrink-0')}>
					<div className="mb-2 flex items-center justify-between">
						<h4 className={DOC_EDITOR_COLLAB_META_LABEL_CLASS}>
							<UsersIcon
								width={14}
								height={14}
								className="shrink-0"
								aria-hidden
							/>
							{t('collab.participantsHeading')} ({collaborators.length})
						</h4>
					</div>

					{collaborators.length > 0 ? (
						<div className="max-h-52 min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
							{collaborators.map((collab, index) => {
								const color = getColorForUser(index);
								const rawName = collab?.username?.trim();
								const displayName =
									rawName && rawName.length > 0
										? rawName
										: t('collab.participantFallback');
								const initial =
									String(displayName).charAt(0).toUpperCase() || '?';
								const isEditing = Boolean(collab.cursor_position);
								const line =
									(collab.cursor_position as { line?: number } | undefined)
										?.line ?? null;
								const statusLabel = isEditing
									? line != null
										? t('collab.statusEditingLine', { block: line })
										: t('collab.statusEditing')
									: t('collab.statusInDoc');
								return (
									<motion.div
										key={collab.user_id}
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ duration: 0.2 }}
										className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${color.bg} ${color.border} backdrop-blur-xl`}
									>
										<div
											className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--desktop-surface-app) text-sm font-bold leading-none ${color.text}`}
										>
											{initial}
										</div>
										<div className="min-w-0 flex-1">
											<div className="wrap-break-word text-sm font-semibold leading-snug text-(--desktop-text-primary)">
												{displayName}
											</div>
										</div>
										<div className="flex shrink-0 items-center gap-1.5">
											{line != null ? (
												<span
													className="whitespace-nowrap text-[11px] text-(--desktop-text-dim)"
													title={t('collab.cursorBlockTitle')}
												>
													{t('collab.cursorBlockShort', { block: line })}
												</span>
											) : null}
											<span
												className="inline-flex items-center gap-1.5"
												title={statusLabel}
											>
												<span
													className={`h-2 w-2 rounded-full ${isEditing ? 'bg-[rgb(var(--desktop-accent-rgb))]' : 'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_65%,var(--desktop-text-dim))]'} ${isEditing ? 'animate-pulse' : ''}`}
													aria-hidden
												/>
												<span className="sr-only">{statusLabel}</span>
											</span>
											{isDocumentOwner &&
											onKickParticipant &&
											mySocketId &&
											collab.user_id !== mySocketId ? (
												<DesktopAppButton
													type="button"
													variant="ghost"
													size="sm"
													className="h-8 min-w-0 shrink-0 px-2 text-[11px] text-red-300 hover:bg-red-500/15"
													title={t('collab.kickParticipantTitle')}
													onClick={() => onKickParticipant(collab.user_id)}
												>
													<UserMinusIcon width={14} height={14} />
													<span className="hidden sm:inline">
														{t('collab.kickParticipant')}
													</span>
												</DesktopAppButton>
											) : null}
										</div>
									</motion.div>
								);
							})}
						</div>
					) : (
						<DesktopAppPanel className="border-dashed bg-transparent">
							<DesktopAppEmptyState
								icon={
									<UsersIcon
										width={32}
										height={32}
										className="mx-auto text-(--desktop-text-muted)"
									/>
								}
								title={t('collab.participantsEmpty.title')}
								description={t('collab.participantsEmpty.description')}
								className="py-8"
							/>
						</DesktopAppPanel>
					)}
				</div>

				{/* Activity feed */}
				<div className="p-3">
					<div className="mb-2.5 flex items-center gap-2">
						<SignalIcon
							width={14}
							height={14}
							className="text-(--desktop-text-muted)"
							aria-hidden
						/>
						<h4 className={DOC_EDITOR_COLLAB_META_LABEL_CLASS}>
							{t('collab.activity.heading')}
						</h4>
					</div>

					{activityFeed.length > 0 ? (
						<div className="space-y-2">
							{activityFeed.map((activity) => (
								<div
									key={`${activity.id}-${activity.timestamp.getTime()}`}
									className="flex items-start gap-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2 text-sm"
								>
									{activity.type === 'join' && (
										<UserPlusIcon
											width={14}
											height={14}
											className="text-[rgb(var(--desktop-accent-rgb))] mt-0.5 shrink-0"
										/>
									)}
									{activity.type === 'leave' && (
										<UserMinusIcon
											width={14}
											height={14}
											className="text-(--desktop-text-muted) mt-0.5 shrink-0"
										/>
									)}
									<div className="flex-1 min-w-0">
										<span className="font-semibold text-(--desktop-text-primary)">
											{activity?.username ??
												t('collab.activity.participantFallback')}
										</span>
										<span className="text-(--desktop-text-muted)">
											{activity.type === 'join' && t('collab.activity.join')}
											{activity.type === 'leave' && t('collab.activity.leave')}
											{activity.type === 'edit' && t('collab.activity.edit')}
										</span>
										<div className="mt-0.5 text-xs text-(--desktop-text-dim)">
											{formatTime(activity.timestamp)}
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<DesktopAppPanel className="border-dashed bg-transparent">
							<DesktopAppEmptyState
								icon={
									<SignalIcon
										width={32}
										height={32}
										className="mx-auto text-(--desktop-text-muted)"
									/>
								}
								title={t('collab.activity.emptyTitle')}
								description={t('collab.activity.emptyDescription')}
								className="py-8"
							/>
						</DesktopAppPanel>
					)}
				</div>
			</div>

			{/* Footer */}
			<div
				className={cn(
					DESKTOP_TYPOGRAPHY.meta,
					'shrink-0 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3'
				)}
			>
				<div className="flex items-center justify-between">
					<span>{t('collab.footer.liveRealtime')}</span>
					<div className="flex items-center gap-1.5 text-(--desktop-text-muted)">
						<span className="relative inline-flex h-2 w-2 shrink-0">
							<span
								className="absolute inset-0 rounded-full bg-[rgb(var(--desktop-accent-rgb))] animate-pulse"
								aria-hidden
							/>
							<span className="sr-only">
								{t('collab.footer.srStatusOnline')}
							</span>
						</span>
						{t('collab.footer.online')}
					</div>
				</div>
			</div>
		</motion.div>
	);
};
