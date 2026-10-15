/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Admin Workers hub shell — New World tabs/refresh/banners + modular panels (Wave 3).
 *
 * Invariants:
 * - Sub-tab deep links use ?section=workers&workersTab= when URL sync is enabled.
 * - Mutating actions require emperyworld_admin (API + live JWT via hasEmperyworldAdminIdentity).
 * - Auto-refresh every 30s while the section is mounted (operator ops surface).
 * - Revoke/purge use DangerConfirmModal (no window.confirm).
 *
 * Related:
 * - `pages/Admin/shell/adminShellConfig.ts`
 * - `pages/Admin/workers/workersOpsApi.ts`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 * - documentation/platform/docker-re_doc/ADMIN-WORKERS-OPS.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { hasEmperyworldAdminIdentity } from '../../../utils/ugsAdminAccess';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { getAdminShellSectionMeta } from '../shell/adminShellConfig';
import {
	AdminButton,
	AdminSectionTabs,
	AdminStatusBanner,
	DangerConfirmModal,
} from '../ui';
import {
	readWorkersAdminTabFromUrl,
	syncWorkersAdminTabToUrl,
} from './adminWorkersUrl';
import { WorkersActionsPanel } from './WorkersActionsPanel';
import { WorkersBeatPanel } from './WorkersBeatPanel';
import { WorkersCeleryPanel } from './WorkersCeleryPanel';
import { WorkersOverviewPanel } from './WorkersOverviewPanel';
import { WorkersRabbitmqPanel } from './WorkersRabbitmqPanel';
import {
	getWorkersOpsSnapshot,
	postWorkersOpsPurgeQueue,
	postWorkersOpsRevoke,
	type WorkersAdminTab,
	type WorkersOpsSnapshot,
} from './workersOpsApi';

const AUTO_REFRESH_MS = 30_000;

type PendingDanger = 'revoke' | 'purge' | null;

export interface WorkersAdminSectionProps {
	urlSyncEnabled?: boolean;
}

export function WorkersAdminSection({
	urlSyncEnabled = true,
}: WorkersAdminSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const { user } = useAuth();
	const metaShell = getAdminShellSectionMeta('workers');
	const canMutate = hasEmperyworldAdminIdentity(user);

	const [tab, setTab] = React.useState<WorkersAdminTab>(() => {
		if (typeof window === 'undefined') return 'overview';
		return readWorkersAdminTabFromUrl() ?? 'overview';
	});
	const [snap, setSnap] = React.useState<WorkersOpsSnapshot | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [actionMsg, setActionMsg] = React.useState<string | null>(null);
	const [actionOk, setActionOk] = React.useState(false);
	const [revokeId, setRevokeId] = React.useState('');
	const [terminate, setTerminate] = React.useState(false);
	const [purgeQueue, setPurgeQueue] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const [pendingDanger, setPendingDanger] = React.useState<PendingDanger>(null);

	const selectTab = React.useCallback(
		(next: WorkersAdminTab) => {
			setTab(next);
			syncWorkersAdminTabToUrl(next, { enabled: urlSyncEnabled });
		},
		[urlSyncEnabled]
	);

	const refresh = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await getWorkersOpsSnapshot();
			setSnap(data);
			setPurgeQueue((prev) => prev || data.celery.known_queue_names[0] || '');
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	React.useEffect(() => {
		const id = window.setInterval(() => {
			void refresh();
		}, AUTO_REFRESH_MS);
		return () => window.clearInterval(id);
	}, [refresh]);

	const tabItems = React.useMemo(
		() =>
			(
				[
					'overview',
					'celery',
					'beat',
					'rabbitmq',
					'actions',
				] as WorkersAdminTab[]
			).map((id) => ({
				id,
				label: t(`adminWorkers.tabs.${id}`),
			})),
		[t]
	);

	const runRevoke = async () => {
		if (!canMutate || !revokeId.trim()) return;
		setBusy(true);
		setActionMsg(null);
		try {
			const res = await postWorkersOpsRevoke({
				task_id: revokeId.trim(),
				terminate,
			});
			setActionOk(true);
			setActionMsg(
				t('adminWorkers.revokeOk', {
					id: String(res.detail.task_id ?? revokeId),
				})
			);
			setPendingDanger(null);
			await refresh();
		} catch (e) {
			setActionOk(false);
			setActionMsg(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	};

	const runPurge = async () => {
		if (!canMutate || !purgeQueue.trim()) return;
		setBusy(true);
		setActionMsg(null);
		try {
			const res = await postWorkersOpsPurgeQueue({ queue: purgeQueue.trim() });
			setActionOk(true);
			setActionMsg(
				t('adminWorkers.purgeOk', {
					queue: purgeQueue,
					count: String(res.detail.purged ?? 0),
				})
			);
			setPendingDanger(null);
			await refresh();
		} catch (e) {
			setActionOk(false);
			setActionMsg(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<AdminSectionFrame
			variant="full"
			className="flex h-full min-h-0 flex-col !py-4"
		>
			<h2 id={metaShell.headerTitleId} className="sr-only">
				{t('adminShell.sections.workers')}
			</h2>

			<div className="mb-3 flex flex-wrap items-center gap-2">
				<AdminButton
					variant="secondary"
					disabled={loading}
					onClick={() => void refresh()}
				>
					{loading ? t('adminWorkers.refreshing') : t('adminWorkers.refresh')}
				</AdminButton>
				<span className="text-xs text-[var(--admin-ui-fg-muted)]">
					{t('adminWorkers.autoRefresh')}
				</span>
			</div>

			{error ? (
				<AdminStatusBanner tone="danger" className="mb-3">
					{error}
				</AdminStatusBanner>
			) : null}

			<AdminSectionTabs
				className="mb-4"
				tabs={tabItems}
				activeId={tab}
				onChange={(id) => selectTab(id as WorkersAdminTab)}
			/>

			<div className="min-h-0 flex-1 overflow-auto">
				{tab === 'overview' ? <WorkersOverviewPanel snap={snap} t={t} /> : null}
				{tab === 'celery' ? <WorkersCeleryPanel snap={snap} t={t} /> : null}
				{tab === 'beat' ? <WorkersBeatPanel snap={snap} t={t} /> : null}
				{tab === 'rabbitmq' ? <WorkersRabbitmqPanel snap={snap} t={t} /> : null}
				{tab === 'actions' ? (
					<WorkersActionsPanel
						snap={snap}
						t={t}
						canMutate={canMutate}
						busy={busy}
						actionMsg={actionMsg}
						actionOk={actionOk}
						revokeId={revokeId}
						setRevokeId={setRevokeId}
						terminate={terminate}
						setTerminate={setTerminate}
						purgeQueue={purgeQueue}
						setPurgeQueue={setPurgeQueue}
						onRequestRevoke={() => setPendingDanger('revoke')}
						onRequestPurge={() => setPendingDanger('purge')}
					/>
				) : null}
			</div>

			<DangerConfirmModal
				open={pendingDanger === 'revoke'}
				title={t('adminWorkers.revokeTitle')}
				description={t('adminWorkers.confirmRevoke')}
				confirmPhrase="REVOKE"
				busy={busy}
				onCancel={() => setPendingDanger(null)}
				onConfirm={() => void runRevoke()}
			/>
			<DangerConfirmModal
				open={pendingDanger === 'purge'}
				title={t('adminWorkers.purgeTitle')}
				description={t('adminWorkers.confirmPurge', { queue: purgeQueue })}
				confirmPhrase="PURGE"
				busy={busy}
				onCancel={() => setPendingDanger(null)}
				onConfirm={() => void runPurge()}
			/>
		</AdminSectionFrame>
	);
}
