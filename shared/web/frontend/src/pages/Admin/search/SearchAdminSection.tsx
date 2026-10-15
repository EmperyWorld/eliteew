/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Search Admin hub with tabbed navigation (overview, settings, test, diagnostics, audit).
 *
 * Invariants:
 * - Sub-tab deep links use ?section=search&searchTab= when URL sync is enabled.
 *
 * Related:
 * - `pages/Admin/shell/adminShellConfig.ts`
 * - `pages/Admin/adminSearchApi.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE } from '../../Desktop/constants';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { getAdminShellSectionMeta } from '../shell/adminShellConfig';
import type { SearchAdminTab, SearchSurfaceKey } from '../adminSearchApi';
import {
	readSearchAdminTabFromUrl,
	syncSearchAdminTabToUrl,
} from './adminSearchUrl';
import { SearchOverviewTab } from './SearchOverviewTab';
import { SearchSettingsTab } from './SearchSettingsTab';
import { SearchSurfacesTab } from './SearchSurfacesTab';
import { SearchTestTab } from './SearchTestTab';
import { SearchDiagnosticsTab } from './SearchDiagnosticsTab';
import { SearchAuditTab } from './SearchAuditTab';
import { SearchQuotaTab } from './SearchQuotaTab';
import { SearchStatsTab } from './SearchStatsTab';

export interface SearchAdminSectionProps {
	urlSyncEnabled?: boolean;
	onOpenUserInAdmin?: (userId: string) => void;
}

export function SearchAdminSection({
	urlSyncEnabled = true,
	onOpenUserInAdmin,
}: SearchAdminSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const metaShell = getAdminShellSectionMeta('search');
	const [tab, setTab] = React.useState<SearchAdminTab>(() => {
		if (typeof window === 'undefined') return 'overview';
		return readSearchAdminTabFromUrl() ?? 'overview';
	});
	const [refreshToken, setRefreshToken] = React.useState(0);
	const [testSurface, setTestSurface] = React.useState<
		SearchSurfaceKey | undefined
	>(undefined);

	const selectTab = React.useCallback(
		(next: SearchAdminTab) => {
			setTab(next);
			syncSearchAdminTabToUrl(next, { enabled: urlSyncEnabled });
		},
		[urlSyncEnabled]
	);

	const bumpRefresh = React.useCallback(() => {
		setRefreshToken((n) => n + 1);
	}, []);

	const tabLabels: Record<SearchAdminTab, string> = {
		overview: t('adminSearch.tabOverview'),
		settings: t('adminSearch.tabSettings'),
		surfaces: t('adminSearch.tabSurfaces'),
		test: t('adminSearch.tabTest'),
		diagnostics: t('adminSearch.tabDiagnostics'),
		audit: t('adminSearch.tabAudit'),
		quota: t('adminSearch.tabQuota'),
		stats: t('adminSearch.tabStats'),
	};

	const simulateOnSurface = (surface: SearchSurfaceKey) => {
		setTestSurface(surface);
		selectTab('test');
	};

	return (
		<AdminSectionFrame
			variant="full"
			className="flex h-full min-h-0 flex-col !py-4"
		>
			<h2 id={metaShell.headerTitleId} className="sr-only">
				{t('adminShell.sections.search')}
			</h2>

			<nav
				className="mb-4 flex flex-wrap gap-2"
				aria-label={t('adminSearch.tabsAria')}
			>
				{(Object.keys(tabLabels) as SearchAdminTab[]).map((id) => (
					<button
						key={id}
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-sm ${
							tab === id
								? 'bg-violet-600/30 text-white ring-1 ring-violet-400/40'
								: 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
						}`}
						onClick={() => selectTab(id)}
					>
						{tabLabels[id]}
					</button>
				))}
			</nav>

			<div className="min-h-0 flex-1 overflow-auto">
				{tab === 'overview' ? (
					<SearchOverviewTab
						key={`overview-${refreshToken}`}
						onOpenTest={() => selectTab('test')}
						onOpenDiagnostics={() => selectTab('diagnostics')}
					/>
				) : null}
				{tab === 'settings' ? (
					<SearchSettingsTab
						key={`settings-${refreshToken}`}
						onSaved={bumpRefresh}
						onOpenDiagnostics={() => selectTab('diagnostics')}
					/>
				) : null}
				{tab === 'surfaces' ? (
					<SearchSurfacesTab
						key={`surfaces-${refreshToken}`}
						onSimulateSurface={simulateOnSurface}
					/>
				) : null}
				{tab === 'test' ? <SearchTestTab initialSurface={testSurface} /> : null}
				{tab === 'diagnostics' ? <SearchDiagnosticsTab /> : null}
				{tab === 'audit' ? <SearchAuditTab /> : null}
				{tab === 'quota' ? (
					<SearchQuotaTab onOpenUserInAdmin={onOpenUserInAdmin} />
				) : null}
				{tab === 'stats' ? <SearchStatsTab /> : null}
			</div>
		</AdminSectionFrame>
	);
}
