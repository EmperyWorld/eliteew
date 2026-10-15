/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Workers Actions tab — revoke / purge on New World atoms (emperyworld_admin only).
 *
 * Invariants:
 * - Without canMutate: honest empty state only (no fake disabled forms).
 * - Mutating controls stay disabled without canMutate; API enforces role.
 * - Parent owns DangerConfirmModal; this panel only requests confirm.
 *
 * Related:
 * - `pages/Admin/workers/WorkersAdminSection.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 * - documentation/platform/docker-re_doc/ADMIN-WORKERS-OPS.md
 */

import type * as React from 'react';
import type { TFunction } from 'i18next';
import {
	AdminButton,
	AdminField,
	AdminSelect,
	AdminStatusBanner,
	AdminToggle,
} from '../ui';
import type { WorkersOpsSnapshot } from './workersOpsApi';

export function WorkersActionsPanel({
	snap,
	t,
	canMutate,
	busy,
	actionMsg,
	actionOk,
	revokeId,
	setRevokeId,
	terminate,
	setTerminate,
	purgeQueue,
	setPurgeQueue,
	onRequestRevoke,
	onRequestPurge,
}: {
	snap: WorkersOpsSnapshot | null;
	t: TFunction;
	canMutate: boolean;
	busy: boolean;
	actionMsg: string | null;
	actionOk: boolean;
	revokeId: string;
	setRevokeId: (v: string) => void;
	terminate: boolean;
	setTerminate: (v: boolean) => void;
	purgeQueue: string;
	setPurgeQueue: (v: string) => void;
	onRequestRevoke: () => void;
	onRequestPurge: () => void;
}): React.ReactElement {
	if (!canMutate) {
		return (
			<AdminStatusBanner tone="warning">
				<div className="space-y-1">
					<p className="font-medium">{t('adminWorkers.mutateDeniedTitle')}</p>
					<p>{t('adminWorkers.mutateDenied')}</p>
					<p className="text-xs opacity-80">
						{t('adminWorkers.mutateDeniedHint')}
					</p>
				</div>
			</AdminStatusBanner>
		);
	}

	return (
		<div className="max-w-2xl space-y-6">
			{actionMsg ? (
				<AdminStatusBanner tone={actionOk ? 'success' : 'danger'}>
					{actionMsg}
				</AdminStatusBanner>
			) : null}
			<section className="space-y-3 rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
				<h3 className="text-sm font-semibold text-[var(--admin-ui-fg)]">
					{t('adminWorkers.revokeTitle')}
				</h3>
				<AdminField
					aria-label={t('adminWorkers.revokeTitle')}
					className="font-mono"
					value={revokeId}
					onChange={(e) => setRevokeId(e.target.value)}
					placeholder="task-uuid"
					disabled={busy}
				/>
				<AdminToggle
					checked={terminate}
					onChange={(e) => setTerminate(e.target.checked)}
					disabled={busy}
					label={t('adminWorkers.terminate')}
				/>
				<AdminButton
					variant="danger"
					disabled={busy || !revokeId.trim()}
					onClick={onRequestRevoke}
				>
					{t('adminWorkers.revokeSubmit')}
				</AdminButton>
			</section>
			<section className="space-y-3 rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
				<h3 className="text-sm font-semibold text-[var(--admin-ui-fg)]">
					{t('adminWorkers.purgeTitle')}
				</h3>
				<AdminSelect
					aria-label={t('adminWorkers.purgeTitle')}
					className="font-mono"
					value={purgeQueue}
					onChange={(e) => setPurgeQueue(e.target.value)}
					disabled={busy}
				>
					{(snap?.celery.known_queue_names ?? []).map((q) => (
						<option key={q} value={q}>
							{q}
						</option>
					))}
				</AdminSelect>
				<AdminButton
					variant="danger"
					disabled={busy || !purgeQueue.trim()}
					onClick={onRequestPurge}
				>
					{t('adminWorkers.purgeSubmit')}
				</AdminButton>
			</section>
		</div>
	);
}
