/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat partner/list avatar — thin wrapper over SecureAvatar (strict-origin guard).
 *
 * Invariants:
 * - No direct external `<img src>`; all URLs pass through SecureAvatar boundary.
 *
 * Related:
 * - src/components/profile/SecureAvatar.tsx
 */
import { SecureAvatar } from '@/components/profile/SecureAvatar';

export interface GAFChatAvatarProps {
	avatarUrl?: string | null;
	className?: string;
	alt: string;
}

export function GAFChatAvatar({
	avatarUrl = null,
	className = '',
	alt,
}: GAFChatAvatarProps) {
	return (
		<SecureAvatar
			avatarUrl={avatarUrl ?? null}
			className={className}
			alt={alt}
		/>
	);
}
