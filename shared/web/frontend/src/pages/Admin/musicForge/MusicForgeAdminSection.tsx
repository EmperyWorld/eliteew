/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified MusicForge Admin hub with New World tab strip (overview, runs, feedback, config, probe).
 *
 * Invariants:
 * - Sub-tab deep links use ?section=musicForge&musicForgeTab= when URL sync is enabled.
 * - Config tab: revisions list + draft editor (`MusicForgeConfigEditor`); envelope-only list.
 * - Runs tab: list + read-only Run Inspector (`MusicForgeRunInspector`) — not Stage Desk.
 *
 * Related:
 * - `pages/Admin/shell/adminShellConfig.ts`
 * - `pages/Admin/musicForge/MusicForgeAdminPanels.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { getAdminShellSectionMeta } from '../shell/adminShellConfig';
import { AdminSectionTabs } from '../ui';
import type { MusicForgeAdminTab } from './musicForgeAdminApi';
import {
	ConfigPanel,
	FeedbackPanel,
	OverviewPanel,
	ProbePanel,
	RunsPanel,
} from './MusicForgeAdminPanels';
import {
	readMusicForgeAdminTabFromUrl,
	syncMusicForgeAdminTabToUrl,
} from './musicForgeAdminUrl';

export interface MusicForgeAdminSectionProps {
	urlSyncEnabled?: boolean;
}

export function MusicForgeAdminSection({
	urlSyncEnabled = true,
}: MusicForgeAdminSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const metaShell = getAdminShellSectionMeta('musicForge');
	const [tab, setTab] = React.useState<MusicForgeAdminTab>(() => {
		if (typeof window === 'undefined') return 'overview';
		return readMusicForgeAdminTabFromUrl() ?? 'overview';
	});

	const selectTab = React.useCallback(
		(next: MusicForgeAdminTab) => {
			setTab(next);
			syncMusicForgeAdminTabToUrl(next, { enabled: urlSyncEnabled });
		},
		[urlSyncEnabled]
	);

	const tabItems = React.useMemo(
		() =>
			(
				[
					'overview',
					'runs',
					'feedback',
					'config',
					'probe',
				] as MusicForgeAdminTab[]
			).map((id) => ({
				id,
				label: t(`adminMusicForge.tabs.${id}`),
			})),
		[t]
	);

	return (
		<AdminSectionFrame
			variant="full"
			className="flex h-full min-h-0 flex-col py-4!"
		>
			<h2 id={metaShell.headerTitleId} className="sr-only">
				{t('adminShell.sections.musicForge')}
			</h2>

			<AdminSectionTabs
				className="mb-4"
				tabs={tabItems}
				activeId={tab}
				onChange={(id) => selectTab(id as MusicForgeAdminTab)}
			/>

			<div className="min-h-0 flex-1 overflow-auto">
				{tab === 'overview' ? <OverviewPanel /> : null}
				{tab === 'runs' ? <RunsPanel /> : null}
				{tab === 'feedback' ? <FeedbackPanel /> : null}
				{tab === 'config' ? <ConfigPanel /> : null}
				{tab === 'probe' ? <ProbePanel /> : null}
			</div>
		</AdminSectionFrame>
	);
}
