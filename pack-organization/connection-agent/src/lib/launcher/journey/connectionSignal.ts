/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map living portal / W-transport codes to four user-facing connection levels.
 *
 * Invariants:
 * - Primary UI never surfaces peer IPs or SOCKS URLs.
 * - Levels: protected | connecting | unstable | down.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.4
 * - lib/tunnel/wTransportPortalMap.ts
 */

export type ConnectionSignalLevel =
	| 'protected'
	| 'connecting'
	| 'unstable'
	| 'down';

const PROTECTED = new Set(['protected', 'ok', 'unit_active']);
const CONNECTING = new Set([
	'socks_listening',
	'socks_up',
	'starting',
	'connecting',
	'handshake',
	'channel_pending',
	'reconnecting',
]);
const UNSTABLE = new Set([
	'channel_unconfirmed',
	'channel_unstable',
	'degraded',
	'unstable',
	'l7_fail',
]);

export function connectionSignalFromPortalCode(
	code: string | null | undefined
): ConnectionSignalLevel {
	const c = (code ?? '').trim().toLowerCase();
	if (!c || c === 'down' || c === 'stopped' || c === 'error') return 'down';
	if (PROTECTED.has(c)) return 'protected';
	if (CONNECTING.has(c)) return 'connecting';
	if (UNSTABLE.has(c)) return 'unstable';
	return 'down';
}

const SIGNAL_LABEL_RU: Record<ConnectionSignalLevel, string> = {
	protected: 'Защищено',
	connecting: 'Подключение…',
	unstable: 'Нестабильно',
	down: 'Нет канала',
};

const SIGNAL_HINT_RU: Record<ConnectionSignalLevel, string> = {
	/* Channel posture only — never promise Start; license gate owns that CTA. */
	protected: 'Защищённый канал активен.',
	connecting:
		'Канал поднимается. Подождите или нажмите «Проверить соединение».',
	unstable: 'Канал есть, но подтверждение неполное. Проверьте соединение.',
	down: 'Защищённый канал недоступен. Проверьте соединение или импортируйте доступ заново.',
};

export function connectionSignalLabelRu(level: ConnectionSignalLevel): string {
	return SIGNAL_LABEL_RU[level];
}

export function connectionSignalHintRu(level: ConnectionSignalLevel): string {
	return SIGNAL_HINT_RU[level];
}

export function connectionSignalTone(
	level: ConnectionSignalLevel
): 'ok' | 'warn' | 'danger' | 'neutral' {
	if (level === 'protected') return 'ok';
	if (level === 'connecting') return 'neutral';
	if (level === 'unstable') return 'warn';
	return 'danger';
}

/** Reject leaking infra strings into primary connection copy. */
export function connectionCopyLeaksInfra(text: string): boolean {
	return (
		/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(text) ||
		/socks5?:\/\//i.test(text) ||
		/\b10\.77\.77\.\d+\b/.test(text)
	);
}
