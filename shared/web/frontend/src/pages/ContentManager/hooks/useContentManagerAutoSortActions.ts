/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Auto-sort to system folders confirmation flow and execution for Content Manager explorer/catalog.
 *
 * Invariants:
 * - Scope confirmation is required before mutating folder assignments.
 *
 * Related:
 * - ContentManagerPro.tsx, sortToSystemFolders.ts
 */
import { useCallback, useState } from 'react';
import type { TFunction } from 'i18next';
import { notify } from '../../../notifications';
import { getApiErrorMessage } from '../../../utils/apiError';
import { logUxError } from '../../../utils/logger';
import {
	applyAutoSortToSystemFolders,
	fetchAllForAutoSort,
	type AutoSortScope,
} from '../sortToSystemFolders';
import { getContentRecoveryHint } from '../utils/contentManagerProRecovery';

export type UseContentManagerAutoSortActionsParams = {
	t: TFunction<'contentManager'>;
	fetchContent: () => void | Promise<void>;
	fetchStats: () => void | Promise<void>;
	fetchFolders: () => void | Promise<void>;
};

export function useContentManagerAutoSortActions({
	t,
	fetchContent,
	fetchStats,
	fetchFolders,
}: UseContentManagerAutoSortActionsParams) {
	const [autoSortBusy, setAutoSortBusy] = useState(false);
	const [autoSortConfirmScope, setAutoSortConfirmScope] =
		useState<AutoSortScope | null>(null);

	const runAutoSortToSystemFolders = useCallback((scope: AutoSortScope) => {
		setAutoSortConfirmScope(scope);
	}, []);

	const executeAutoSortToSystemFolders = useCallback(
		async (scope: AutoSortScope) => {
			setAutoSortBusy(true);
			try {
				const sortItems = await fetchAllForAutoSort(scope);
				if (sortItems.length === 0) {
					notify.info(t('files.autoSort.nothing'), '', { duration: 4000 });
					return;
				}
				const result = await applyAutoSortToSystemFolders(sortItems, scope);
				const summary = t('files.autoSort.done', {
					moved: result.moved,
					skipped: result.skipped,
					errors: result.errors,
				});
				const readOnlyNote =
					result.skippedNoPermission > 0
						? ` ${t('files.autoSort.skippedReadOnlyNote', {
								count: result.skippedNoPermission,
							})}`
						: '';
				notify.success(`${summary}${readOnlyNote}`, '', { duration: 8000 });
				await fetchContent();
				await fetchStats();
				await fetchFolders();
			} catch (err) {
				const msg = getApiErrorMessage(err);
				const hint = getContentRecoveryHint('update', err, t);
				logUxError(
					'ContentManagerPro',
					'unified_content',
					'update',
					err instanceof Error ? err : undefined,
					{ message: msg, hint }
				);
				notify.error(t('files.autoSort.failed'), `${msg}. ${hint}`, {
					duration: 6000,
				});
				throw err instanceof Error ? err : new Error(msg);
			} finally {
				setAutoSortBusy(false);
			}
		},
		[fetchContent, fetchFolders, fetchStats, t]
	);

	return {
		autoSortBusy,
		autoSortConfirmScope,
		setAutoSortConfirmScope,
		runAutoSortToSystemFolders,
		executeAutoSortToSystemFolders,
	} as const;
}
