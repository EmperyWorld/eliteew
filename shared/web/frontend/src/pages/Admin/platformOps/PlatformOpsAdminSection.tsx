/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Admin Platform Ops hub — stack0 deploy line, Podman egress, portal peers.
 *
 * Invariants:
 * - Sub-tab deep links use ?section=platformOps&platformOpsTab=.
 * - stack0/egress remain read-only; portalPeers may mutate (admin JWT).
 *
 * Related:
 * - `pages/Admin/shell/adminShellConfig.ts`
 * - `pages/Admin/platformOps/platformOpsApi.ts`
 * - documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE } from '../../Desktop/constants';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { getAdminShellSectionMeta } from '../shell/adminShellConfig';
import {
	readPlatformOpsAdminTabFromUrl,
	syncPlatformOpsAdminTabToUrl,
} from './adminPlatformOpsUrl';
import { PlatformOpsEgressPanel } from './PlatformOpsEgressPanel';
import { PlatformOpsPortalPeersPanel } from './PlatformOpsPortalPeersPanel';
import { PlatformOpsStack0Panel } from './PlatformOpsStack0Panel';
import {
	getPlatformOpsEgressStatus,
	getPlatformOpsStack0Status,
	type PlatformOpsAdminTab,
	type PlatformOpsEgressStatus,
	type PlatformOpsStack0Status,
} from './platformOpsApi';

const AUTO_REFRESH_MS = 30_000;

const TABS: readonly PlatformOpsAdminTab[] = [
	'stack0',
	'egress',
	'portalPeers',
];

export interface PlatformOpsAdminSectionProps {
	urlSyncEnabled?: boolean;
}

export function PlatformOpsAdminSection({
	urlSyncEnabled = true,
}: PlatformOpsAdminSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const metaShell = getAdminShellSectionMeta('platformOps');

	const [tab, setTab] = React.useState<PlatformOpsAdminTab>(() => {
		if (typeof window === 'undefined') return 'stack0';
		return readPlatformOpsAdminTabFromUrl() ?? 'stack0';
	});
	const [stack0, setStack0] = React.useState<PlatformOpsStack0Status | null>(
		null
	);
	const [egress, setEgress] = React.useState<PlatformOpsEgressStatus | null>(
		null
	);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const selectTab = React.useCallback(
		(next: PlatformOpsAdminTab) => {
			setTab(next);
			syncPlatformOpsAdminTabToUrl(next, { enabled: urlSyncEnabled });
		},
		[urlSyncEnabled]
	);

	const refresh = React.useCallback(async () => {
		if (tab === 'portalPeers') {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const [stack0Snap, egressSnap] = await Promise.all([
				getPlatformOpsStack0Status(),
				getPlatformOpsEgressStatus(),
			]);
			setStack0(stack0Snap);
			setEgress(egressSnap);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setLoading(false);
		}
	}, [tab]);

	React.useEffect(() => {
		void refresh();
		if (tab === 'portalPeers') {
			return;
		}
		const timer = window.setInterval(() => {
			void refresh();
		}, AUTO_REFRESH_MS);
		return () => window.clearInterval(timer);
	}, [refresh, tab]);

	return (
		<AdminSectionFrame variant="full">
			<p className="sr-only">{metaShell.description}</p>

			<div className="mb-4 flex flex-wrap items-center gap-3">
				<div
					className="eliteew-admin-hub-tabs flex flex-wrap gap-1"
					role="tablist"
					aria-label={t('adminPlatformOps.tabsAria')}
				>
					{TABS.map((id) => {
						const active = tab === id;
						return (
							<button
								key={id}
								type="button"
								role="tab"
								aria-selected={active}
								className={`${DESKTOP_INTERACTIVE.button} ${
									active
										? 'bg-white/10 text-white'
										: 'bg-transparent text-slate-400 hover:text-white'
								}`}
								onClick={() => selectTab(id)}
							>
								{t(`adminPlatformOps.tabs.${id}`)}
							</button>
						);
					})}
				</div>
				{tab !== 'portalPeers' ? (
					<>
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							onClick={() => void refresh()}
							disabled={loading}
						>
							{loading
								? t('adminPlatformOps.refreshing')
								: t('adminPlatformOps.refresh')}
						</button>
						<span className="text-xs text-slate-500">
							{t('adminPlatformOps.autoRefresh')}
						</span>
					</>
				) : null}
			</div>

			{error && tab !== 'portalPeers' ? (
				<p className="mb-4 text-sm text-rose-300" role="alert">
					{t('adminPlatformOps.loadFailed', { error })}
				</p>
			) : null}

			{tab === 'stack0' ? <PlatformOpsStack0Panel snap={stack0} t={t} /> : null}
			{tab === 'egress' ? <PlatformOpsEgressPanel snap={egress} t={t} /> : null}
			{tab === 'portalPeers' ? <PlatformOpsPortalPeersPanel t={t} /> : null}
		</AdminSectionFrame>
	);
}
