/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Loads user-scoped realtor quota summary for pre-run credit hints in desktop runtime panels.
 *
 * Invariants:
 * - Fetch is skipped when disabled; errors degrade to null summary without blocking UI actions.
 * - Playbook estimate lookup is hint-only and keyed by playbook_key.
 *
 * Related:
 * - api.ts GET /realtor/quota-summary
 * - components/ProfessionalWorldsQuotaEstimate.tsx
 */

import { useCallback, useEffect, useState } from 'react';

import { loadRealtorQuotaSummary } from '../api';
import type {
	RealtorQuotaPlaybookEstimate,
	RealtorQuotaSummary,
} from '../types';

export function useProfessionalWorldsQuota(options?: { enabled?: boolean }) {
	const enabled = options?.enabled ?? true;
	const [summary, setSummary] = useState<RealtorQuotaSummary | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const reload = useCallback(async () => {
		if (!enabled) {
			setSummary(null);
			setError(null);
			setLoading(false);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const next = await loadRealtorQuotaSummary();
			setSummary(next);
		} catch (caught: unknown) {
			setSummary(null);
			setError(
				caught instanceof Error
					? caught.message
					: typeof caught === 'string'
						? caught
						: 'quota_load_failed'
			);
		} finally {
			setLoading(false);
		}
	}, [enabled]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const estimateForPlaybook = useCallback(
		(playbookKey: string): RealtorQuotaPlaybookEstimate | null => {
			if (!summary || !playbookKey.trim()) {
				return null;
			}
			return (
				summary.playbook_estimates.find(
					(row) => row.playbook_key === playbookKey
				) ?? null
			);
		},
		[summary]
	);

	return {
		summary,
		loading,
		error,
		reload,
		estimateForPlaybook,
	};
}
