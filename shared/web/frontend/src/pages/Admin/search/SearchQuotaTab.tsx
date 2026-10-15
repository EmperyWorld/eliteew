/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Search Admin quota lookup tab with deep-link to Users section.
 *
 * Related:
 * - `pages/Desktop/services/desktopAdminApi.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	getUserWebSearchQuota,
	type WebSearchQuotaStatus,
} from '../../Desktop/services/desktopAdminApi';

export interface SearchQuotaTabProps {
	onOpenUserInAdmin?: (userId: string) => void;
}

export function SearchQuotaTab({
	onOpenUserInAdmin,
}: SearchQuotaTabProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [userId, setUserId] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [quota, setQuota] = React.useState<WebSearchQuotaStatus | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	const lookup = React.useCallback(async () => {
		const id = userId.trim();
		if (!id) return;
		setLoading(true);
		setError(null);
		setQuota(null);
		try {
			setQuota(await getUserWebSearchQuota(id));
		} catch (err) {
			log.error(
				'SearchQuotaTab',
				'quota lookup failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminSearch.quotaLookupError'));
		} finally {
			setLoading(false);
		}
	}, [t, userId]);

	return (
		<div className="space-y-4 max-w-lg">
			<p className={DESKTOP_TYPOGRAPHY.meta}>{t('adminSearch.quotaHint')}</p>
			<label className="flex flex-col gap-1">
				<span className={DESKTOP_TYPOGRAPHY.caption}>
					{t('adminSearch.testUserId')}
				</span>
				<input
					type="text"
					className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
					value={userId}
					onChange={(e) => setUserId(e.target.value)}
					placeholder="UUID"
				/>
			</label>
			<button
				type="button"
				disabled={loading || !userId.trim()}
				onClick={() => void lookup()}
				className={`${DESKTOP_INTERACTIVE.btnRounded} bg-violet-600/80 px-4 py-2 text-sm text-white disabled:opacity-50`}
			>
				{loading ? t('adminSearch.loading') : t('adminSearch.quotaLookup')}
			</button>

			{error ? (
				<p className={`${DESKTOP_TYPOGRAPHY.body} text-red-300`}>{error}</p>
			) : null}

			{quota ? (
				<div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
					<p>
						{t('adminUserDetail.webSearchUsage', {
							used: quota.monthly_used,
							limit: quota.monthly_limit,
							remaining: quota.total_remaining,
							coins: quota.coins,
						})}
					</p>
					{onOpenUserInAdmin ? (
						<button
							type="button"
							className={`${DESKTOP_INTERACTIVE.btnRounded} mt-3 text-xs text-violet-200 hover:text-violet-100`}
							onClick={() => onOpenUserInAdmin(userId.trim())}
						>
							{t('adminSearch.openInUsers')}
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
