/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Нормализация статуса Yjs WebSocket для UI коллаборации (шаг C persistence roadmap).
 *
 * Invariants:
 * - Чистые функции; без React и без обращения к store.
 *
 * Related:
 * - `hooks/useYjsCollaboration.ts`, `EditorCore/TiptapEditorCollaboration.tsx`
 */

export type DocEditorYjsConnectionStatus =
	| 'idle'
	| 'connecting'
	| 'synced'
	| 'reconnecting'
	| 'offline';

export type YjsProviderConnectionStatus =
	| 'connecting'
	| 'connected'
	| 'disconnected';

export interface ResolveDocEditorYjsConnectionStatusParams {
	enabled: boolean;
	providerStatus: YjsProviderConnectionStatus | null;
	yjsEditorReady: boolean;
	hasFatalError: boolean;
}

/** Сводит события y-websocket + готовность редактора в один статус для панели коллаба. */
export function resolveDocEditorYjsConnectionStatus(
	params: ResolveDocEditorYjsConnectionStatusParams
): DocEditorYjsConnectionStatus {
	const { enabled, providerStatus, yjsEditorReady, hasFatalError } = params;
	if (!enabled) {
		return 'idle';
	}
	if (hasFatalError) {
		return 'offline';
	}
	if (providerStatus === 'disconnected') {
		return 'reconnecting';
	}
	if (providerStatus === 'connecting') {
		return 'connecting';
	}
	if (providerStatus === 'connected') {
		return yjsEditorReady ? 'synced' : 'connecting';
	}
	return 'connecting';
}
