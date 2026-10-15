/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Content Admin hub with tabbed navigation (overview, diagnostics, quota, processing-failures, storage-ops).
 *
 * Invariants:
 * - Sub-tab deep links use ?section=content&contentTab= when URL sync is enabled.
 *
 * Related:
 * - `pages/Admin/shell/adminShellConfig.ts`
 * - `pages/Admin/contentAdminApi.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE } from '../../Desktop/constants';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { getAdminShellSectionMeta } from '../shell/adminShellConfig';
import type { ContentAdminTab } from '../contentAdminApi';
import {
	readContentAdminTabFromUrl,
	syncContentAdminTabToUrl,
} from './adminContentUrl';
import { ContentOverviewTab } from './ContentOverviewTab';
import { ContentDiagnosticsTab } from './ContentDiagnosticsTab';
import { ContentQuotaTab } from './ContentQuotaTab';
import { ContentProcessingFailuresTab } from './ContentProcessingFailuresTab';
import { ContentStorageOpsTab } from './ContentStorageOpsTab';

export interface ContentAdminSectionProps {
	urlSyncEnabled?: boolean;
	onOpenUserInAdmin?: (userId: string) => void;
}

export function ContentAdminSection({
	urlSyncEnabled = true,
	onOpenUserInAdmin,
}: ContentAdminSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const metaShell = getAdminShellSectionMeta('content');
	const [tab, setTab] = React.useState<ContentAdminTab>(() => {
		if (typeof window === 'undefined') return 'overview';
		return readContentAdminTabFromUrl() ?? 'overview';
	});
	const selectTab = React.useCallback(
		(next: ContentAdminTab) => {
			setTab(next);
			syncContentAdminTabToUrl(next, { enabled: urlSyncEnabled });
		},
		[urlSyncEnabled]
	);

	const tabLabels: Record<ContentAdminTab, string> = {
		overview: t('adminContent.tabOverview'),
		diagnostics: t('adminContent.tabDiagnostics'),
		quota: t('adminContent.tabQuota'),
		'processing-failures': t('adminContent.tabProcessingFailures'),
		'storage-ops': t('adminContent.tabStorageOps'),
	};

	return (
		<AdminSectionFrame
			variant="full"
			className="flex h-full min-h-0 flex-col py-4!"
		>
			<h2 id={metaShell.headerTitleId} className="sr-only">
				{t('adminShell.sections.content')}
			</h2>

			<nav
				className="mb-4 flex flex-wrap gap-2"
				aria-label={t('adminContent.tabsAria')}
			>
				{(Object.keys(tabLabels) as ContentAdminTab[]).map((id) => (
					<button
						key={id}
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-sm ${
							tab === id
								? 'bg-violet-600/30 text-white ring-1 ring-violet-400/40'
								: 'bg-white/4 text-slate-300 hover:bg-white/8'
						}`}
						onClick={() => selectTab(id)}
					>
						{tabLabels[id]}
					</button>
				))}
			</nav>

			<div className="min-h-0 flex-1 overflow-auto">
				{tab === 'overview' ? (
					<ContentOverviewTab
						onOpenDiagnostics={() => selectTab('diagnostics')}
						onOpenProcessingFailures={() => selectTab('processing-failures')}
						onOpenStorageOps={() => selectTab('storage-ops')}
					/>
				) : null}
				{tab === 'diagnostics' ? <ContentDiagnosticsTab /> : null}
				{tab === 'quota' ? (
					<ContentQuotaTab onOpenUserInAdmin={onOpenUserInAdmin} />
				) : null}
				{tab === 'processing-failures' ? (
					<ContentProcessingFailuresTab />
				) : null}
				{tab === 'storage-ops' ? <ContentStorageOpsTab /> : null}
			</div>
		</AdminSectionFrame>
	);
}
