import type { ProfileFieldVisibility } from '@/types/profile';

/** Russian labels for profile field visibility (UI). */
export const PROFILE_FIELD_VISIBILITY_LABELS: Record<
	ProfileFieldVisibility,
	string
> = {
	everyone: 'Все',
	friends_only: 'Только друзья',
	none: 'Никто',
	circle: 'Только круг',
};

export function profileFieldVisibilityLabel(v: string): string {
	return PROFILE_FIELD_VISIBILITY_LABELS[v as ProfileFieldVisibility] ?? v;
}
