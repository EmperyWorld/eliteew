import {
	ArrowPathIcon,
	ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	FriendAvatar,
	getFriendDisplayName,
} from '@/features/friends/components/FriendAvatar';
import type { GAFMessageItem } from '@/pages/Desktop/components/GAFChat/types';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { requestOpenGafChatByUsername } from '@/pages/Desktop/utils/desktopDeepLink';
import { cn } from '@/utils/cn';

import type { ClientInteractionContext } from '../../marketingCabinetApi';

export type ClientInteractionChatPanelProps = {
	embedded: boolean;
	mcPanel: string;
	ixPadding: string;
	mcForm: string;
	ctx: ClientInteractionContext | undefined;
	partner: ClientInteractionContext['partner'] | null;
	bridgeQueryError: boolean;
	sortedMessages: GAFMessageItem[];
	selfUid: string | null;
	messagesLoading: boolean;
	messagesEndRef: React.RefObject<HTMLDivElement | null>;
	draft: string;
	setDraft: (v: string) => void;
	chatId: string | null;
	chatSendPending: boolean;
	onSubmitChat: (e: React.FormEvent) => void;
};

export function ClientInteractionChatPanel({
	embedded,
	mcPanel,
	ixPadding,
	mcForm,
	ctx,
	partner,
	bridgeQueryError,
	sortedMessages,
	selfUid,
	messagesLoading,
	messagesEndRef,
	draft,
	setDraft,
	chatId,
	chatSendPending,
	onSubmitChat,
}: ClientInteractionChatPanelProps) {
	const { t } = useTranslation('marketing');
	const partnerName = partner
		? getFriendDisplayName(partner.username, partner.full_name)
		: '—';

	const canOpenClientChatBridge = Boolean(
		ctx?.has_representative && (ctx?.is_lead || ctx?.is_customer_representative)
	);

	return (
		<div
			className={cn(
				mcPanel,
				'flex min-h-0 flex-col',
				ixPadding,
				embedded && 'flex-1'
			)}
		>
			{!embedded ? (
				<>
					<DesktopAppSectionLabel className="mb-2">
						{t('clientInteractionView.chatTitle')}
					</DesktopAppSectionLabel>
					<p className="mb-3 text-xs text-(--desktop-text-secondary)">
						{t('clientInteractionView.chatHint')}
					</p>
				</>
			) : (
				<p className={cn('mb-3', DESKTOP_TYPOGRAPHY.meta)}>
					{t('clientInteractionView.chatHint')}
				</p>
			)}
			{ctx && !ctx.has_representative ? (
				<DesktopAppEmptyState
					icon={
						<ChatBubbleLeftRightIcon
							className="h-8 w-8 opacity-50"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					}
					title={t('clientInteractionView.noRepresentative')}
					className={cn(mcPanel, 'py-8')}
				/>
			) : ctx?.has_representative && !canOpenClientChatBridge ? (
				<DesktopAppEmptyState
					icon={
						<ChatBubbleLeftRightIcon
							className="h-8 w-8 opacity-50"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					}
					title={t('clientInteractionView.chatOnlyLeadOrRepTitle')}
					description={t('clientInteractionView.chatOnlyLeadOrRepDescription')}
					className={cn(mcPanel, 'py-8')}
				/>
			) : (
				<>
					<div className="mb-2 flex flex-wrap items-center gap-2">
						<span className={cn(DESKTOP_TYPOGRAPHY.meta, 'font-medium')}>
							{t('clientInteractionView.partner')}:
						</span>
						{partner ? (
							<span className="flex items-center gap-2 text-sm">
								<FriendAvatar
									username={partner.username}
									avatarUrl={partner.avatar_url}
									fullName={partner.full_name}
									className={cn(DESKTOP_TYPOGRAPHY.caption, 'h-8! w-8!')}
								/>
								{partnerName}
							</span>
						) : (
							<span className="text-sm text-(--desktop-text-secondary)">—</span>
						)}
						{partner?.username ? (
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={cn(DESKTOP_TYPOGRAPHY.caption, 'h-7')}
								onClick={() =>
									requestOpenGafChatByUsername(partner.username as string)
								}
							>
								{t('clientInteractionView.openInGaf')}
							</DesktopAppButton>
						) : null}
					</div>
					{bridgeQueryError ? (
						<p className="text-sm text-amber-600">
							{t('clientInteractionView.chatLoadError')}
						</p>
					) : null}
					<div
						className={cn(
							mcPanel,
							'flex min-h-[220px] flex-1 flex-col overflow-hidden p-0'
						)}
					>
						<div
							className={cn(
								'min-h-0 flex-1 space-y-2 overflow-y-auto p-3',
								embedded ? 'max-h-[240px]' : 'max-h-[320px]'
							)}
						>
							{messagesLoading ? (
								<div className="flex justify-center py-6">
									<ArrowPathIcon
										className="h-6 w-6 motion-safe:animate-spin motion-reduce:animate-none opacity-50"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								</div>
							) : sortedMessages.length === 0 ? (
								<p className={cn('py-6 text-center', DESKTOP_TYPOGRAPHY.meta)}>
									{t('clientInteractionView.noMessages')}
								</p>
							) : (
								sortedMessages.map((m: GAFMessageItem) => (
									<div
										key={m.id}
										className={cn(
											'rounded-lg px-3 py-2 text-sm',
											m.deleted_for_sender || m.deleted_for_recipient
												? 'opacity-40'
												: ''
										)}
									>
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'text-[10px] leading-tight'
											)}
										>
											{selfUid && m.sender_id === selfUid
												? t('clientInteractionView.you')
												: partnerName}
										</div>
										<div className="whitespace-pre-wrap">{m.body || '—'}</div>
									</div>
								))
							)}
							<div ref={messagesEndRef} />
						</div>
						<form
							onSubmit={onSubmitChat}
							className="flex gap-2 border-t border-(--desktop-border-subtle) p-2"
						>
							<input
								className={cn(
									mcForm,
									'min-w-0 flex-1 rounded px-2 py-1.5 text-sm'
								)}
								placeholder={t('clientInteractionView.messagePlaceholder')}
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								disabled={!chatId || chatSendPending}
							/>
							<DesktopAppButton
								type="submit"
								size="sm"
								disabled={!chatId || chatSendPending}
							>
								{t('clientInteractionView.send')}
							</DesktopAppButton>
						</form>
					</div>
				</>
			)}
		</div>
	);
}
