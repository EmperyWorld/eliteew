/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Admin hub for KBSEW: overview, barrels, agent access, test search.
 *
 * Related:
 * - `pages/Admin/shell/adminShellConfig.ts`
 * - `pages/Admin/kbsewAdminApi.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE } from '../../Desktop/constants';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { getAdminShellSectionMeta } from '../shell/adminShellConfig';
import type { KbsewAdminTab } from '../kbsewAdminApi';
import {
	readKbsewAdminTabFromUrl,
	syncKbsewAdminTabToUrl,
} from './adminKbsewUrl';
import { KbsewAgentAccessTab } from './KbsewAgentAccessTab';
import { KbsewBarrelsTab } from './KbsewBarrelsTab';
import { KbsewOverviewTab } from './KbsewOverviewTab';
import { KbsewTestSearchTab } from './KbsewTestSearchTab';

export interface KbsewAdminSectionProps {
	urlSyncEnabled?: boolean;
}

export function KbsewAdminSection({
	urlSyncEnabled = true,
}: KbsewAdminSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const metaShell = getAdminShellSectionMeta('kbsew');
	const [tab, setTab] = React.useState<KbsewAdminTab>(() => {
		if (typeof window === 'undefined') return 'overview';
		return readKbsewAdminTabFromUrl() ?? 'overview';
	});

	const selectTab = React.useCallback(
		(next: KbsewAdminTab) => {
			setTab(next);
			syncKbsewAdminTabToUrl(next, { enabled: urlSyncEnabled });
		},
		[urlSyncEnabled]
	);

	const tabLabels: Record<KbsewAdminTab, string> = {
		overview: t('adminKbsew.tabs.overview'),
		barrels: t('adminKbsew.tabs.barrels'),
		'agent-access': t('adminKbsew.tabs.agentAccess'),
		'test-search': t('adminKbsew.tabs.testSearch'),
	};

	return (
		<AdminSectionFrame
			variant="full"
			className="flex h-full min-h-0 flex-col !py-4"
		>
			<h2 id={metaShell.headerTitleId} className="sr-only">
				{t('adminShell.sections.kbsew')}
			</h2>

			<nav
				className="mb-4 flex flex-wrap gap-2"
				aria-label={t('adminKbsew.tabsAria')}
			>
				{(Object.keys(tabLabels) as KbsewAdminTab[]).map((id) => (
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
				{tab === 'overview' ? <KbsewOverviewTab onOpenTab={selectTab} /> : null}
				{tab === 'barrels' ? <KbsewBarrelsTab /> : null}
				{tab === 'agent-access' ? <KbsewAgentAccessTab /> : null}
				{tab === 'test-search' ? <KbsewTestSearchTab /> : null}
			</div>
		</AdminSectionFrame>
	);
}
