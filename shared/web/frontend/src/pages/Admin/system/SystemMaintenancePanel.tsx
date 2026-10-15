/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * System section panel — schedule / phase / clear planned maintenance, plus deploy defaults.
 *
 * Invariants:
 * - New World atoms only; admin write via systemMaintenanceAdminApi.
 * - Clear requires DangerConfirmModal phrase MAINT.
 * - Deploy defaults (notice/downtime/templates) persist in Postgres for stack0 release.
 *
 * Related:
 * - documentation/platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	AdminButton,
	AdminField,
	AdminSelect,
	AdminStatusBanner,
	DangerConfirmModal,
} from '../ui';
import {
	clearAdminMaintenance,
	getAdminMaintenanceDeployDefaults,
	getAdminMaintenanceStatus,
	putAdminMaintenanceDeployDefaults,
	scheduleAdminMaintenance,
	setAdminMaintenancePhase,
	type MaintenanceKind,
	type MaintenancePhase,
	type MaintenanceStatus,
} from './systemMaintenanceAdminApi';

const PHASES: MaintenancePhase[] = [
	'scheduled',
	'warning',
	'draining',
	'active',
	'recovering',
	'completed',
	'cancelled',
];

const KINDS: MaintenanceKind[] = [
	'stack0_restart',
	'frontend_deploy',
	'api_restart',
	'workers_restart',
	'full_maintenance',
	'emergency',
];

const TEMPLATE_HINT =
	'{notice_minutes} {downtime_minutes} {starts_at_local} {ends_at_local}';

export function SystemMaintenancePanel(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [status, setStatus] = React.useState<MaintenanceStatus | null>(null);
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [clearOpen, setClearOpen] = React.useState(false);
	const [title, setTitle] = React.useState('EliteEW обновляет среду');
	const [message, setMessage] = React.useState(
		'Безраздельный мир временно на технической паузе.'
	);
	const [kind, setKind] = React.useState<MaintenanceKind>('stack0_restart');
	const [phase, setPhase] = React.useState<MaintenancePhase>('scheduled');

	const [noticeMinutes, setNoticeMinutes] = React.useState('10');
	const [downtimeMinutes, setDowntimeMinutes] = React.useState('2');
	const [defaultsTitle, setDefaultsTitle] = React.useState(
		'EliteEW обновляет среду'
	);
	const [messageTemplate, setMessageTemplate] = React.useState('');
	const [impactTemplate, setImpactTemplate] = React.useState('');
	const [previewMessage, setPreviewMessage] = React.useState('');
	const [previewImpact, setPreviewImpact] = React.useState('');
	const [previewLocal, setPreviewLocal] = React.useState('');

	const refreshDefaults = React.useCallback(async () => {
		const snap = await getAdminMaintenanceDeployDefaults();
		setNoticeMinutes(
			String(Math.max(0, Math.round(snap.defaults.notice_before_seconds / 60)))
		);
		setDowntimeMinutes(
			String(
				Math.max(1, Math.round(snap.defaults.expected_downtime_seconds / 60))
			)
		);
		setDefaultsTitle(snap.defaults.title);
		setMessageTemplate(snap.defaults.message_template);
		setImpactTemplate(snap.defaults.user_impact_template);
		setPreviewMessage(snap.preview.message);
		setPreviewImpact(snap.preview.user_impact);
		setPreviewLocal(
			`${snap.preview.starts_at_local}–${snap.preview.ends_at_local}`
		);
	}, []);

	const refresh = React.useCallback(async () => {
		setError(null);
		try {
			const snap = await getAdminMaintenanceStatus();
			setStatus(snap);
			if (snap.window) {
				setTitle(snap.window.title);
				setMessage(snap.window.message);
				setKind(snap.window.kind);
				setPhase(snap.window.phase);
			}
			await refreshDefaults();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [refreshDefaults]);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const run = async (fn: () => Promise<void>) => {
		setBusy(true);
		setError(null);
		try {
			await fn();
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	};

	const active = Boolean(status?.active && status.window);

	return (
		<section className="space-y-3 rounded-(--admin-ui-radius) border border-(--admin-ui-border) bg-(--admin-ui-surface) p-4">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<h3 className="text-(length:--admin-ui-text-md) font-medium text-(--admin-ui-fg)">
						{t('adminSystem.maintenanceTitle', 'Planned maintenance')}
					</h3>
					<p className="mt-1 text-sm text-(--admin-ui-fg-muted)">
						{t(
							'adminSystem.maintenanceHint',
							'Schedule, phase, or clear the user-visible maintenance window.'
						)}
					</p>
				</div>
				<AdminButton
					variant="ghost"
					disabled={busy}
					onClick={() => void refresh()}
				>
					{t('adminSystem.maintenanceRefresh', 'Refresh')}
				</AdminButton>
			</div>

			{error ? <AdminStatusBanner tone="danger" title={error} /> : null}
			<AdminStatusBanner
				tone={active ? 'warning' : 'info'}
				title={
					active
						? t('adminSystem.maintenanceActive', 'Window active · {{phase}}', {
								phase: status?.window?.phase ?? '—',
							})
						: t('adminSystem.maintenanceIdle', 'No active maintenance window')
				}
			>
				{status?.window?.title}
			</AdminStatusBanner>

			<div className="grid gap-3 sm:grid-cols-2">
				<div className="flex flex-col gap-1 text-sm text-(--admin-ui-fg-muted)">
					<span id="maint-kind-label">
						{t('adminSystem.maintenanceKind', 'Kind')}
					</span>
					<AdminSelect
						aria-labelledby="maint-kind-label"
						value={kind}
						disabled={busy}
						onChange={(e) => setKind(e.target.value as MaintenanceKind)}
					>
						{KINDS.map((k) => (
							<option key={k} value={k}>
								{k}
							</option>
						))}
					</AdminSelect>
				</div>
				<div className="flex flex-col gap-1 text-sm text-(--admin-ui-fg-muted)">
					<span id="maint-phase-label">
						{t('adminSystem.maintenancePhase', 'Phase')}
					</span>
					<AdminSelect
						aria-labelledby="maint-phase-label"
						value={phase}
						disabled={busy}
						onChange={(e) => setPhase(e.target.value as MaintenancePhase)}
					>
						{PHASES.map((p) => (
							<option key={p} value={p}>
								{p}
							</option>
						))}
					</AdminSelect>
				</div>
				<div className="flex flex-col gap-1 text-sm text-(--admin-ui-fg-muted) sm:col-span-2">
					<span id="maint-title-label">
						{t('adminSystem.maintenanceTitleField', 'Title')}
					</span>
					<AdminField
						aria-labelledby="maint-title-label"
						value={title}
						disabled={busy}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>
				<div className="flex flex-col gap-1 text-sm text-(--admin-ui-fg-muted) sm:col-span-2">
					<span id="maint-msg-label">
						{t('adminSystem.maintenanceMessage', 'Message')}
					</span>
					<AdminField
						aria-labelledby="maint-msg-label"
						value={message}
						disabled={busy}
						onChange={(e) => setMessage(e.target.value)}
					/>
				</div>
			</div>

			<div className="flex flex-wrap gap-2">
				<AdminButton
					variant="primary"
					disabled={busy}
					onClick={() =>
						void run(async () => {
							await scheduleAdminMaintenance({
								kind,
								phase,
								title: title.trim() || undefined,
								message: message.trim() || undefined,
							});
						})
					}
				>
					{t('adminSystem.maintenanceSchedule', 'Schedule / update')}
				</AdminButton>
				<AdminButton
					variant="secondary"
					disabled={busy || !status?.window}
					onClick={() =>
						void run(async () => {
							await setAdminMaintenancePhase(phase);
						})
					}
				>
					{t('adminSystem.maintenanceSetPhase', 'Set phase')}
				</AdminButton>
				<AdminButton
					variant="danger"
					disabled={busy || !status?.window}
					onClick={() => setClearOpen(true)}
				>
					{t('adminSystem.maintenanceClear', 'Clear window')}
				</AdminButton>
			</div>

			<div className="mt-4 space-y-3 border-t border-(--admin-ui-border) pt-4">
				<div>
					<h4 className="text-(length:--admin-ui-text-md) font-medium text-(--admin-ui-fg)">
						{t(
							'adminSystem.maintenanceDeployDefaultsTitle',
							'Release defaults (stack0)'
						)}
					</h4>
					<p className="mt-1 text-sm text-(--admin-ui-fg-muted)">
						{t(
							'adminSystem.maintenanceDeployDefaultsHint',
							'Used automatically on release --all. Placeholders: {{tokens}}',
							{ tokens: TEMPLATE_HINT }
						)}
					</p>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="flex flex-col gap-1 text-sm text-(--admin-ui-fg-muted)">
						<span id="maint-notice-min-label">
							{t(
								'adminSystem.maintenanceNoticeMinutes',
								'Notice before restart (minutes)'
							)}
						</span>
						<AdminField
							aria-labelledby="maint-notice-min-label"
							type="number"
							min={0}
							max={1440}
							value={noticeMinutes}
							disabled={busy}
							onChange={(e) => setNoticeMinutes(e.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1 text-sm text-(--admin-ui-fg-muted)">
						<span id="maint-down-min-label">
							{t(
								'adminSystem.maintenanceDowntimeMinutes',
								'Expected downtime (minutes)'
							)}
						</span>
						<AdminField
							aria-labelledby="maint-down-min-label"
							type="number"
							min={1}
							max={1440}
							value={downtimeMinutes}
							disabled={busy}
							onChange={(e) => setDowntimeMinutes(e.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1 text-sm text-(--admin-ui-fg-muted) sm:col-span-2">
						<span id="maint-def-title-label">
							{t('adminSystem.maintenanceDefaultsTitleField', 'Default title')}
						</span>
						<AdminField
							aria-labelledby="maint-def-title-label"
							value={defaultsTitle}
							disabled={busy}
							onChange={(e) => setDefaultsTitle(e.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1 text-sm text-(--admin-ui-fg-muted) sm:col-span-2">
						<span id="maint-msg-tpl-label">
							{t('adminSystem.maintenanceMessageTemplate', 'Message template')}
						</span>
						<AdminField
							aria-labelledby="maint-msg-tpl-label"
							value={messageTemplate}
							disabled={busy}
							onChange={(e) => setMessageTemplate(e.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1 text-sm text-(--admin-ui-fg-muted) sm:col-span-2">
						<span id="maint-impact-tpl-label">
							{t(
								'adminSystem.maintenanceImpactTemplate',
								'User impact template'
							)}
						</span>
						<AdminField
							aria-labelledby="maint-impact-tpl-label"
							value={impactTemplate}
							disabled={busy}
							onChange={(e) => setImpactTemplate(e.target.value)}
						/>
					</div>
				</div>
				{previewMessage ? (
					<AdminStatusBanner
						tone="info"
						title={t(
							'adminSystem.maintenanceDefaultsPreview',
							'Preview · {{range}}',
							{ range: previewLocal || '—' }
						)}
					>
						<div className="space-y-1 text-sm">
							<p>{previewMessage}</p>
							<p className="text-(--admin-ui-fg-muted)">{previewImpact}</p>
						</div>
					</AdminStatusBanner>
				) : null}
				<AdminButton
					variant="primary"
					disabled={busy}
					onClick={() =>
						void run(async () => {
							const noticeSec = Math.max(
								0,
								Math.round(Number(noticeMinutes) * 60) || 0
							);
							const downSec = Math.max(
								30,
								Math.round(Number(downtimeMinutes) * 60) || 120
							);
							await putAdminMaintenanceDeployDefaults({
								notice_before_seconds: noticeSec,
								expected_downtime_seconds: downSec,
								title: defaultsTitle.trim() || undefined,
								message_template: messageTemplate.trim() || undefined,
								user_impact_template: impactTemplate.trim() || undefined,
							});
						})
					}
				>
					{t('adminSystem.maintenanceSaveDefaults', 'Save release defaults')}
				</AdminButton>
			</div>

			<DangerConfirmModal
				open={clearOpen}
				title={t(
					'adminSystem.maintenanceClearTitle',
					'Clear maintenance window'
				)}
				description={t(
					'adminSystem.maintenanceClearBody',
					'Cancels and clears the current planned maintenance window for all clients.'
				)}
				confirmPhrase="MAINT"
				busy={busy}
				onCancel={() => setClearOpen(false)}
				onConfirm={() =>
					void run(async () => {
						setClearOpen(false);
						await clearAdminMaintenance();
					})
				}
			/>
		</section>
	);
}
