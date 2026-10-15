/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure copy helper for EBrowser navigation deny banners (SPA + native IPC).
 *
 * Related:
 * - pages/Desktop/apps/EBrowserApp.tsx
 * - documentation/product/desktop/DESKTOP-EBROWSER.md
 */

export function ebrowserPolicyDeniedMessage(
	policyIsDefault: boolean,
	code?: string | null
): string {
	if (
		code === 'policy_auth_required' ||
		code === 'policy_unauthorized' ||
		code === 'policy_fetch_failed' ||
		code === 'policy_invalid'
	) {
		return 'Не удалось подтвердить политику навигации. Обновите сессию и повторите.';
	}
	if (code === 'policy_denied' || code == null || code === '') {
		return policyIsDefault
			? 'Для вашей учётки ещё нет политики навигации: сайты закрыты, пока администратор не настроит доступ.'
			: 'Адрес заблокирован политикой навигации.';
	}
	return 'Не удалось открыть страницу.';
}

export function ebrowserPrecheckDeniedMessage(
	reason: string,
	policyIsDefault: boolean
): string {
	if (reason === 'expired' || reason === 'missing_policy') {
		return 'Политика навигации недоступна или устарела. Обновите окно и повторите.';
	}
	return policyIsDefault
		? 'Для вашей учётки ещё нет политики навигации: сайты закрыты, пока администратор не настроит доступ.'
		: 'Адрес заблокирован политикой навигации.';
}
