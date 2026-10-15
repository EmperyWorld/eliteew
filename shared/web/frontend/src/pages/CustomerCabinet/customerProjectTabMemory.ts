export type CustomerProjectTab =
	| 'summary'
	| 'diagnostic'
	| 'documents'
	| 'presentations'
	| 'chat';

/** Только на время жизни вкладки/приложения в памяти; без localStorage/sessionStorage. */
const memory = new Map<string, CustomerProjectTab>();

export function getRememberedCustomerTab(
	projectId: string
): CustomerProjectTab {
	return memory.get(projectId) ?? 'summary';
}

export function rememberCustomerTab(
	projectId: string,
	tab: CustomerProjectTab
): void {
	memory.set(projectId, tab);
}

/** Пользователь уже переключал вкладку в этом сеансе (не только дефолт «Сводка»). */
export function hasStoredTabPreference(projectId: string): boolean {
	return memory.has(projectId);
}
