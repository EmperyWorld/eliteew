/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin controls for staged Professional Worlds rollouts: guided operator workflow, create form with field-level hints, and list controls (pause / resume / retarget).
 *
 * Invariants:
 * - Rollout mutations require an explicit release id from an approved/published pack release.
 * - Percentage values stay within the backend contract range of 0..100.
 * - In-app preview audience is illustrative only; mode descriptions reflect server-side behaviour at a high level.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
 * - shared/api/services/professional_worlds/pack_service.py
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useTranslation } from 'react-i18next';
import { useEffect, useState, type ReactNode } from 'react';

import {
	AdminButton,
	AdminField,
	AdminSelect,
	AdminStatusBanner,
} from '@/pages/Admin/ui';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { cn } from '@/utils/cn';

import {
	createProfessionalWorldsRollout,
	listProfessionalWorldsRollouts,
	patchProfessionalWorldsRollout,
	pauseProfessionalWorldsRollout,
	resumeProfessionalWorldsRollout,
} from '../api';
import { adminText } from '../adminI18n';
import type { ProfessionalVerticalRollout } from '../types';

const ROLLOUT_MODES = ['all', 'percentage', 'allowlist', 'disabled'] as const;

type RolloutMode = (typeof ROLLOUT_MODES)[number];

function Panel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
			<h3 className="mb-3 text-sm font-semibold text-[var(--admin-ui-fg)]">
				{title}
			</h3>
			{children}
		</section>
	);
}

function StatusPill({ active }: { active: boolean }) {
	return (
		<span
			className={
				active
					? 'rounded-full bg-[var(--admin-ui-status-success-bg)] px-2 py-1 text-xs text-[var(--admin-ui-status-success)]'
					: 'rounded-full bg-[var(--admin-ui-surface-strong)] px-2 py-1 text-xs text-[var(--admin-ui-fg-muted)]'
			}
		>
			{active ? adminText('status.enabled') : adminText('status.disabled')}
		</span>
	);
}

function FieldBlock({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-1 text-sm text-[var(--admin-ui-fg-muted)]">
			<span className="text-[var(--admin-ui-fg)]">{label}</span>
			{children}
		</div>
	);
}

function clampPercentage(value: string) {
	const next = Number.parseInt(value, 10);
	if (Number.isNaN(next)) {
		return 0;
	}
	return Math.min(100, Math.max(0, next));
}

function clampAudience(value: string) {
	const next = Number.parseInt(value, 10);
	if (Number.isNaN(next)) {
		return 0;
	}
	return Math.max(0, next);
}

function estimateAffectedUsers(
	mode: string,
	percentage: number,
	audience: number
) {
	if (mode === 'disabled') {
		return 0;
	}
	if (mode === 'all') {
		return audience;
	}
	if (mode === 'percentage') {
		return Math.ceil((audience * percentage) / 100);
	}
	return null;
}

function rolloutProgressPercent(mode: string, percentage: number) {
	if (mode === 'all') {
		return 100;
	}
	if (mode === 'percentage') {
		return Math.min(100, Math.max(0, percentage));
	}
	return 0;
}

function RolloutProgressMeter({
	label,
	value,
}: {
	label: string;
	value: number;
}) {
	return (
		<div
			aria-label={label}
			aria-valuemax={100}
			aria-valuemin={0}
			aria-valuenow={value}
			className="h-2 overflow-hidden rounded-full bg-[var(--admin-ui-surface-strong)]"
			role="progressbar"
		>
			<div
				className="h-full rounded-full bg-[var(--admin-ui-accent)] transition-[width] duration-500 motion-reduce:transition-none"
				style={{ width: `${value}%` }}
			/>
		</div>
	);
}

export function RolloutsTab({
	verticalSlug,
	onChanged,
}: {
	verticalSlug: string;
	onChanged: () => void | Promise<void>;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [rollouts, setRollouts] = useState<ProfessionalVerticalRollout[]>([]);
	const [releaseId, setReleaseId] = useState('');
	const [mode, setMode] = useState<RolloutMode>('all');
	const [percentage, setPercentage] = useState(100);
	const [estimatedAudience, setEstimatedAudience] = useState(1000);
	const [editingId, setEditingId] = useState('');
	const [editMode, setEditMode] = useState<RolloutMode>('percentage');
	const [editPercentage, setEditPercentage] = useState(10);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function refreshRollouts() {
		setRollouts(await listProfessionalWorldsRollouts(verticalSlug));
	}

	useEffect(() => {
		let cancelled = false;
		void listProfessionalWorldsRollouts(verticalSlug).then((rows) => {
			if (!cancelled) {
				setRollouts(rows);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [verticalSlug]);

	async function runAction(action: () => Promise<unknown>, done: string) {
		setBusy(true);
		setMessage(null);
		setError(null);
		try {
			await action();
			await refreshRollouts();
			await onChanged();
			setMessage(done);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.errors.operationFailed')
			);
		} finally {
			setBusy(false);
		}
	}

	const createPreviewAudience = estimateAffectedUsers(
		mode,
		percentage,
		estimatedAudience
	);

	return (
		<div className="grid gap-4">
			<Panel title={t('admin.rollouts.workflowTitle')}>
				<p className="text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
					{t('admin.rollouts.workflowIntro')}
				</p>
				<ol className="mt-3 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
					<li>{t('admin.rollouts.workflowStep1')}</li>
					<li>{t('admin.rollouts.workflowStep2')}</li>
					<li>{t('admin.rollouts.workflowStep3')}</li>
					<li>{t('admin.rollouts.workflowStep4')}</li>
					<li>{t('admin.rollouts.workflowStep5')}</li>
				</ol>
			</Panel>
			<div className="grid gap-4 xl:grid-cols-[360px_1fr]">
				<Panel title={t('admin.rollouts.createTitle')}>
					<div className="grid gap-3">
						<p className="text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
							{t('admin.rollouts.createFormLead')}
						</p>
						<FieldBlock label={t('admin.rollouts.releaseIdAria')}>
							<AdminField
								id="pw-admin-rollout-release-id"
								data-testid="pw-admin-rollout-release-id"
								value={releaseId}
								onChange={(event) => setReleaseId(event.target.value)}
								placeholder={t('admin.rollouts.releaseIdPlaceholder')}
								aria-label={t('admin.rollouts.releaseIdAria')}
							/>
							<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-dim)]">
								{t('admin.rollouts.helpReleaseId')}
							</p>
						</FieldBlock>
						<FieldBlock label={t('admin.rollouts.modeFieldLabel')}>
							<AdminSelect
								id="pw-admin-rollout-mode"
								value={mode}
								onChange={(event) => setMode(event.target.value as RolloutMode)}
								aria-label={t('admin.rollouts.modeFieldLabel')}
							>
								{ROLLOUT_MODES.map((item) => (
									<option key={item} value={item}>
										{t(`admin.rollouts.modeLabels.${item}`)}
									</option>
								))}
							</AdminSelect>
							<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-dim)]">
								{t('admin.rollouts.helpMode')}
							</p>
							<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-muted)]">
								{t(`admin.rollouts.modeDescriptions.${mode}`)}
							</p>
						</FieldBlock>
						<FieldBlock label={t('admin.rollouts.percentageLabel')}>
							<AdminField
								type="number"
								min={0}
								max={100}
								disabled={mode !== 'percentage'}
								value={String(percentage)}
								onChange={(event) =>
									setPercentage(clampPercentage(event.target.value))
								}
								className={cn(mode !== 'percentage' && 'opacity-60')}
							/>
							<span className="text-xs font-normal leading-relaxed text-[var(--admin-ui-fg-dim)]">
								{t('admin.rollouts.helpPercentage')}
							</span>
						</FieldBlock>
						<FieldBlock label={t('admin.rollouts.estimatedAudienceLabel')}>
							<AdminField
								type="number"
								min={0}
								value={String(estimatedAudience)}
								onChange={(event) =>
									setEstimatedAudience(clampAudience(event.target.value))
								}
							/>
							<span className="text-xs font-normal leading-relaxed text-[var(--admin-ui-fg-dim)]">
								{t('admin.rollouts.helpAudience')}
							</span>
						</FieldBlock>
						<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-accent)]/30 bg-[var(--admin-ui-accent-soft)] px-3 py-2 text-sm text-[var(--admin-ui-fg)]">
							<p>
								{t('admin.rollouts.previewLabel')}{' '}
								{createPreviewAudience == null ? (
									t('admin.rollouts.allowlistOnlyAffected')
								) : (
									<>
										{createPreviewAudience} {t('admin.rollouts.affectedUsers')}
									</>
								)}
							</p>
							<p className="mt-1 text-xs text-[var(--admin-ui-fg-muted)]">
								{t('admin.rollouts.previewExplain')}
							</p>
							<div className="mt-2">
								<RolloutProgressMeter
									label={t('admin.rollouts.meterPreviewPercent')}
									value={rolloutProgressPercent(mode, percentage)}
								/>
							</div>
						</div>
						<AdminButton
							data-testid="pw-admin-rollout-create"
							variant="primary"
							onClick={() =>
								void runAction(
									() =>
										createProfessionalWorldsRollout(verticalSlug, {
											release_id: releaseId,
											mode,
											percentage,
										}),
									t('admin.rollouts.messages.created')
								)
							}
							disabled={busy || !releaseId}
						>
							{t('admin.rollouts.createButton')}
						</AdminButton>
						{message ? (
							<AdminStatusBanner tone="success">{message}</AdminStatusBanner>
						) : null}
						{error ? (
							<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
						) : null}
					</div>
				</Panel>
				<Panel title={t('admin.rollouts.activeTitle')}>
					<div className="grid gap-3">
						<p className="text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
							{t('admin.rollouts.activePanelLead')}
						</p>
						{rollouts.length === 0 && (
							<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-4">
								<p className="font-medium text-[var(--admin-ui-fg)]">
									{t('admin.rollouts.emptyStateTitle')}
								</p>
								<p className="mt-2 text-sm text-[var(--admin-ui-fg-muted)]">
									{t('admin.rollouts.emptyStateLead')}
								</p>
								<p className="mt-1 text-xs text-[var(--admin-ui-fg-dim)]">
									{t('admin.rollouts.emptyForVertical', { verticalSlug })}
								</p>
								<ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
									<li>{t('admin.rollouts.emptyStateHint1')}</li>
									<li>{t('admin.rollouts.emptyStateHint2')}</li>
									<li>{t('admin.rollouts.emptyStateHint3')}</li>
								</ol>
							</div>
						)}
						{rollouts.map((rollout) => (
							<div
								key={rollout.id}
								className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-4"
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<div className="flex items-center gap-2">
											<strong className="text-[var(--admin-ui-fg)]">
												{t(`admin.rollouts.modeLabels.${rollout.mode}`)}
											</strong>
											<StatusPill active={!rollout.is_paused} />
										</div>
										<p className="mt-1 text-xs text-[var(--admin-ui-fg-muted)]">
											{t('admin.rollouts.releaseIdMeta', {
												id: rollout.release_id,
											})}
										</p>
										<p className="text-xs text-[var(--admin-ui-fg-dim)]">
											{t('admin.rollouts.rolloutIdMeta', { id: rollout.id })}
										</p>
									</div>
									<div className="text-right text-sm text-[var(--admin-ui-fg-muted)]">
										<p>{rollout.percentage}%</p>
										<p className="text-xs text-[var(--admin-ui-accent)]">
											{t('admin.rollouts.affectedApprox', {
												value: String(
													estimateAffectedUsers(
														rollout.mode,
														rollout.percentage,
														estimatedAudience
													) ?? t('admin.rollouts.allowlistKeyword')
												),
											})}
										</p>
										<p className="text-xs text-[var(--admin-ui-fg-dim)]">
											{rollout.updated_at
												? new Date(rollout.updated_at).toLocaleString()
												: '—'}
										</p>
									</div>
								</div>
								<div className="mt-3">
									<RolloutProgressMeter
										label={t('admin.rollouts.meterRolloutPercent', {
											id: rollout.id,
										})}
										value={rolloutProgressPercent(
											rollout.mode,
											rollout.percentage
										)}
									/>
								</div>
								{editingId === rollout.id ? (
									<div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
										<AdminSelect
											value={editMode}
											onChange={(event) =>
												setEditMode(event.target.value as RolloutMode)
											}
										>
											{ROLLOUT_MODES.map((item) => (
												<option key={item} value={item}>
													{t(`admin.rollouts.modeLabels.${item}`)}
												</option>
											))}
										</AdminSelect>
										<AdminField
											type="number"
											min={0}
											max={100}
											disabled={editMode !== 'percentage'}
											value={String(editPercentage)}
											onChange={(event) =>
												setEditPercentage(clampPercentage(event.target.value))
											}
										/>
										<AdminButton
											variant="primary"
											onClick={() =>
												void runAction(
													() =>
														patchProfessionalWorldsRollout(rollout.id, {
															mode: editMode,
															percentage: editPercentage,
														}),
													t('admin.rollouts.messages.updated')
												).then(() => setEditingId(''))
											}
											disabled={busy}
										>
											{t('admin.rollouts.save')}
										</AdminButton>
									</div>
								) : (
									<div className="mt-4 flex flex-wrap gap-2">
										<AdminButton
											variant="ghost"
											onClick={() => {
												setEditingId(rollout.id);
												setEditMode(rollout.mode as RolloutMode);
												setEditPercentage(rollout.percentage);
											}}
										>
											{t('admin.rollouts.editTargeting')}
										</AdminButton>
										<AdminButton
											variant="secondary"
											onClick={() =>
												void runAction(
													() => pauseProfessionalWorldsRollout(rollout.id),
													t('admin.rollouts.messages.paused')
												)
											}
											disabled={busy || rollout.is_paused}
										>
											{t('admin.rollouts.pause')}
										</AdminButton>
										<AdminButton
											variant="primary"
											onClick={() =>
												void runAction(
													() => resumeProfessionalWorldsRollout(rollout.id),
													t('admin.rollouts.messages.resumed')
												)
											}
											disabled={busy || !rollout.is_paused}
										>
											{t('admin.rollouts.resume')}
										</AdminButton>
									</div>
								)}
							</div>
						))}
					</div>
				</Panel>
			</div>
		</div>
	);
}
