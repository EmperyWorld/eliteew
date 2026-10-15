import type { User } from '@/services';

/**
 * Подпись в UI для текущего пользователя: отображаемое имя из профиля, иначе логин / email.
 * Идентификация в API и поиск по-прежнему через username / id.
 */
export function getUserDisplayName(user: User | null | undefined): string {
	if (!user) return '';
	const d = user.profile?.display_name?.trim();
	if (d) return d;
	const u = user.username?.trim();
	if (u) return u;
	const em = user.email?.trim();
	if (em) {
		const at = em.split('@')[0];
		return at ?? '';
	}
	return '';
}
