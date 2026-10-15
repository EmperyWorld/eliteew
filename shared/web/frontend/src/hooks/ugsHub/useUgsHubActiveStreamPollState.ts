/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Subscribe to UGS active SSE stream count for Hub compact poll + backoff.
 *
 * Related:
 * - services/api/ugs/ugsActiveStreamRegistry.ts
 * - services/api/ugs/ugsHubTasksPolling.ts
 */

import { useSyncExternalStore } from 'react';

import {
	getUgsActiveStreamCount,
	subscribeUgsActiveStreams,
} from '../../services/api/ugs/ugsActiveStreamRegistry';

export function useUgsHubActiveStreamPollState() {
	const activeStreamCount = useSyncExternalStore(
		subscribeUgsActiveStreams,
		getUgsActiveStreamCount,
		getUgsActiveStreamCount
	);

	return {
		activeStreamCount,
		compactTasksPoll: activeStreamCount > 0,
	};
}
