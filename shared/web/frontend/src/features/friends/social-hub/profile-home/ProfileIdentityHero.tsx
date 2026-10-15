/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Interactive identity strip for Social Hub Profile Home (avatar, name, bio, badges).
 *
 * Invariants:
 * - Avatar uses SecureAvatar (Bearer blob), never raw content download `<img src>`.
 * - Avatar / edit profile open identity sheet; no peer empty rooms.
 * - Account badges render via UserAccountBadges (sentence-case admin label, no CSS uppercase).
 *
 * Related:
 * - ProfileHome.tsx
 * - @/components/profile/SecureAvatar.tsx
 * - @/components/ui/UserAccountBadges.tsx
 */

import { useTranslation } from 'react-i18next';
import { PencilSquareIcon } from '@heroicons/react/24/outline';

import { SecureAvatar } from '@/components/profile/SecureAvatar';
import { UserAccountBadges } from '@/components/ui/UserAccountBadges';
import {
	DesktopAppButton,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { UserProfileResponse } from '@/types/profile';
import { formatDate, formatRelativeTime } from '@/types/profile';
import { cn } from '@/utils/cn';

export default function ProfileIdentityHero({
	profile,
	onEditIdentity,
}: {
	profile: UserProfileResponse | null;
	onEditIdentity: () => void;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const displayName =
		profile?.full_name?.trim() ||
		profile?.username ||
		t('friends.socialHubPrivacyYouFallback');
	const bio = profile?.bio?.trim() || '';
	const missingBits: string[] = [];
	if (!profile?.avatar_url) {
		missingBits.push(t('friends.profileHomeCompletenessAvatar'));
	}
	if (!profile?.full_name?.trim()) {
		missingBits.push(t('friends.profileHomeCompletenessName'));
	}
	if (!bio) {
		missingBits.push(t('friends.profileHomeCompletenessBio'));
	}

	return (
		<DesktopAppPanel className="space-y-4 p-4 sm:p-5">
			<div className="flex flex-wrap items-start gap-4">
				<button
					type="button"
					onClick={onEditIdentity}
					className={cn(
						'group relative shrink-0 rounded-full outline-none',
						'focus-visible:ring-2 focus-visible:ring-(--desktop-accent)/50'
					)}
					aria-label={t('friends.profileHomeEditAvatarAria')}
				>
					{profile?.avatar_url ? (
						<SecureAvatar
							avatarUrl={profile.avatar_url}
							alt=""
							className="h-16 w-16 rounded-full object-cover ring-1 ring-(--desktop-border-subtle) transition group-hover:ring-(--desktop-accent)/40"
						/>
					) : (
						<div
							aria-hidden
							className="flex h-16 w-16 items-center justify-center rounded-full bg-(--desktop-surface) text-lg font-semibold text-(--desktop-text-secondary) ring-1 ring-(--desktop-border-subtle) transition group-hover:ring-(--desktop-accent)/40"
						>
							{displayName.slice(0, 1).toUpperCase()}
						</div>
					)}
				</button>

				<div className="min-w-0 flex-1 space-y-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="truncate text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
							{displayName}
						</h2>
						{profile ? (
							<UserAccountBadges
								isTrusted={profile.is_trusted}
								adminBadgeLabel={profile.admin_badge_label}
								adminBadgeHint={profile.admin_badge_hint}
							/>
						) : null}
					</div>
					{profile?.username ? (
						<p className="truncate text-sm text-(--desktop-text-muted)">
							@{profile.username}
						</p>
					) : (
						<p className="text-sm text-(--desktop-text-muted)">
							{t('friends.socialHubPrivacyIdentityHint')}
						</p>
					)}
					{bio ? (
						<p className="max-w-2xl text-sm leading-relaxed text-(--desktop-text-secondary)">
							{bio}
						</p>
					) : (
						<p className="text-sm text-(--desktop-text-dim)">
							{t('friends.profileHomeBioEmpty')}
						</p>
					)}
					{profile ? (
						<div
							className={cn(
								'flex flex-wrap gap-2 pt-1 text-(--desktop-text-muted)',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
						>
							{typeof profile.login_count === 'number' ? (
								<span>
									{t('friends.profileHomeChipLogins', {
										count: profile.login_count,
									})}
								</span>
							) : null}
							{profile.last_login_at ? (
								<span>
									{t('friends.profileHomeChipLastLogin', {
										when: formatRelativeTime(profile.last_login_at),
									})}
								</span>
							) : null}
							{profile.created_at ? (
								<span>
									{t('friends.profileHomeChipMemberSince', {
										date: formatDate(profile.created_at),
									})}
								</span>
							) : null}
						</div>
					) : null}
					{missingBits.length > 0 ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('friends.profileHomeCompletenessHint', {
								items: missingBits.join(', '),
							})}
						</p>
					) : null}
				</div>

				<DesktopAppButton
					type="button"
					variant="ghost"
					className="gap-2"
					onClick={onEditIdentity}
				>
					<PencilSquareIcon
						className={DESKTOP_LUCIDE.md}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('friends.socialHubPrivacyEditProfile')}
				</DesktopAppButton>
			</div>
		</DesktopAppPanel>
	);
}
