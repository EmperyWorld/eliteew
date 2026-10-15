import type { DiagnosticModuleId } from './diagnosticTypes';

const KNOWN_MODULES = new Set<DiagnosticModuleId>([
	'archetype',
	'values',
	'business',
	'service',
	'emotions',
]);

/** Короткая дата/время для подписей в UI диагностики (ISO с сервера). */
export function formatDiagnosticIsoDateTime(
	iso: string | null | undefined,
	locale: string
): string {
	if (!iso?.trim()) return '—';
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return iso;
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'short',
		timeStyle: 'short',
	}).format(new Date(t));
}

/** Подпись модуля для админки / отчёта лида (ключи из API). */
export function formatDiagnosticModuleKeyLabel(
	key: string,
	tCustomerCabinet: (key: string) => string
): string {
	if (KNOWN_MODULES.has(key as DiagnosticModuleId)) {
		return tCustomerCabinet(`diagnostic.moduleSubtitle.${key}`);
	}
	return key;
}
