/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile Home host for Social Hub Privacy — interactive home + sheet editors.
 *
 * Invariants:
 * - Home is the default surface; editors replace Home (sheets), they do not stack.
 * - Peer «Ещё» room is removed; activity is a sheet opened from AccountPulse.
 * - Back from any sheet always returns to Home.
 *
 * Related:
 * - SocialHubShell.tsx
 * - ../profile-home/ProfileHome.tsx
 * - @/components/profile/ProfilePrivacySection.tsx
 */

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import type { User as AppUser } from '@/services';
import type { NavigationHandler } from '@/types/navigation';
import {
	DesktopAppButton,
	DesktopAppSkeleton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import profileService from '@/services/profileService';
import type { UserProfileResponse } from '@/types/profile';
import { useAuth } from '@/contexts/AuthContext';
import { log } from '@/utils/logger';

import ProfileHome from '../profile-home/ProfileHome';
import { SH_SECTION_STACK_CLASS } from '../layout/socialHubLayoutTokens';

const ProfilePrivacySection = lazy(
	() => import('@/components/profile/ProfilePrivacySection')
);
const ProfileIdentityPanel = lazy(
	() => import('@/components/profile/ProfileIdentityPanel')
);
const ProfileActivityPanel = lazy(
	() => import('@/components/profile/ProfileActivityPanel')
);
const ProfilePasswordResetSection = lazy(
	() => import('@/components/profile/ProfilePasswordResetSection')
);

type ProfileHomeStage = 'home' | 'visibility' | 'identity' | 'activity';

export default function SocialHubPrivacySection({
	embeddedMobile = false,
	onNavigate: _onNavigate,
	onUserUpdate,
}: {
	embeddedMobile?: boolean;
	onNavigate?: NavigationHandler;
	onUserUpdate?: (user: AppUser) => void;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const { checkAuthentication } = useAuth();
	const [stage, setStage] = useState<ProfileHomeStage>('home');
	const [profile, setProfile] = useState<UserProfileResponse | null>(null);
	const [activityKey, setActivityKey] = useState(0);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const data = await profileService.getProfile();
				if (!cancelled) {
					setProfile(data);
				}
			} catch (err: unknown) {
				log.error(
					'SocialHubPrivacySection',
					'profile load failed',
					err instanceof Error ? err : undefined,
					err
				);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleProfileUpdate = useCallback(
		(updated: UserProfileResponse) => {
			setProfile(updated);
			setActivityKey((k) => k + 1);
			onUserUpdate?.({
				id: updated.id,
				username: updated.username,
				email: updated.email,
				role: updated.role as AppUser['role'],
				is_active: updated.is_active,
				created_at: updated.created_at,
				profile: {
					display_name: updated.full_name || undefined,
					avatar_url: updated.avatar_url || undefined,
					bio: updated.bio || undefined,
					preferences: updated.preferences || undefined,
				},
			});
			void checkAuthentication();
		},
		[onUserUpdate, checkAuthentication]
	);

	const backToHome = useCallback(() => {
		setStage('home');
	}, []);

	if (stage === 'home') {
		return (
			<ProfileHome
				profile={profile}
				embeddedMobileLayout={embeddedMobile}
				activityRefreshKey={activityKey}
				onEditIdentity={() => setStage('identity')}
				onConfigureVisibility={() => setStage('visibility')}
				onOpenActivity={() => setStage('activity')}
			/>
		);
	}

	const sheetTitle =
		stage === 'visibility'
			? t('friends.socialHubProfilePaneVisibility')
			: stage === 'identity'
				? t('friends.socialHubProfilePaneIdentity')
				: t('friends.socialHubProfileMoreActivity');

	return (
		<div className={SH_SECTION_STACK_CLASS}>
			<div className="flex flex-wrap items-center gap-2">
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className="gap-2"
					onClick={backToHome}
				>
					<ArrowLeftIcon
						className={DESKTOP_LUCIDE.md}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('friends.socialHubPrivacyBackOverview')}
				</DesktopAppButton>
				<p className="text-sm text-(--desktop-text-muted)">{sheetTitle}</p>
			</div>

			<Suspense
				fallback={
					<DesktopAppSkeleton className="min-h-[240px] w-full rounded-(--desktop-radius-lg)" />
				}
			>
				{stage === 'visibility' ? (
					<div className="space-y-4">
						<ProfilePrivacySection embedded layout="premium" />
						<details className="group rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 px-4 py-3">
							<summary className="cursor-pointer text-sm font-medium text-(--desktop-text-secondary)">
								{t('friends.socialHubProfilePasswordToggle')}
							</summary>
							<div className="mt-3">
								{profile ? (
									<ProfilePasswordResetSection email={profile.email} embedded />
								) : null}
							</div>
						</details>
					</div>
				) : null}

				{stage === 'identity' && profile ? (
					<ProfileIdentityPanel
						embedded
						profile={profile}
						onProfileUpdate={handleProfileUpdate}
					/>
				) : null}

				{stage === 'activity' ? (
					<ProfileActivityPanel embedded refreshKey={activityKey} />
				) : null}
			</Suspense>
		</div>
	);
}
