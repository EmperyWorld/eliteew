/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin workspace for vertical pack versions: guided operator workflow, manifest editor with export/diff/preview-import/confirm, and release lifecycle controls.
 *
 * Invariants:
 * - Candidate manifests must parse to JSON objects before API calls.
 * - Confirmed import and release publish/rollback are operator-level backend actions.
 * - Primary UI explains operator workflow in natural language; technical ids stay available but are not the main affordance.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
 * - shared/api/routers/professional_worlds_admin.py
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { type ChangeEvent, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	AdminButton,
	AdminJsonPreview,
	AdminStatusBanner,
	adminUiFieldClass,
} from '@/pages/Admin/ui';
import { cn } from '@/utils/cn';

import {
	approveProfessionalWorldsPackRelease,
	confirmProfessionalWorldsPackImportJob,
	createProfessionalWorldsPackImportJob,
	createProfessionalWorldsPackRelease,
	createProfessionalWorldsPackVersion,
	diffProfessionalWorldsPackVsLive,
	exportProfessionalWorldsPack,
	listProfessionalWorldsPackVersions,
	publishProfessionalWorldsPackRelease,
	rollbackProfessionalWorldsPackRelease,
} from '../api';
import { parseJsonObjectField } from '../adminJsonValidation';
import type {
	ProfessionalPackDiffResponse,
	ProfessionalVerticalPackExportOut,
	ProfessionalVerticalPackVersion,
} from '../types';

const MAX_MANIFEST_FILE_BYTES = 2 * 1024 * 1024;

type AdminDiffTone = 'good' | 'info' | 'warn' | 'risk';

const ADMIN_DIFF_TONE_CLASS: Record<AdminDiffTone, string> = {
	good: 'border-[var(--admin-ui-status-success)]/35 bg-[var(--admin-ui-status-success-bg)] text-[var(--admin-ui-status-success)]',
	info: 'border-[var(--admin-ui-status-info)]/35 bg-[var(--admin-ui-status-info-bg)] text-[var(--admin-ui-status-info)]',
	warn: 'border-[var(--admin-ui-status-warning)]/35 bg-[var(--admin-ui-status-warning-bg)] text-[var(--admin-ui-status-warning)]',
	risk: 'border-[var(--admin-ui-status-danger)]/35 bg-[var(--admin-ui-status-danger-bg)] text-[var(--admin-ui-status-danger)]',
};

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

function buildManifestExport(
	verticalSlug: string,
	manifest: ProfessionalVerticalPackExportOut | Record<string, unknown>,
	version: ProfessionalVerticalPackVersion | undefined
) {
	const exportedAt = new Date().toISOString();
	return {
		...manifest,
		export_metadata: {
			source: 'live',
			vertical_slug: verticalSlug,
			exported_at: exportedAt,
			pack_version_id: version?.id ?? null,
			version_label: version?.version_label ?? null,
			version_created_at: version?.created_at ?? null,
		},
	};
}

function downloadJson(filename: string, payload: unknown) {
	const blob = new Blob([JSON.stringify(payload, null, 2)], {
		type: 'application/json',
	});
	const href = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = href;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(href);
}

export function diffGroups(diff: ProfessionalPackDiffResponse) {
	const added: string[] = [];
	const changed: string[] = [];
	const disabled: string[] = [];
	for (const [section, stats] of Object.entries(diff.sections ?? {})) {
		const delta = stats.incoming_count - stats.live_count;
		if (delta > 0) {
			added.push(`${section}: +${delta}`);
		} else if (delta < 0) {
			disabled.push(`${section}: ${delta}`);
		} else if (stats.incoming_count > 0) {
			changed.push(`${section}: ${stats.incoming_count} candidate row(s)`);
		}
	}
	return {
		added,
		changed,
		disabled,
		risky: diff.risks ?? [],
	};
}

function DiffGroupCard({
	title,
	items,
	tone,
}: {
	title: string;
	items: string[];
	tone: 'good' | 'info' | 'warn' | 'risk';
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const toneClass = ADMIN_DIFF_TONE_CLASS[tone];
	const density = Math.min(100, items.length * 25);
	return (
		<div
			className={`rounded-xl border p-3 text-sm transition-colors duration-200 motion-reduce:transition-none ${toneClass}`}
		>
			<strong>{title}</strong>
			<div
				aria-label={`${title} diff density`}
				aria-valuemax={100}
				aria-valuemin={0}
				aria-valuenow={density}
				className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20"
				role="progressbar"
			>
				<div
					className="h-full rounded-full bg-current opacity-70 transition-[width] duration-500 motion-reduce:transition-none"
					style={{ width: `${density}%` }}
				/>
			</div>
			{items.length === 0 ? (
				<p className="mt-2 opacity-70">{t('admin.packs.diffGroupNone')}</p>
			) : (
				<ul className="mt-2 grid gap-1">
					{items.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			)}
		</div>
	);
}

export function PacksTab({
	verticalSlug,
	onChanged,
}: {
	verticalSlug: string;
	onChanged: () => void | Promise<void>;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [versions, setVersions] = useState<ProfessionalVerticalPackVersion[]>(
		[]
	);
	const [manifestText, setManifestText] = useState('{}');
	const [versionLabel, setVersionLabel] = useState('');
	const [changelog, setChangelog] = useState('');
	const [releaseId, setReleaseId] = useState('');
	const [packVersionId, setPackVersionId] = useState('');
	const [releaseNotes, setReleaseNotes] = useState('');
	const [approveComment, setApproveComment] = useState('');
	const [diff, setDiff] = useState<ProfessionalPackDiffResponse | null>(null);
	const [importJob, setImportJob] = useState<Record<string, unknown> | null>(
		null
	);
	const [approvalDialog, setApprovalDialog] = useState<{
		releaseId: string;
		risks: string[];
	} | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void listProfessionalWorldsPackVersions(verticalSlug).then((rows) => {
			if (!cancelled) {
				setVersions(rows);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [verticalSlug]);

	async function runAction(action: () => Promise<unknown>, done: string) {
		setBusy(true);
		setError(null);
		setMessage(null);
		try {
			await action();
			setMessage(done);
			setVersions(await listProfessionalWorldsPackVersions(verticalSlug));
			await onChanged();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.errors.operationFailed')
			);
		} finally {
			setBusy(false);
		}
	}

	async function handleExport() {
		await runAction(async () => {
			const manifest = await exportProfessionalWorldsPack(verticalSlug);
			const selectedVersion = versions.find(
				(version) => version.id === packVersionId
			);
			const exportPayload = buildManifestExport(
				verticalSlug,
				manifest,
				selectedVersion
			);
			setManifestText(JSON.stringify(exportPayload, null, 2));
			downloadJson(
				`${verticalSlug}-pack-${new Date().toISOString().slice(0, 10)}.json`,
				exportPayload
			);
		}, t('admin.packs.messages.exported'));
	}

	async function handleManifestUpload(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) {
			return;
		}

		setError(null);
		setMessage(null);
		const hasJsonName = file.name.toLowerCase().endsWith('.json');
		const hasJsonType =
			!file.type ||
			file.type === 'application/json' ||
			file.type === 'text/json' ||
			file.type === 'text/plain';
		if (!hasJsonName && !hasJsonType) {
			setError(t('admin.packs.uploadInvalidType'));
			return;
		}
		if (file.size > MAX_MANIFEST_FILE_BYTES) {
			setError(t('admin.packs.uploadTooLarge', { size: '2 MB' }));
			return;
		}

		try {
			const text = await file.text();
			const parsed = parseJsonObjectField(text, t('admin.packs.manifestLabel'));
			setManifestText(JSON.stringify(parsed, null, 2));
			setDiff(null);
			setImportJob(null);
			setMessage(t('admin.packs.uploadLoaded', { name: file.name }));
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.packs.uploadFailed')
			);
		}
	}

	async function handleDiff() {
		await runAction(async () => {
			setDiff(
				await diffProfessionalWorldsPackVsLive(
					verticalSlug,
					parseJsonObjectField(manifestText, t('admin.packs.manifestLabel'))
				)
			);
		}, t('admin.packs.messages.diffCalculated'));
	}

	async function handleDryRunImport() {
		await runAction(async () => {
			setImportJob(
				await createProfessionalWorldsPackImportJob(
					verticalSlug,
					parseJsonObjectField(manifestText, t('admin.packs.manifestLabel'))
				)
			);
		}, t('admin.packs.messages.importDryRunCreated'));
	}

	async function handleConfirmImport() {
		const job = importJob?.job;
		const jobId =
			job && typeof job === 'object' && 'id' in job
				? String((job as Record<string, unknown>).id)
				: null;
		if (!jobId) {
			setError(t('admin.errors.missingImportJobId'));
			return;
		}
		await runAction(
			() => confirmProfessionalWorldsPackImportJob(jobId),
			t('admin.packs.messages.importConfirmed')
		);
	}

	function openApproveReleaseDialog() {
		if (!releaseId) {
			return;
		}
		setApprovalDialog({
			releaseId,
			risks: diff?.risks ?? [],
		});
	}

	function confirmReleaseApproval() {
		if (!approvalDialog) {
			return;
		}
		const approvedReleaseId = approvalDialog.releaseId;
		setApprovalDialog(null);
		void runAction(
			() =>
				approveProfessionalWorldsPackRelease(approvedReleaseId, {
					comment: approveComment || null,
				}),
			t('admin.packs.messages.releaseApproved')
		);
	}

	return (
		<div className="grid gap-4">
			<Panel title={t('admin.packs.workflowTitle')}>
				<p className="text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
					{t('admin.packs.workflowIntro')}
				</p>
				<ol className="mt-3 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-[var(--admin-ui-fg-muted)]">
					<li>{t('admin.packs.workflowStep1')}</li>
					<li>{t('admin.packs.workflowStep2')}</li>
					<li>{t('admin.packs.workflowStep3')}</li>
					<li>{t('admin.packs.workflowStep4')}</li>
					<li>{t('admin.packs.workflowStep5')}</li>
					<li>{t('admin.packs.workflowStep6')}</li>
					<li>{t('admin.packs.workflowStep7')}</li>
				</ol>
			</Panel>
			<div className="grid gap-4 xl:grid-cols-[1fr_420px]">
				<div className="grid gap-4">
					<Panel title={t('admin.packs.versionsTitle')}>
						<p className="mb-3 text-xs leading-relaxed text-[var(--admin-ui-fg-dim)]">
							{t('admin.packs.versionsHint')}
						</p>
						<div className="grid gap-3">
							{versions.map((version) => (
								<button
									key={version.id}
									type="button"
									onClick={() => {
										setPackVersionId(version.id);
									}}
									className={cn(
										'rounded-[var(--admin-ui-radius)] border p-3 text-left transition-colors',
										packVersionId === version.id
											? 'border-[var(--admin-ui-accent)]/50 bg-[var(--admin-ui-accent-soft)] ring-2 ring-[var(--admin-ui-accent)]'
											: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] hover:bg-[var(--admin-ui-accent-soft)]'
									)}
								>
									<strong className="text-[var(--admin-ui-fg)]">
										{version.version_label}
									</strong>
									<p className="text-xs text-[var(--admin-ui-fg-muted)]">
										{t('admin.packs.versionIdMeta', { id: version.id })}
									</p>
									{version.changelog_md && (
										<p className="mt-2 text-sm text-[var(--admin-ui-fg-muted)]">
											{version.changelog_md}
										</p>
									)}
								</button>
							))}
						</div>
					</Panel>
					<Panel title={t('admin.packs.editorTitle')}>
						<div className="grid gap-3">
							<label className="grid gap-1 rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] px-3 py-2 text-sm text-[var(--admin-ui-fg-muted)]">
								{t('admin.packs.uploadLabel')}
								<input
									type="file"
									accept=".json,application/json"
									onChange={(event) => void handleManifestUpload(event)}
									className="text-xs text-[var(--admin-ui-fg-muted)] file:mr-3 file:rounded-[var(--admin-ui-radius-sm)] file:border-0 file:bg-[var(--admin-ui-surface)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--admin-ui-fg)]"
								/>
								<span className="text-xs text-[var(--admin-ui-fg-dim)]">
									{t('admin.packs.uploadHint')}
								</span>
							</label>
							<textarea
								data-testid="pw-admin-pack-manifest-textarea"
								value={manifestText}
								onChange={(event) => setManifestText(event.target.value)}
								aria-label={t('admin.packs.manifestTextareaAria')}
								className={cn(adminUiFieldClass, 'min-h-96 font-mono text-xs')}
							/>
							<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-dim)]">
								{t('admin.packs.manifestRecoveryHint')}
							</p>
							<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3">
								<p className="text-sm font-medium text-[var(--admin-ui-fg)]">
									{t('admin.packs.editorActionsTitle')}
								</p>
								<div className="mt-4 grid gap-4">
									<div className="grid gap-2">
										<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-muted)]">
											{t('admin.packs.helpExport')}
										</p>
										<AdminButton
											data-testid="pw-admin-pack-export"
											variant="secondary"
											className="w-fit"
											onClick={() => void handleExport()}
											disabled={busy}
										>
											{t('admin.packs.exportLive')}
										</AdminButton>
									</div>
									<div className="grid gap-2">
										<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-muted)]">
											{t('admin.packs.helpDiff')}
										</p>
										<AdminButton
											data-testid="pw-admin-pack-diff"
											variant="primary"
											className="w-fit"
											onClick={() => void handleDiff()}
											disabled={busy}
										>
											{t('admin.packs.diffVsLive')}
										</AdminButton>
									</div>
									<div className="grid gap-2">
										<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-muted)]">
											{t('admin.packs.helpDryRun')}
										</p>
										<AdminButton
											data-testid="pw-admin-pack-dry-run"
											variant="secondary"
											className="w-fit"
											onClick={() => void handleDryRunImport()}
											disabled={busy}
										>
											{t('admin.packs.importDryRun')}
										</AdminButton>
									</div>
									<div className="grid gap-2">
										<p className="text-xs leading-relaxed text-[var(--admin-ui-fg-muted)]">
											{t('admin.packs.helpConfirmImport')}
										</p>
										<AdminButton
											data-testid="pw-admin-pack-confirm-import"
											variant="danger"
											className="w-fit"
											onClick={() => void handleConfirmImport()}
											disabled={busy || !importJob}
										>
											{t('admin.packs.confirmImport')}
										</AdminButton>
									</div>
								</div>
							</div>
						</div>
					</Panel>
				</div>
				<div className="grid gap-4">
					<Panel title={t('admin.packs.saveVersionCard')}>
						<div className="grid gap-3">
							<input
								value={versionLabel}
								onChange={(event) => setVersionLabel(event.target.value)}
								placeholder={t('admin.packs.placeholderVersionLabel')}
								className={adminUiFieldClass}
							/>
							<textarea
								value={changelog}
								onChange={(event) => setChangelog(event.target.value)}
								placeholder={t('admin.packs.placeholderChangelog')}
								className={cn(adminUiFieldClass, 'min-h-24')}
							/>
							<AdminButton
								variant="primary"
								onClick={() =>
									void runAction(
										() =>
											createProfessionalWorldsPackVersion(verticalSlug, {
												version_label: versionLabel,
												manifest: parseJsonObjectField(
													manifestText,
													t('admin.packs.manifestLabel')
												),
												changelog_md: changelog || null,
											}),
										t('admin.packs.messages.versionSaved')
									)
								}
								disabled={busy || !versionLabel}
							>
								{t('admin.packs.saveVersion')}
							</AdminButton>
						</div>
					</Panel>
					<Panel title={t('admin.packs.releaseCardTitle')}>
						<div className="grid gap-3">
							<input
								value={packVersionId}
								onChange={(event) => setPackVersionId(event.target.value)}
								placeholder={t('admin.packs.placeholderPackVersionId')}
								className={adminUiFieldClass}
							/>
							<textarea
								value={releaseNotes}
								onChange={(event) => setReleaseNotes(event.target.value)}
								placeholder={t('admin.packs.placeholderReleaseNotes')}
								className={cn(adminUiFieldClass, 'min-h-20')}
							/>
							<AdminButton
								variant="primary"
								onClick={() =>
									void runAction(
										() =>
											createProfessionalWorldsPackRelease(verticalSlug, {
												pack_version_id: packVersionId || null,
												notes: releaseNotes || null,
											}).then((row) => {
												const id = row.id;
												if (typeof id === 'string') {
													setReleaseId(id);
												}
												return row;
											}),
										t('admin.packs.messages.draftReleaseCreated')
									)
								}
								disabled={busy}
							>
								{t('admin.packs.createDraftRelease')}
							</AdminButton>
							<input
								value={releaseId}
								onChange={(event) => setReleaseId(event.target.value)}
								placeholder={t('admin.packs.placeholderReleaseId')}
								className={adminUiFieldClass}
							/>
							<textarea
								value={approveComment}
								onChange={(event) => setApproveComment(event.target.value)}
								placeholder={t('admin.packs.placeholderApproveComment')}
								className={cn(adminUiFieldClass, 'min-h-20')}
							/>
							<div className="grid gap-2">
								<AdminButton
									data-testid="pw-admin-pack-approve-open"
									variant="primary"
									onClick={openApproveReleaseDialog}
									disabled={busy || !releaseId}
								>
									{t('admin.packs.approve')}
								</AdminButton>
								<AdminButton
									variant="primary"
									onClick={() =>
										void runAction(
											() => publishProfessionalWorldsPackRelease(releaseId),
											t('admin.packs.messages.releasePublished')
										)
									}
									disabled={busy || !releaseId}
								>
									{t('admin.packs.publish')}
								</AdminButton>
								<AdminButton
									variant="danger"
									onClick={() =>
										void runAction(
											() => rollbackProfessionalWorldsPackRelease(releaseId),
											t('admin.packs.messages.releaseRolledBack')
										)
									}
									disabled={busy || !releaseId}
								>
									{t('admin.packs.rollback')}
								</AdminButton>
							</div>
						</div>
					</Panel>
					{message ? (
						<AdminStatusBanner tone="success">{message}</AdminStatusBanner>
					) : null}
					{error ? (
						<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
					) : null}
					{diff && (
						<Panel title={t('admin.packs.diffGroupingTitle')}>
							<div className="grid gap-3">
								{(() => {
									const groups = diffGroups(diff);
									return (
										<div className="grid gap-3 sm:grid-cols-2">
											<DiffGroupCard
												title={t('admin.schemas.diffAdded')}
												items={groups.added}
												tone="good"
											/>
											<DiffGroupCard
												title={t('admin.schemas.diffChanged')}
												items={groups.changed}
												tone="info"
											/>
											<DiffGroupCard
												title={t('admin.packs.diffGroupDisabledRemoved')}
												items={groups.disabled}
												tone="warn"
											/>
											<DiffGroupCard
												title={t('admin.packs.diffGroupRisky')}
												items={groups.risky}
												tone="risk"
											/>
										</div>
									);
								})()}
								<AdminJsonPreview
									title={t('admin.packs.diffCardTitle')}
									helper={t('admin.packs.diffJsonHelper')}
									value={diff}
								/>
							</div>
						</Panel>
					)}
					{importJob && (
						<Panel title={t('admin.packs.importPreviewTitle')}>
							<AdminJsonPreview
								title={t('admin.packs.importPreviewTitle')}
								helper={t('admin.packs.importJobJsonHelper')}
								value={importJob}
							/>
						</Panel>
					)}
				</div>
				{approvalDialog && (
					<div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
						<div
							role="dialog"
							aria-modal="true"
							aria-label={t('admin.packs.approveHeading', {
								releaseId: approvalDialog.releaseId,
							})}
							onKeyDown={(event) => {
								if (event.key === 'Escape') {
									setApprovalDialog(null);
								}
							}}
							tabIndex={-1}
							className="grid w-full max-w-xl gap-4 rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl"
						>
							<div>
								<h3 className="text-lg font-semibold text-white">
									{t('admin.packs.approveHeading', {
										releaseId: approvalDialog.releaseId,
									})}
								</h3>
								<p className="mt-2 text-sm text-slate-400">
									{t('admin.packs.approveLead')}
								</p>
							</div>
							<div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
								<p className="font-medium">
									{t('admin.packs.groupRiskSummary')}
								</p>
								{approvalDialog.risks.length > 0 ? (
									<ul className="mt-2 grid gap-1">
										{approvalDialog.risks.map((risk) => (
											<li key={risk}>{risk}</li>
										))}
									</ul>
								) : (
									<p className="mt-2">{t('admin.packs.noDiffRisksLoaded')}</p>
								)}
							</div>
							<div className="flex flex-wrap justify-end gap-2">
								<AdminButton
									variant="secondary"
									onClick={() => setApprovalDialog(null)}
								>
									{t('admin.packs.messages.cancel')}
								</AdminButton>
								<AdminButton
									data-testid="pw-admin-pack-approve-confirm"
									variant="primary"
									onClick={confirmReleaseApproval}
									disabled={busy}
								>
									{t('admin.packs.approvePrimaryButton')}
								</AdminButton>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
