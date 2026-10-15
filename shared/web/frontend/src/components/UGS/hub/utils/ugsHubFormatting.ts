/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

/**
 * Purpose:
 * Date/time formatting helpers for UGS Hub shell and modals.
 * Invariants:
 * - Callers pass active i18n locale for relative/absolute timestamps.
 * Related:
 * - ugsHubResultContent.tsx
 * - components/UGSHub.tsx
 */

export const cn = (...classes: Array<string | false | null | undefined>) =>
	classes.filter(Boolean).join(' ');

export const formatDateTime = (
	value?: string | null,
	locale: string = 'ru-RU'
) => {
	if (!value) {
		return '—';
	}
	try {
		return new Date(value).toLocaleString(locale, {
			hour12: false,
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch (_error) {
		return value;
	}
};

export const formatRelativeTime = (
	value?: string | null,
	options?: { locale?: string; emptyLabel?: string }
) => {
	if (!value) {
		return options?.emptyLabel ?? '—';
	}
	const locale = options?.locale ?? 'ru';
	const relative = new Intl.RelativeTimeFormat(locale, {
		numeric: 'auto',
	});
	const date = new Date(value);
	const diff = date.getTime() - Date.now();
	const minutes = Math.round(diff / 60000);
	if (Math.abs(minutes) < 60) {
		return relative.format(minutes, 'minute');
	}
	const hours = Math.round(diff / 3600000);
	if (Math.abs(hours) < 24) {
		return relative.format(hours, 'hour');
	}
	const days = Math.round(diff / 86400000);
	return relative.format(days, 'day');
};
