/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends app shell for standalone and embedded Social Hub modes.
 *
 * Invariants:
 * - Embedded mode renders only the directory surface and lets SocialHubApp own outer navigation.
 * - GAF Chat launch remains a desktop deep link, not a local router transition.
 *
 * Related:
 * - FriendsDirectory.tsx
 * - SocialHubApp.tsx
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppStatusBadge,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { requestOpenDesktopApp } from '@/pages/Desktop/utils/desktopDeepLink';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import { FriendsDirectory } from './FriendsDirectory';
import {
	SH_DIRECTORY_HUB_HEADER_CLASS,
	SH_DIRECTORY_HUB_LABEL_CLASS,
	shDirectoryFlashPanelClass,
} from '../social-hub/layout/socialHubLayoutTokens';
import {
	ChatBubbleLeftRightIcon,
	SparklesIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';

export interface FriendsAppProps {
	/** When true, only the friends directory panel (for embedding in Social hub). */
	hubMode?: boolean;
	/**
	 * When the hub keeps this panel mounted but hidden, set false to pause
	 * directory queries (Social hub friends tab inactive).
	 */
	friendsDataActive?: boolean;
	/** Focus this friend in the embedded directory after the overview payload loads. */
	initialFriendUserId?: string | null;
	/** Optional Social Hub section hint for embedded IA tabs. */
	initialDirectorySection?: 'friends' | 'circles';
}

export default function FriendsApp({
	hubMode = false,
	friendsDataActive = true,
	initialFriendUserId = null,
	initialDirectorySection = 'friends',
}: FriendsAppProps): JSX.Element {
	const { t } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const hubShellPanel = hubMode
		? getDesktopShellContentPanelClassName(shellFrame)
		: '';
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const openGafChat = useCallback((): void => {
		requestOpenDesktopApp({ appComponent: 'GAFChatApp' });
	}, []);

	useEffect(() => {
		if (!successMessage) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			setSuccessMessage(null);
		}, 3000);

		return () => window.clearTimeout(timeoutId);
	}, [successMessage]);

	const shell = (
		<div className="w-full space-y-4">
			{hubMode ? null : (
				<div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)] xl:items-start">
					<div className="space-y-2">
						<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)">
							{t('friends.friendsAppBadge')}
						</DesktopAppStatusBadge>
						<div>
							<h1
								className={cn(
									'flex items-center gap-2',
									DESKTOP_TYPOGRAPHY.title
								)}
							>
								<ChatBubbleLeftRightIcon
									className="h-5 w-5 shrink-0 text-teal-400"
									aria-hidden
								/>
								{t('friends.friendsAppTitle')}
							</h1>
							<p className={cn('mt-1 max-w-3xl', DESKTOP_TYPOGRAPHY.bodyMuted)}>
								{t('friends.friendsAppIntro')}
							</p>
						</div>
					</div>
					<DesktopAppPanel className="grid gap-2 p-3 md:grid-cols-2">
						<div className="flex flex-col gap-3 rounded-xl border border-teal-500/25 bg-(--desktop-surface-soft) p-3 shadow-(--desktop-shadow-soft)">
							<div className="space-y-1">
								<div className="text-sm font-semibold text-(--desktop-text-primary)">
									{t('friends.friendsAppGafTitle')}
								</div>
								<p className="text-xs leading-snug text-(--desktop-text-muted)">
									{t('friends.friendsAppGafDescription')}
								</p>
							</div>
							<DesktopAppButton
								type="button"
								variant="accent"
								className="w-full min-h-10 justify-center text-sm font-semibold focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-teal-300/85 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-soft) motion-safe:transition motion-reduce:transition-none"
								onClick={openGafChat}
								aria-label={t('friends.friendsAppGafOpenAria')}
							>
								<ChatBubbleLeftRightIcon
									className="h-4 w-4 shrink-0"
									aria-hidden
								/>
								{t('friends.friendsAppGafOpen')}
							</DesktopAppButton>
							<p className="text-[11px] leading-relaxed text-(--desktop-text-dim)">
								{t('friends.friendsAppGafHint')}
							</p>
						</div>
						<div className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3">
							<div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
								<SparklesIcon className="h-4 w-4 text-cyan-400" aria-hidden />
								{t('friends.friendsAppSharedTitle')}
							</div>
							<p className="text-xs leading-relaxed text-(--desktop-text-muted)">
								{t('friends.friendsAppSharedDescription')}
							</p>
						</div>
					</DesktopAppPanel>
				</div>
			)}

			{successMessage ? (
				<DesktopAppPanel className={shDirectoryFlashPanelClass('success')}>
					{successMessage}
				</DesktopAppPanel>
			) : null}
			{errorMessage ? (
				<DesktopAppPanel className={shDirectoryFlashPanelClass('danger')}>
					{errorMessage}
				</DesktopAppPanel>
			) : null}

			<div
				className={cn(
					'min-h-0 overflow-hidden p-0',
					hubMode
						? hubShellPanel
						: cn(
								DESKTOP_APP_STYLE_CONTRACT.panel,
								'shadow-(--desktop-shadow-soft)'
							)
				)}
			>
				<div className={SH_DIRECTORY_HUB_HEADER_CLASS}>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className={SH_DIRECTORY_HUB_LABEL_CLASS}>
							<UsersIcon
								className="h-4 w-4 shrink-0 text-(--desktop-accent)"
								aria-hidden
							/>
							{t('friends.friendsAppHubLabel')}
						</div>
						{hubMode ? (
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								className="min-h-9 shrink-0 border-(--desktop-border-subtle) px-3"
								onClick={openGafChat}
								aria-label={t('friends.friendsAppGafOpenAria')}
							>
								<ChatBubbleLeftRightIcon
									className={DESKTOP_LUCIDE.sm}
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								{t('friends.friendsAppGafOpen')}
							</DesktopAppButton>
						) : null}
					</div>
				</div>
				<div className="p-5">
					<FriendsDirectory
						enabled={friendsDataActive}
						initialFriendUserId={initialFriendUserId}
						initialSection={initialDirectorySection}
						anchorPrefix={`social-hub-${initialDirectorySection}-tab`}
						onSuccess={(message) => {
							setSuccessMessage(message);
							setErrorMessage(null);
						}}
						onError={(message) => {
							setErrorMessage(message);
						}}
					/>
				</div>
			</div>
		</div>
	);

	if (hubMode) {
		return (
			<div className="text-(--desktop-text-primary) antialiased">{shell}</div>
		);
	}

	return (
		<div className="min-h-screen bg-(--desktop-surface-app) p-4 text-(--desktop-text-primary) antialiased md:p-6">
			{shell}
		</div>
	);
}
