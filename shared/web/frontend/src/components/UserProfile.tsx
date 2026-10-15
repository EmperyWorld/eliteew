/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Premium own-account profile shell for Social Hub Privacy (and legacy mounts).
 * Privacy-first panes: visibility → identity → password → account more.
 *
 * Invariants:
 * - Stable import path `@/components/UserProfile`.
 * - `embedded` mode never shows equal-weight Profile/Stats/Activity tabs.
 * - Privacy preview invalidation is owned by ProfilePrivacySection after save.
 *
 * Related:
 * - features/friends/social-hub/sections/SocialHubPrivacySection.tsx
 * - profile/ProfileIdentityPanel.tsx
 * - profile/ProfilePrivacySection.tsx
 */

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ChevronDownIcon,
	ChevronLeftIcon,
	KeyIcon,
	ShieldCheckIcon,
	UserIcon,
} from '@heroicons/react/24/outline';

import { getPageLabel } from '@/config/pageNavigation';
import { PROFILE_RETURN_TO_SESSION_KEY } from '@/constants/storageKeys';
import { useAuth } from '@/contexts/AuthContext';
import type { ShellPageType } from '@/hooks/useAppState';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppSkeleton,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import type { User as AppUser } from '@/services';
import profileService from '@/services/profileService';
import type { UserProfileResponse } from '@/types/profile';
import type { NavigationHandler } from '@/types/navigation';
import { cn } from '@/utils/cn';
import { log } from '@/utils/logger';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

import ProfileAccountMorePanel, {
	type AccountMoreSubPane,
} from './profile/ProfileAccountMorePanel';
import ProfileIdentityPanel from './profile/ProfileIdentityPanel';
import ProfilePasswordResetSection from './profile/ProfilePasswordResetSection';
import ProfilePrivacySection from './profile/ProfilePrivacySection';
import { SecureAvatar } from './profile/SecureAvatar';

export type UserProfileFocusTarget = 'visibility' | 'identity';
export type UserProfilePrimaryPane = 'visibility' | 'identity' | 'more';

export interface UserProfileProps {
	onNavigate?: NavigationHandler;
	onUserUpdate?: (user: AppUser) => void;
	/** Nested in Social Hub: compact chrome, privacy-first panes. */
	embedded?: boolean;
	/** Scroll/focus request from Social Hub hero CTA. */
	focusTarget?: UserProfileFocusTarget | null;
	onFocusConsumed?: () => void;
}

const PROFILE_RETURN_SHELL = new Set<ShellPageType>([
	'desktop',
	'desktop/store',
	'login',
	'admin',
	'desktop-admin',
]);

function parseProfileReturn(raw: string | null): ShellPageType {
	if (!raw) {
		return 'desktop';
	}
	if (raw === 'dashboard') {
		return 'desktop';
	}
	if (PROFILE_RETURN_SHELL.has(raw as ShellPageType)) {
		return raw as ShellPageType;
	}
	return 'desktop';
}

export default function UserProfile({
	onNavigate,
	onUserUpdate,
	embedded = false,
	focusTarget = null,
	onFocusConsumed,
}: UserProfileProps): JSX.Element | null {
	const { t } = useTranslation('contentManager');
	const auth = useAuth();
	const { checkAuthentication } = auth;
	const [primaryPane, setPrimaryPane] =
		useState<UserProfilePrimaryPane>('visibility');
	const [moreSubPane, setMoreSubPane] =
		useState<AccountMoreSubPane>('statistics');
	const [passwordOpen, setPasswordOpen] = useState(false);
	const [profile, setProfile] = useState<UserProfileResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activityLogRefreshKey, setActivityLogRefreshKey] = useState(0);
	const visibilityRef = useRef<HTMLDivElement>(null);
	const identityRef = useRef<HTMLDivElement>(null);

	const returnTo = (() => {
		try {
			return parseProfileReturn(
				sessionStorage.getItem(PROFILE_RETURN_TO_SESSION_KEY)
			);
		} catch {
			return 'desktop';
		}
	})();
	const clearReturnTo = (): void => {
		try {
			sessionStorage.removeItem(PROFILE_RETURN_TO_SESSION_KEY);
		} catch {
			// ignore storage failures
		}
	};

	const shellFrame = useDesktopShellFrame();
	const shellPanel = embedded
		? getDesktopShellContentPanelClassName(shellFrame)
		: '';

	const loadProfile = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const profileData = await profileService.getProfile();
			setProfile(profileData);
		} catch (err: unknown) {
			log.error(
				'UserProfile',
				'Failed to load profile',
				err instanceof Error ? err : undefined,
				err
			);
			const message =
				err &&
				typeof err === 'object' &&
				'response' in err &&
				err.response &&
				typeof err.response === 'object' &&
				'data' in err.response &&
				err.response.data &&
				typeof err.response.data === 'object' &&
				'message' in err.response.data &&
				typeof (err.response.data as { message: unknown }).message === 'string'
					? (err.response.data as { message: string }).message
					: t('friends.socialHubProfileLoadError');
			setError(message);
		} finally {
			setIsLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void loadProfile();
	}, [loadProfile]);

	useEffect(() => {
		if (!focusTarget || !profile) {
			return;
		}
		if (focusTarget === 'visibility') {
			setPrimaryPane('visibility');
			requestAnimationFrame(() => {
				visibilityRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
				});
				visibilityRef.current
					?.querySelector<HTMLElement>('button, select, input')
					?.focus();
			});
		} else {
			setPrimaryPane('identity');
			requestAnimationFrame(() => {
				identityRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
				});
			});
		}
		onFocusConsumed?.();
	}, [focusTarget, profile, onFocusConsumed]);

	const handleProfileUpdate = (updatedProfile: UserProfileResponse): void => {
		setProfile(updatedProfile);
		setActivityLogRefreshKey((k) => k + 1);
		if (onUserUpdate) {
			onUserUpdate({
				id: updatedProfile.id,
				username: updatedProfile.username,
				email: updatedProfile.email,
				role: updatedProfile.role as AppUser['role'],
				is_active: updatedProfile.is_active,
				created_at: updatedProfile.created_at,
				profile: {
					display_name: updatedProfile.full_name || undefined,
					avatar_url: updatedProfile.avatar_url || undefined,
					bio: updatedProfile.bio || undefined,
					preferences: updatedProfile.preferences || undefined,
				},
			});
		}
		void checkAuthentication();
	};

	if (isLoading) {
		return (
			<div
				className={cn(
					'flex items-center justify-center p-6',
					embedded
						? 'min-h-[240px] bg-transparent'
						: 'min-h-screen bg-(--desktop-surface-app)'
				)}
			>
				<DesktopAppPanel
					className={cn(embedded ? shellPanel : '', 'w-full max-w-md p-8')}
				>
					<DesktopAppEmptyState
						icon={
							<ArrowPathIcon
								className="h-10 w-10 shrink-0 animate-spin text-slate-400"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						}
						title={t('friends.socialHubProfileLoadingTitle')}
						description={t('friends.socialHubProfileLoadingDescription')}
					/>
				</DesktopAppPanel>
			</div>
		);
	}

	if (error && !profile) {
		return (
			<div
				className={cn(
					'flex items-center justify-center p-6',
					embedded
						? 'min-h-[240px] bg-transparent'
						: 'min-h-screen bg-(--desktop-surface-app)'
				)}
			>
				<div className="w-full max-w-md">
					<DesktopProductStatusBanner
						tone="danger"
						role="alert"
						aria-live="assertive"
						title={t('friends.socialHubProfileLoadErrorTitle')}
						description={error}
						actions={
							<DesktopAppButton
								type="button"
								variant="neutral"
								onClick={() => void loadProfile()}
							>
								<ArrowPathIcon className="h-4 w-4" aria-hidden />
								{t('friends.networkRetry')}
							</DesktopAppButton>
						}
					/>
				</div>
			</div>
		);
	}

	if (!profile) {
		return null;
	}

	const paneButtonClass = (active: boolean): string =>
		cn(
			'shrink-0 gap-2',
			active
				? 'border border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-soft) text-(--desktop-text-primary)'
				: 'border border-transparent text-(--desktop-text-muted) hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft)/80'
		);

	return (
		<div
			className={cn(
				'text-(--desktop-text-primary) antialiased',
				embedded
					? 'min-h-0 bg-transparent p-0'
					: 'min-h-screen bg-(--desktop-surface-app) p-4 md:p-6 md:pl-16'
			)}
		>
			<div className={cn('mx-auto', embedded ? 'max-w-none' : 'max-w-4xl')}>
				{onNavigate && !embedded ? (
					<DesktopAppButton
						onClick={() => {
							clearReturnTo();
							onNavigate(returnTo);
						}}
						variant="ghost"
						size="sm"
						className="mb-4 gap-2"
					>
						<ChevronLeftIcon
							className={DESKTOP_LUCIDE.lg}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{returnTo === 'desktop'
							? t('friends.socialHubProfileBackDesktop')
							: t('friends.socialHubProfileBackPage', {
									page: getPageLabel(returnTo),
								})}
					</DesktopAppButton>
				) : null}

				{!embedded ? (
					<header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0">
							<h1 className={DESKTOP_TYPOGRAPHY.title}>
								{t('friends.socialHubProfileTitle')}
							</h1>
							<p className={cn('mt-1 max-w-xl', DESKTOP_TYPOGRAPHY.bodyMuted)}>
								{t('friends.socialHubProfileSubtitle')}
							</p>
						</div>
						<DesktopAppPanel
							className={cn(
								shellPanel,
								'flex items-center gap-3 p-3 sm:max-w-xs'
							)}
						>
							<div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-(--desktop-border-strong)">
								<SecureAvatar
									useProfileApi
									className="h-full w-full rounded-none object-cover"
								/>
							</div>
							<div className="min-w-0">
								<p className="truncate font-semibold">
									{profile.full_name || profile.username}
								</p>
								<p className="truncate text-sm text-(--desktop-text-muted)">
									{profile.email}
								</p>
							</div>
						</DesktopAppPanel>
					</header>
				) : (
					<div className="mb-3 flex min-w-0 items-center gap-3">
						<div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-(--desktop-border-strong)">
							<SecureAvatar
								useProfileApi
								className="h-full w-full rounded-none object-cover"
							/>
						</div>
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold">
								{profile.full_name || profile.username}
							</p>
							<p className="truncate text-xs text-(--desktop-text-muted)">
								@{profile.username}
							</p>
						</div>
					</div>
				)}

				<div
					className="mb-4 flex flex-wrap gap-2"
					role="tablist"
					aria-label={t('friends.socialHubProfilePaneListAria')}
				>
					<DesktopAppButton
						type="button"
						size="sm"
						role="tab"
						aria-selected={primaryPane === 'visibility'}
						variant={primaryPane === 'visibility' ? 'neutral' : 'ghost'}
						className={paneButtonClass(primaryPane === 'visibility')}
						onClick={() => setPrimaryPane('visibility')}
					>
						<ShieldCheckIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('friends.socialHubProfilePaneVisibility')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						size="sm"
						role="tab"
						aria-selected={primaryPane === 'identity'}
						variant={primaryPane === 'identity' ? 'neutral' : 'ghost'}
						className={paneButtonClass(primaryPane === 'identity')}
						onClick={() => setPrimaryPane('identity')}
					>
						<UserIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('friends.socialHubProfilePaneIdentity')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						size="sm"
						role="tab"
						aria-selected={primaryPane === 'more'}
						variant={primaryPane === 'more' ? 'neutral' : 'ghost'}
						className={paneButtonClass(primaryPane === 'more')}
						onClick={() => setPrimaryPane('more')}
					>
						{t('friends.socialHubProfilePaneMore')}
					</DesktopAppButton>
				</div>

				<div className="min-w-0 space-y-4 pb-6">
					{primaryPane === 'visibility' ? (
						<div
							ref={visibilityRef}
							id="social-hub-profile-visibility"
							className="scroll-mt-4 space-y-4"
						>
							<ProfilePrivacySection embedded={embedded} />
							<div>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									className="gap-2"
									aria-expanded={passwordOpen}
									onClick={() => setPasswordOpen((open) => !open)}
								>
									<KeyIcon
										className={DESKTOP_LUCIDE.md}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									{t('friends.socialHubProfilePasswordToggle')}
									<ChevronDownIcon
										className={cn(
											DESKTOP_LUCIDE.sm,
											'transition-transform',
											passwordOpen && 'rotate-180'
										)}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								</DesktopAppButton>
								{passwordOpen ? (
									<div className="mt-3">
										<ProfilePasswordResetSection
											email={profile.email}
											embedded={embedded}
										/>
									</div>
								) : null}
							</div>
						</div>
					) : null}

					{primaryPane === 'identity' ? (
						<div
							ref={identityRef}
							id="social-hub-profile-identity"
							className="scroll-mt-4"
						>
							<React.Suspense
								fallback={
									<div className="space-y-3">
										<DesktopAppSkeleton className="h-32 rounded-(--desktop-radius-lg)" />
										<DesktopAppSkeleton className="h-48 rounded-(--desktop-radius-lg)" />
									</div>
								}
							>
								<ProfileIdentityPanel
									embedded={embedded}
									profile={profile}
									onProfileUpdate={handleProfileUpdate}
								/>
							</React.Suspense>
						</div>
					) : null}

					{primaryPane === 'more' ? (
						<ProfileAccountMorePanel
							embedded={embedded}
							subPane={moreSubPane}
							onSubPaneChange={setMoreSubPane}
							activityRefreshKey={activityLogRefreshKey}
						/>
					) : null}
				</div>
			</div>
		</div>
	);
}
