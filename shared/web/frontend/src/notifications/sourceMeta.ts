/**
 * Shared metadata for notification sources used by socket bridge, sound routing and hub UI.
 */

export type NotificationSourceKey =
	| 'default'
	| 'gaf_chat'
	| 'ugs'
	| 'doc_editor'
	| 'friends'
	| 'business_intelligence'
	| 'server';

const SOURCE_ALIAS_MAP: Record<string, NotificationSourceKey> = {
	default: 'default',
	gaf_chat: 'gaf_chat',
	ugs: 'ugs',
	doc_editor: 'doc_editor',
	friends: 'friends',
	business_intelligence: 'business_intelligence',
	bi: 'business_intelligence',
	server: 'server',
	system: 'server',
};

export const NOTIFICATION_SOURCE_ORDER: readonly NotificationSourceKey[] = [
	'default',
	'gaf_chat',
	'ugs',
	'doc_editor',
	'friends',
	'business_intelligence',
	'server',
];

export function normalizeNotificationSource(
	raw: string | null | undefined
): NotificationSourceKey {
	if (!raw || typeof raw !== 'string') return 'default';
	const key = raw.trim().toLowerCase();
	return SOURCE_ALIAS_MAP[key] ?? 'server';
}

export function getNotificationSourceI18nKey(
	raw: string | null | undefined
): string {
	return `sources.${normalizeNotificationSource(raw)}`;
}

export function getNotificationSourceToastClassName(
	raw: string | null | undefined
): string {
	const source = normalizeNotificationSource(raw);
	if (source === 'gaf_chat') return 'data-[type=info]:border-cyan-400/60';
	if (source === 'ugs') return 'data-[type=info]:border-violet-400/60';
	if (source === 'doc_editor') return 'data-[type=info]:border-emerald-400/60';
	if (source === 'friends') return 'data-[type=info]:border-pink-400/60';
	if (source === 'business_intelligence')
		return 'data-[type=info]:border-amber-400/60';
	return '';
}
