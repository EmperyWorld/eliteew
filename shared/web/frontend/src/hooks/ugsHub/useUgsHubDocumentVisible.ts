/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Track document visibility for UGS Hub poll backoff when the tab is hidden.
 *
 * Related:
 * - services/api/ugs/ugsHubTasksPolling.ts
 */

import { useSyncExternalStore } from 'react';

function subscribeVisibility(onStoreChange: () => void): () => void {
	document.addEventListener('visibilitychange', onStoreChange);
	return () => document.removeEventListener('visibilitychange', onStoreChange);
}

function getVisibilitySnapshot(): boolean {
	return document.visibilityState === 'visible';
}

function getServerVisibilitySnapshot(): boolean {
	return true;
}

export function useUgsHubDocumentVisible(): boolean {
	return useSyncExternalStore(
		subscribeVisibility,
		getVisibilitySnapshot,
		getServerVisibilitySnapshot
	);
}
