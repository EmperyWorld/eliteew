/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Search Admin surfaces matrix tab.
 *
 * Related:
 * - `pages/Admin/adminSearchApi.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	type SearchMetaResponse,
	type SearchSurfaceKey,
	getAdminSearchMeta,
} from '../adminSearchApi';

export interface SearchSurfacesTabProps {
	onSimulateSurface?: (surface: SearchSurfaceKey) => void;
}

export function SearchSurfacesTab({
	onSimulateSurface,
}: SearchSurfacesTabProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [meta, setMeta] = React.useState<SearchMetaResponse | null>(null);
	const [loading, setLoading] = React.useState(false);

	const load = React.useCallback(async () => {
		setLoading(true);
		try {
			setMeta(await getAdminSearchMeta());
		} catch (error) {
			log.error(
				'SearchSurfacesTab',
				'load failed',
				error instanceof Error ? error : undefined
			);
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		void load();
	}, [load]);

	if (loading && !meta) {
		return (
			<p className={DESKTOP_TYPOGRAPHY.meta}>{t('adminSearch.loading')}</p>
		);
	}

	if (!meta) {
		return (
			<p className={DESKTOP_TYPOGRAPHY.meta}>
				{t('adminSearch.metaLoadError')}
			</p>
		);
	}

	return (
		<div className="overflow-auto rounded-lg border border-white/10">
			<table className="min-w-full text-left text-sm text-slate-200">
				<thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
					<tr>
						<th className="px-3 py-2">{t('adminSearch.colSurface')}</th>
						<th className="px-3 py-2">{t('adminSearch.colEnabled')}</th>
						<th className="px-3 py-2">{t('adminSearch.colProvider')}</th>
						<th className="px-3 py-2">{t('adminSearch.colSource')}</th>
						<th className="px-3 py-2">{t('adminSearch.colBlockers')}</th>
						<th className="px-3 py-2">{t('adminSearch.colActions')}</th>
					</tr>
				</thead>
				<tbody>
					{meta.surfaces.map((row) => (
						<tr key={row.id} className="border-t border-white/5">
							<td className="px-3 py-2 font-mono text-xs">{row.id}</td>
							<td className="px-3 py-2">
								{row.enabled
									? t('adminSearchConfig.yes')
									: t('adminSearchConfig.no')}
							</td>
							<td className="px-3 py-2">{row.resolved_provider ?? '—'}</td>
							<td className="px-3 py-2">{row.source}</td>
							<td className="px-3 py-2 text-xs text-amber-200/90">
								{row.blockers.length
									? row.blockers.join(', ')
									: t('adminSearch.none')}
							</td>
							<td className="px-3 py-2">
								{onSimulateSurface ? (
									<button
										type="button"
										className={`${DESKTOP_INTERACTIVE.btnRounded} text-xs text-violet-200 hover:text-violet-100`}
										onClick={() => onSimulateSurface(row.id)}
									>
										{t('adminSearch.simulateOnSurface')}
									</button>
								) : null}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
