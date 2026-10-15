/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Site Manager Ops — KIRS collaboration GET/PATCH (Wave 3 MED gap).
 *
 * Invariants:
 * - Uses existing kirsApi clients; no Old World Admin chrome.
 * - Destructive-free: readiness/approval/notes only.
 *
 * Related:
 * - features/kirs/kirsApi.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	getKirsCollaborationState,
	updateKirsCollaborationState,
	type KirsCollaborationState,
} from '@/features/kirs/kirsApi';
import {
	AdminButton,
	AdminField,
	AdminSelect,
	AdminStatusBanner,
} from '@/pages/Admin/ui';

const READINESS: KirsCollaborationState['readiness_status'][] = [
	'preparing',
	'ready_for_review',
	'published',
	'paused',
];

const APPROVAL: KirsCollaborationState['approval_status'][] = [
	'not_requested',
	'requested',
	'approved',
	'changes_requested',
];

export function KirsCollaborationOpsCard(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [projectId, setProjectId] = React.useState('');
	const [state, setState] = React.useState<KirsCollaborationState | null>(null);
	const [notes, setNotes] = React.useState('');
	const [readiness, setReadiness] =
		React.useState<KirsCollaborationState['readiness_status']>('preparing');
	const [approval, setApproval] =
		React.useState<KirsCollaborationState['approval_status']>('not_requested');
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [ok, setOk] = React.useState<string | null>(null);

	const applyState = React.useCallback((next: KirsCollaborationState) => {
		setState(next);
		setNotes(next.operator_notes ?? '');
		setReadiness(next.readiness_status);
		setApproval(next.approval_status);
	}, []);

	const load = React.useCallback(async () => {
		const id = projectId.trim();
		if (!id) return;
		setBusy(true);
		setError(null);
		setOk(null);
		try {
			applyState(await getKirsCollaborationState(id));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setState(null);
		} finally {
			setBusy(false);
		}
	}, [applyState, projectId]);

	const save = React.useCallback(async () => {
		const id = projectId.trim();
		if (!id) return;
		setBusy(true);
		setError(null);
		setOk(null);
		try {
			applyState(
				await updateKirsCollaborationState(id, {
					readiness_status: readiness,
					approval_status: approval,
					operator_notes: notes,
				})
			);
			setOk(t('siteManager.collaborationSaved', 'Collaboration state saved'));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [approval, applyState, notes, projectId, readiness, t]);

	return (
		<section
			className="space-y-3 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4"
			data-testid="site-manager-kirs-collaboration"
		>
			<div>
				<h2 className="text-sm font-semibold text-(--desktop-text-primary)">
					{t('siteManager.collaborationTitle', 'KIRS collaboration')}
				</h2>
				<p className="mt-1 text-xs text-(--desktop-text-muted)">
					{t(
						'siteManager.collaborationHint',
						'PATCH readiness / approval / operator notes for a marketing project id.'
					)}
				</p>
			</div>

			<div className="block space-y-1">
				<span className="text-xs text-(--desktop-text-muted)">
					{t('siteManager.collaborationProjectId', 'Project id')}
				</span>
				<AdminField
					aria-label={t('siteManager.collaborationProjectId', 'Project id')}
					value={projectId}
					onChange={(e) => setProjectId(e.target.value)}
					placeholder="UUID"
				/>
			</div>

			<div className="flex flex-wrap gap-2">
				<AdminButton
					variant="secondary"
					disabled={busy || !projectId.trim()}
					onClick={() => void load()}
				>
					{busy
						? t('siteManager.busy', 'Working…')
						: t('siteManager.collaborationLoad', 'Load')}
				</AdminButton>
				<AdminButton
					variant="primary"
					disabled={busy || !state}
					onClick={() => void save()}
				>
					{t('siteManager.collaborationSave', 'Save PATCH')}
				</AdminButton>
			</div>

			{state ? (
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="block space-y-1">
						<span className="text-xs text-(--desktop-text-muted)">
							{t('siteManager.collaborationReadiness', 'Readiness')}
						</span>
						<AdminSelect
							aria-label={t('siteManager.collaborationReadiness', 'Readiness')}
							value={readiness}
							onChange={(e) =>
								setReadiness(
									e.target.value as KirsCollaborationState['readiness_status']
								)
							}
						>
							{READINESS.map((value) => (
								<option key={value} value={value}>
									{value}
								</option>
							))}
						</AdminSelect>
					</div>
					<div className="block space-y-1">
						<span className="text-xs text-(--desktop-text-muted)">
							{t('siteManager.collaborationApproval', 'Approval')}
						</span>
						<AdminSelect
							aria-label={t('siteManager.collaborationApproval', 'Approval')}
							value={approval}
							onChange={(e) =>
								setApproval(
									e.target.value as KirsCollaborationState['approval_status']
								)
							}
						>
							{APPROVAL.map((value) => (
								<option key={value} value={value}>
									{value}
								</option>
							))}
						</AdminSelect>
					</div>
					<div className="block space-y-1 sm:col-span-2">
						<span className="text-xs text-(--desktop-text-muted)">
							{t('siteManager.collaborationNotes', 'Operator notes')}
						</span>
						<AdminField
							aria-label={t('siteManager.collaborationNotes', 'Operator notes')}
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</div>
					<p className="sm:col-span-2 font-mono text-xs text-(--desktop-text-dim)">
						instance={state.instance_id ?? '—'} · marketing=
						{state.marketing_project_id ?? '—'}
					</p>
				</div>
			) : null}

			{error ? (
				<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
			) : null}
			{ok ? <AdminStatusBanner tone="success">{ok}</AdminStatusBanner> : null}
		</section>
	);
}
