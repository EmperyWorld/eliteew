import { useTranslation } from 'react-i18next';

import { SecureAvatar } from '@/components/profile/SecureAvatar';
import { cn } from '@/utils/cn';
import { UserIcon } from '@heroicons/react/24/outline';

export interface FriendAvatarProps {
	avatarUrl?: string | null;
	username?: string | null;
	fullName?: string | null;
	alt?: string;
	className?: string;
}

export function getFriendDisplayName(
	username?: string | null,
	fullName?: string | null,
	fallback: string = '—'
): string {
	const u = username?.trim();
	const f = fullName?.trim();
	return f || u || fallback;
}

export function getFriendInitials(
	username?: string | null,
	fullName?: string | null
): string {
	const fn = fullName?.trim();
	if (fn) {
		const parts = fn.split(/\s+/).filter(Boolean);
		if (parts.length >= 2) {
			const a = parts[0]?.[0] ?? '';
			const b = parts[parts.length - 1]?.[0] ?? '';
			return `${a}${b}`.toUpperCase();
		}
		const one = parts[0];
		if (one && one.length >= 2) {
			return one.slice(0, 2).toUpperCase();
		}
		return (one?.[0] ?? '').toUpperCase();
	}
	const u = username?.trim();
	if (u && u.length >= 2) {
		return u.slice(0, 2).toUpperCase();
	}
	return u ? u[0].toUpperCase() : '';
}

export function FriendAvatar({
	avatarUrl,
	username,
	fullName,
	alt = 'Friend avatar',
	className,
}: FriendAvatarProps): JSX.Element {
	const { t } = useTranslation('contentManager');
	const anonymous = t('friends.anonymousUser');

	if (avatarUrl) {
		return (
			<SecureAvatar
				avatarUrl={avatarUrl}
				className={cn(
					'h-10 w-10 rounded-full object-cover shrink-0',
					className
				)}
				alt={alt}
			/>
		);
	}

	const displayInitial =
		getFriendInitials(username, fullName) ||
		getFriendDisplayName(username, fullName, anonymous).charAt(0).toUpperCase();

	return (
		<div
			className={cn(
				'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--desktop-surface-soft) text-xs font-semibold tracking-tight text-(--desktop-text-secondary) ring-1 ring-(--desktop-border-subtle) motion-reduce:transition-none',
				className
			)}
			aria-hidden
		>
			{displayInitial || (
				<UserIcon className="h-4 w-4 opacity-80" aria-hidden />
			)}
		</div>
	);
}
