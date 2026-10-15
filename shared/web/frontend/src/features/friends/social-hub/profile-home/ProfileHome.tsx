/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Interactive Profile Home for Social Hub Privacy — identity, privacy board, pulse, secondary.
 *
 * Invariants:
 * - One filled primary CTA lives in PrivacyBoard («Configure visibility»).
 * - Deep editors are sheets opened by parent stage machine, not peer empty rooms.
 *
 * Related:
 * - ../sections/SocialHubPrivacySection.tsx
 * - ProfileIdentityHero.tsx, ProfilePrivacyBoard.tsx, ProfileAccountPulse.tsx
 */

import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';

import { DesktopAppSkeleton } from '@/pages/Desktop/components/DesktopAppChrome';
import type { UserProfileResponse } from '@/types/profile';

import { SH_SECTION_STACK_CLASS } from '../layout/socialHubLayoutTokens';
import ProfileAccountPulse from './ProfileAccountPulse';
import ProfileIdentityHero from './ProfileIdentityHero';
import ProfilePrivacyBoard from './ProfilePrivacyBoard';

const ProfilePasswordResetSection = lazy(
	() => import('@/components/profile/ProfilePasswordResetSection')
);

export default function ProfileHome({
	profile,
	embeddedMobileLayout = false,
	activityRefreshKey = 0,
	onEditIdentity,
	onConfigureVisibility,
	onOpenActivity,
}: {
	profile: UserProfileResponse | null;
	embeddedMobileLayout?: boolean;
	activityRefreshKey?: number;
	onEditIdentity: () => void;
	onConfigureVisibility: () => void;
	onOpenActivity: () => void;
}): JSX.Element {
	const { t } = useTranslation('contentManager');

	return (
		<div className={SH_SECTION_STACK_CLASS} data-testid="profile-home">
			<ProfileIdentityHero profile={profile} onEditIdentity={onEditIdentity} />
			<ProfilePrivacyBoard
				embeddedMobileLayout={embeddedMobileLayout}
				onConfigureVisibility={onConfigureVisibility}
			/>
			<ProfileAccountPulse
				activityRefreshKey={activityRefreshKey}
				onOpenActivity={onOpenActivity}
			/>
			<details className="group rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 px-4 py-3">
				<summary className="cursor-pointer text-sm font-medium text-(--desktop-text-secondary)">
					{t('friends.socialHubProfilePasswordToggle')}
				</summary>
				<div className="mt-3">
					<Suspense
						fallback={
							<DesktopAppSkeleton className="h-24 w-full rounded-(--desktop-radius-lg)" />
						}
					>
						{profile ? (
							<ProfilePasswordResetSection email={profile.email} embedded />
						) : (
							<p className="text-sm text-(--desktop-text-muted)">
								{t('friends.profileHomePasswordWaiting')}
							</p>
						)}
					</Suspense>
				</div>
			</details>
		</div>
	);
}
