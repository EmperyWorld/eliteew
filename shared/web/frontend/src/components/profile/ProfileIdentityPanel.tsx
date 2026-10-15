/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Own-account identity editor: composes avatar panel + display name/bio form.
 *
 * Invariants:
 * - Does not own privacy or password surfaces (siblings in UserProfile shell).
 *
 * Related:
 * - ProfileAvatarPanel.tsx
 * - UserProfile.tsx
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
	ProfileUpdateData,
	UserProfileResponse,
} from '../../types/profile';
import { VALIDATION_RULES } from '../../types/profile';
import { queryClient } from '../../providers/QueryProvider';
import profileService, {
	PROFILE_ME_QUERY_KEY,
} from '../../services/profileService';
import ProfileAvatarPanel from './ProfileAvatarPanel';
import { profileApiErrorMessage } from './profileApiErrorMessage';
import { UserAccountBadges } from '../ui/UserAccountBadges';
import { cn } from '@/utils/cn';
import { log } from '../../utils/logger';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppPanel,
	DesktopAppStatusBadge,
} from '../../pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '../../pages/Desktop/utils/desktopVisualSystem';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	CheckIcon,
	ExclamationCircleIcon,
	UserIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export default function ProfileIdentityPanel({
	profile,
	onProfileUpdate,
	embedded = false,
}: {
	profile: UserProfileResponse;
	onProfileUpdate: (profile: UserProfileResponse) => void;
	embedded?: boolean;
}): JSX.Element {
	const shellFrame = useDesktopShellFrame();
	const shellPanel = embedded
		? getDesktopShellContentPanelClassName(shellFrame)
		: '';
	const [fullName, setFullName] = useState(profile.full_name || '');
	const [bio, setBio] = useState(profile.bio || '');
	const [isSaving, setIsSaving] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setFullName(profile.full_name || '');
		setBio(profile.bio || '');
	}, [profile.full_name, profile.bio]);

	const textAreaClassName =
		'w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-2 text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) transition-colors focus:border-(--desktop-border-strong) focus:outline-none focus:ring-1 focus:ring-[rgb(var(--desktop-accent-rgb))]/30 resize-none';

	const isProfileValid =
		fullName.length <= VALIDATION_RULES.FULL_NAME_MAX_LENGTH &&
		bio.length <= VALIDATION_RULES.BIO_MAX_LENGTH;
	const hasChanges =
		fullName !== (profile.full_name || '') || bio !== (profile.bio || '');

	const handleSaveProfile = async (): Promise<void> => {
		if (!isProfileValid || !hasChanges) {
			return;
		}
		setIsSaving(true);
		setError(null);
		setSaveSuccess(false);
		try {
			const updateData: ProfileUpdateData = {};
			if (fullName !== (profile.full_name || '')) {
				updateData.full_name = fullName || undefined;
			}
			if (bio !== (profile.bio || '')) {
				updateData.bio = bio || undefined;
			}
			const updatedProfile = await profileService.updateProfile(updateData);
			void queryClient.invalidateQueries({ queryKey: PROFILE_ME_QUERY_KEY });
			onProfileUpdate(updatedProfile);
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err: unknown) {
			log.error(
				'ProfileIdentityPanel',
				'Failed to update profile',
				err instanceof Error ? err : undefined,
				err
			);
			setError(profileApiErrorMessage(err, 'Не удалось сохранить изменения'));
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			<ProfileAvatarPanel
				profile={profile}
				onProfileUpdate={onProfileUpdate}
				embedded={embedded}
			/>

			<AnimatePresence>
				{error ? (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="flex items-center gap-3 rounded-xl border border-rose-500/35 bg-rose-500/[0.07] p-4"
					>
						<ExclamationCircleIcon
							className="h-5 w-5 shrink-0 text-rose-400/90"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						<p className="flex-1 text-sm text-rose-200/90">{error}</p>
						<DesktopAppButton
							type="button"
							onClick={() => setError(null)}
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-rose-400/90 hover:bg-rose-500/10 hover:text-rose-200"
						>
							<XMarkIcon
								className={DESKTOP_LUCIDE.lg}
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					</motion.div>
				) : null}
			</AnimatePresence>

			<DesktopAppPanel className={cn(shellPanel, 'p-6')}>
				<div className="mb-6 flex items-center gap-3">
					<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
						<UserIcon
							className={DESKTOP_LUCIDE.lg}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</span>
					<h2 className="text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
						Основная информация
					</h2>
				</div>

				<div className="space-y-4">
					<div>
						<label
							htmlFor="profile-identity-username"
							className="mb-2 flex items-center gap-2 text-sm font-medium text-(--desktop-text-secondary)"
						>
							Имя пользователя
							<UserAccountBadges
								isTrusted={profile.is_trusted}
								adminBadgeLabel={profile.admin_badge_label}
								adminBadgeHint={profile.admin_badge_hint}
								className="text-sky-500 [&_svg]:text-sky-500"
							/>
						</label>
						<DesktopAppInput
							id="profile-identity-username"
							type="text"
							value={profile.username}
							disabled
							className="cursor-not-allowed text-(--desktop-text-dim)"
						/>
					</div>

					<div>
						<label
							htmlFor="profile-identity-email"
							className="mb-2 block text-sm font-medium text-(--desktop-text-secondary)"
						>
							Email
							<span className="ml-2 text-xs text-(--desktop-text-dim)">
								(управляется через SSO)
							</span>
						</label>
						<DesktopAppInput
							id="profile-identity-email"
							type="email"
							value={profile.email}
							disabled
							className="cursor-not-allowed text-(--desktop-text-dim)"
						/>
					</div>

					<div>
						<label
							htmlFor="profile-identity-fullname"
							className="mb-2 block text-sm font-medium text-(--desktop-text-secondary)"
						>
							Отображаемое имя
							<span className="ml-2 text-xs text-(--desktop-text-dim)">
								({fullName.length}/{VALIDATION_RULES.FULL_NAME_MAX_LENGTH})
							</span>
						</label>
						<DesktopAppInput
							id="profile-identity-fullname"
							type="text"
							value={fullName}
							onChange={(e) => setFullName(e.target.value)}
							maxLength={VALIDATION_RULES.FULL_NAME_MAX_LENGTH}
							placeholder="Введите ваше полное имя"
						/>
					</div>

					<div>
						<label
							htmlFor="profile-identity-bio"
							className="mb-2 block text-sm font-medium text-(--desktop-text-secondary)"
						>
							О себе
							<span className="ml-2 text-xs text-(--desktop-text-dim)">
								({bio.length}/{VALIDATION_RULES.BIO_MAX_LENGTH})
							</span>
						</label>
						<textarea
							id="profile-identity-bio"
							value={bio}
							onChange={(e) => setBio(e.target.value)}
							maxLength={VALIDATION_RULES.BIO_MAX_LENGTH}
							placeholder="Расскажите о себе"
							rows={4}
							className={textAreaClassName}
						/>
					</div>

					<div className="flex items-center justify-between pt-4">
						<div className="flex items-center gap-2">
							{saveSuccess ? (
								<motion.div
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									className="flex items-center gap-2 text-emerald-300/90"
								>
									<CheckIcon
										className={DESKTOP_LUCIDE.lg}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									<DesktopAppStatusBadge className="border-emerald-500/25 bg-emerald-500/8 text-emerald-200/90">
										Сохранено
									</DesktopAppStatusBadge>
								</motion.div>
							) : null}
						</div>
						<DesktopAppButton
							type="button"
							onClick={() => void handleSaveProfile()}
							disabled={!hasChanges || !isProfileValid || isSaving}
							variant="accent"
							className="px-6"
						>
							{isSaving ? (
								<>
									<ArrowPathIcon
										className={cn(DESKTOP_LUCIDE.md, 'animate-spin')}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									Сохранение...
								</>
							) : (
								<>
									<ArrowDownTrayIcon
										className={DESKTOP_LUCIDE.md}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									Сохранить изменения
								</>
							)}
						</DesktopAppButton>
					</div>
				</div>
			</DesktopAppPanel>
		</div>
	);
}
