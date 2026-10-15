/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Loads current-user storage quota from GET /content/quota/me for Content Manager UI.
 *
 * Invariants:
 * - Displayed quota bytes come only from contentApi.getQuotaMe(), never hardcoded limits.
 * - Silent refetch keeps the last known values visible while refreshing.
 *
 * Related:
 * - useContentManagerInsights.ts
 * - components/ContentManagerAnalyticsTab.tsx
 */
import { useCallback, useEffect, useState } from 'react';
import { contentApi } from '../../../services/contentApi';
import { log } from '../../../utils/logger';

export function useContentManagerQuota() {
	const [quotaBytesUsed, setQuotaBytesUsed] = useState<number | null>(null);
	const [quotaBytesLimit, setQuotaBytesLimit] = useState<number | null>(null);
	const [quotaLoading, setQuotaLoading] = useState(true);
	const [quotaError, setQuotaError] = useState<string | null>(null);

	const fetchQuota = useCallback(async (options?: { silent?: boolean }) => {
		if (!options?.silent) {
			setQuotaLoading(true);
		}
		setQuotaError(null);
		try {
			const quota = await contentApi.getQuotaMe();
			setQuotaBytesUsed(quota.bytes_used);
			setQuotaBytesLimit(quota.quota_bytes);
		} catch (error) {
			setQuotaBytesUsed(null);
			setQuotaBytesLimit(null);
			const message = error instanceof Error ? error.message : String(error);
			setQuotaError(message);
			log.warn('useContentManagerQuota', `fetchQuota: ${message}`);
		} finally {
			setQuotaLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchQuota();
	}, [fetchQuota]);

	return {
		quotaBytesUsed,
		quotaBytesLimit,
		quotaLoading,
		quotaError,
		fetchQuota,
	};
}
