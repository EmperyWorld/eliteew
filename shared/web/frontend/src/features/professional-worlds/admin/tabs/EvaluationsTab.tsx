/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Admin tab for Professional Worlds AI evaluation datasets, runs, and human review notes.
 *
 * Invariants:
 * - Calls only `/professional-worlds/admin/evaluation/*` helpers from ../api.ts.
 * - Cases payload must parse as a JSON array before creating a dataset.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
 * - src/features/professional-worlds/admin/types.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
	AdminButton,
	AdminField,
	AdminJsonPreview,
	AdminSelect,
	AdminStatusBanner,
	AdminToggle,
	DangerConfirmModal,
	EntityLifecycleBar,
	adminUiFieldClass,
} from '@/pages/Admin/ui';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { cn } from '@/utils/cn';

import {
	createProfessionalWorldsEvaluationDataset,
	deleteProfessionalWorldsEvaluationDataset,
	executeProfessionalWorldsEvaluationRun,
	loadProfessionalWorldsEvaluationDashboard,
	patchProfessionalWorldsEvaluationDataset,
	patchProfessionalWorldsEvaluationRunHumanNotes,
	patchProfessionalWorldsEvaluationSampleHumanNotes,
} from '../api';
import type {
	ProfessionalAiEvalDashboard,
	ProfessionalAiEvalRun,
} from '../types';

type EvaluationTargetType = 'ai_action' | 'playbook';

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

function translateEvaluationValue(
	t: ReturnType<typeof useTranslation>['t'],
	scope: 'targetTypes' | 'runStatuses',
	value: string | null | undefined
): string {
	const normalized = value?.trim() || 'unknown';
	return t(`admin.evaluation.${scope}.${normalized}`, {
		defaultValue: normalized.replace(/[_-]+/g, ' '),
	});
}

export function EvaluationsTab({ verticalSlug }: { verticalSlug: string }) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [dashboard, setDashboard] =
		useState<ProfessionalAiEvalDashboard | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const [datasetName, setDatasetName] = useState('');
	const [datasetDescription, setDatasetDescription] = useState('');
	const [casesJson, setCasesJson] = useState('[{}]');

	const [selectedDatasetId, setSelectedDatasetId] = useState('');
	const [targetType, setTargetType] =
		useState<EvaluationTargetType>('ai_action');
	const [targetKey, setTargetKey] = useState('');
	const [simulate, setSimulate] = useState(true);

	const [selectedRun, setSelectedRun] = useState<ProfessionalAiEvalRun | null>(
		null
	);
	const [humanNotesDraft, setHumanNotesDraft] = useState('');
	const [savingNotes, setSavingNotes] = useState(false);
	const [sampleNotesDrafts, setSampleNotesDrafts] = useState<
		Record<string, string>
	>({});
	const [savingSampleId, setSavingSampleId] = useState<string | null>(null);
	const [datasetBusy, setDatasetBusy] = useState(false);
	const [deleteDatasetOpen, setDeleteDatasetOpen] = useState(false);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const dash = await loadProfessionalWorldsEvaluationDashboard(
				verticalSlug,
				40
			);
			setDashboard(dash);
			setSelectedRun((current) => {
				const recentRuns = dash.recent_runs ?? [];
				if (!recentRuns.length) {
					return null;
				}
				if (current && recentRuns.some((run) => run.id === current.id)) {
					return recentRuns.find((run) => run.id === current.id) ?? null;
				}
				return recentRuns[0] ?? null;
			});
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.errors.operationFailed')
			);
		} finally {
			setLoading(false);
		}
	}, [t, verticalSlug]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		setHumanNotesDraft(selectedRun?.human_review_notes ?? '');
		const next: Record<string, string> = {};
		for (const sample of selectedRun?.samples ?? []) {
			next[sample.id] = sample.human_review_notes ?? '';
		}
		setSampleNotesDrafts(next);
	}, [selectedRun]);

	async function handleCreateDataset() {
		setMessage(null);
		setError(null);
		let cases: Record<string, unknown>[];
		try {
			const parsed: unknown = JSON.parse(casesJson);
			if (!Array.isArray(parsed)) {
				throw new Error('not_array');
			}
			cases = parsed as Record<string, unknown>[];
		} catch {
			setError(t('admin.evaluation.casesInvalid'));
			return;
		}
		const name = datasetName.trim();
		if (!name) {
			setError(t('admin.evaluation.datasetNameRequired'));
			return;
		}
		try {
			const row = await createProfessionalWorldsEvaluationDataset({
				vertical_slug: verticalSlug,
				name,
				description: datasetDescription.trim() || null,
				cases,
				is_active: true,
			});
			setMessage(t('admin.evaluation.datasetCreated', { id: row.id }));
			setSelectedDatasetId(row.id);
			await refresh();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.errors.operationFailed')
			);
		}
	}

	async function handleRunEvaluation() {
		setMessage(null);
		setError(null);
		if (!selectedDatasetId) {
			setError(t('admin.evaluation.pickDataset'));
			return;
		}
		const key = targetKey.trim();
		if (!key) {
			setError(t('admin.evaluation.targetKey'));
			return;
		}
		try {
			const run = await executeProfessionalWorldsEvaluationRun({
				dataset_id: selectedDatasetId,
				target_type: targetType,
				target_key: key,
				simulate,
				notes: null,
			});
			setMessage(
				t('admin.evaluation.runFinished', {
					status: translateEvaluationValue(t, 'runStatuses', run.status),
				})
			);
			setSelectedRun(run);
			await refresh();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.errors.operationFailed')
			);
		}
	}

	async function handleSaveHumanNotes() {
		if (!selectedRun) {
			return;
		}
		setSavingNotes(true);
		setError(null);
		try {
			await patchProfessionalWorldsEvaluationRunHumanNotes(
				selectedRun.id,
				humanNotesDraft.trim() ? humanNotesDraft.trim() : null
			);
			setMessage(t('admin.evaluation.humanNotesSaved'));
			await refresh();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.errors.operationFailed')
			);
		} finally {
			setSavingNotes(false);
		}
	}

	async function handleSaveSampleNotes(sampleId: string) {
		setSavingSampleId(sampleId);
		setError(null);
		try {
			const draft = sampleNotesDrafts[sampleId] ?? '';
			await patchProfessionalWorldsEvaluationSampleHumanNotes(
				sampleId,
				draft.trim() ? draft.trim() : null
			);
			setMessage(
				t('admin.evaluation.sampleHumanNotesSaved', 'Sample notes saved')
			);
			await refresh();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.errors.operationFailed')
			);
		} finally {
			setSavingSampleId(null);
		}
	}

	if (loading && !dashboard) {
		return (
			<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-8 text-[var(--admin-ui-fg-muted)]">
				{t('admin.status.loading')}
			</div>
		);
	}

	const datasets = dashboard?.datasets ?? [];
	const recentRuns = dashboard?.recent_runs ?? [];

	return (
		<div className="grid gap-4 xl:grid-cols-2">
			<div className="grid gap-4">
				<Panel title={t('admin.evaluation.datasetsTitle')}>
					<div className="grid gap-3">
						<p className="text-xs text-[var(--admin-ui-fg-muted)]">
							{t('admin.evaluation.datasetsHint')}
						</p>
						<FieldBlock label={t('admin.evaluation.datasetName')}>
							<AdminField
								value={datasetName}
								onChange={(event) => setDatasetName(event.target.value)}
							/>
						</FieldBlock>
						<FieldBlock label={t('admin.evaluation.datasetDescription')}>
							<AdminField
								value={datasetDescription}
								onChange={(event) => setDatasetDescription(event.target.value)}
							/>
						</FieldBlock>
						<FieldBlock label={t('admin.evaluation.casesJson')}>
							<textarea
								value={casesJson}
								onChange={(event) => setCasesJson(event.target.value)}
								rows={6}
								aria-label={t('admin.evaluation.casesJsonAria')}
								className={cn(adminUiFieldClass, 'font-mono text-xs')}
							/>
							<span className="text-xs leading-relaxed text-[var(--admin-ui-fg-dim)]">
								{t('admin.evaluation.casesJsonHint')}
							</span>
						</FieldBlock>
						<AdminButton
							variant="primary"
							onClick={() => void handleCreateDataset()}
						>
							{t('admin.evaluation.createDataset')}
						</AdminButton>
						{selectedDatasetId ? (
							<div className="mt-4 space-y-2 rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3">
								<p className="text-xs text-[var(--admin-ui-fg-muted)]">
									{t(
										'admin.evaluation.datasetLifecycleHint',
										'Lifecycle for selected dataset (PATCH metadata / DELETE requires emperyworld_admin).'
									)}
								</p>
								<EntityLifecycleBar
									deleteLabel={t(
										'admin.evaluation.deleteDataset',
										'Delete dataset'
									)}
									deleteDisabled={datasetBusy}
									onDelete={() => setDeleteDatasetOpen(true)}
								>
									<AdminButton
										variant="secondary"
										disabled={datasetBusy || !datasetName.trim()}
										onClick={() =>
											void (async () => {
												setDatasetBusy(true);
												setError(null);
												try {
													await patchProfessionalWorldsEvaluationDataset(
														selectedDatasetId,
														{
															name: datasetName.trim() || undefined,
															description: datasetDescription.trim() || null,
															is_active: true,
														}
													);
													setMessage(
														t(
															'admin.evaluation.datasetPatched',
															'Dataset updated'
														)
													);
													await refresh();
												} catch (err) {
													setError(
														err instanceof Error
															? err.message
															: t('admin.errors.operationFailed')
													);
												} finally {
													setDatasetBusy(false);
												}
											})()
										}
									>
										{t(
											'admin.evaluation.saveDatasetMeta',
											'Save name / description'
										)}
									</AdminButton>
									<AdminButton
										variant="ghost"
										disabled={datasetBusy}
										onClick={() =>
											void (async () => {
												setDatasetBusy(true);
												setError(null);
												try {
													const current = datasets.find(
														(d) => d.id === selectedDatasetId
													);
													await patchProfessionalWorldsEvaluationDataset(
														selectedDatasetId,
														{ is_active: !(current?.is_active ?? true) }
													);
													setMessage(
														t(
															'admin.evaluation.datasetActiveToggled',
															'Dataset active flag updated'
														)
													);
													await refresh();
												} catch (err) {
													setError(
														err instanceof Error
															? err.message
															: t('admin.errors.operationFailed')
													);
												} finally {
													setDatasetBusy(false);
												}
											})()
										}
									>
										{t('admin.evaluation.toggleDatasetActive', 'Toggle active')}
									</AdminButton>
								</EntityLifecycleBar>
							</div>
						) : null}
					</div>
				</Panel>

				<Panel title={t('admin.evaluation.runTitle')}>
					<div className="grid gap-3">
						<FieldBlock label={t('admin.evaluation.datasetId')}>
							<AdminSelect
								value={selectedDatasetId}
								onChange={(event) => setSelectedDatasetId(event.target.value)}
							>
								<option value="">{t('admin.evaluation.pickDataset')}</option>
								{datasets.map((dataset) => (
									<option key={dataset.id} value={dataset.id}>
										{t('admin.evaluation.datasetOption', {
											name: dataset.name,
											id: dataset.id.slice(0, 8),
										})}
									</option>
								))}
							</AdminSelect>
						</FieldBlock>
						<FieldBlock label={t('admin.evaluation.targetType')}>
							<AdminSelect
								value={targetType}
								onChange={(event) =>
									setTargetType(event.target.value as EvaluationTargetType)
								}
							>
								<option value="ai_action">
									{translateEvaluationValue(t, 'targetTypes', 'ai_action')}
								</option>
								<option value="playbook">
									{translateEvaluationValue(t, 'targetTypes', 'playbook')}
								</option>
							</AdminSelect>
						</FieldBlock>
						<FieldBlock label={t('admin.evaluation.targetKey')}>
							<AdminField
								value={targetKey}
								onChange={(event) => setTargetKey(event.target.value)}
								placeholder={t('admin.evaluation.targetKeyPlaceholder')}
							/>
							<span className="text-xs leading-relaxed text-[var(--admin-ui-fg-dim)]">
								{t('admin.evaluation.targetKeyHint')}
							</span>
						</FieldBlock>
						<AdminToggle
							checked={simulate}
							onChange={(event) => setSimulate(event.target.checked)}
							label={t('admin.evaluation.simulate')}
						/>
						<AdminButton
							variant="primary"
							onClick={() => void handleRunEvaluation()}
						>
							{t('admin.evaluation.runNow')}
						</AdminButton>
					</div>
				</Panel>
			</div>

			<div className="grid gap-4">
				<Panel title={t('admin.evaluation.recentRunsTitle')}>
					<ul className="max-h-72 divide-y divide-[var(--admin-ui-border)] overflow-auto text-sm">
						{recentRuns.map((run) => (
							<li key={run.id}>
								<button
									type="button"
									onClick={() => setSelectedRun(run)}
									className={cn(
										'w-full py-2 text-left transition-colors hover:bg-[var(--admin-ui-surface-strong)]',
										selectedRun?.id === run.id &&
											'bg-[var(--admin-ui-accent-soft)]'
									)}
								>
									<div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
										<span className="text-xs text-[var(--admin-ui-fg-muted)]">
											{run.created_at}
										</span>
										<span className="text-xs font-medium text-[var(--admin-ui-accent)]">
											{t('admin.evaluation.runTargetLine', {
												type: translateEvaluationValue(
													t,
													'targetTypes',
													run.target_type
												),
												key: run.target_key,
											})}
										</span>
										<span className="text-xs text-[var(--admin-ui-fg)]">
											{translateEvaluationValue(t, 'runStatuses', run.status)}
										</span>
									</div>
								</button>
							</li>
						))}
					</ul>
					{recentRuns.length === 0 && (
						<p className="py-6 text-center text-xs text-[var(--admin-ui-fg-dim)]">
							{t('admin.evaluation.noRunsYet')}
						</p>
					)}
				</Panel>

				{selectedRun && (
					<Panel title={t('admin.evaluation.lastRunDetail')}>
						<dl className="grid gap-2 text-xs text-[var(--admin-ui-fg-muted)]">
							<div>
								<dt className="text-[var(--admin-ui-fg-dim)]">
									{t('admin.evaluation.runIdLabel')}
								</dt>
								<dd className="font-mono text-[var(--admin-ui-accent)]">
									{selectedRun.id}
								</dd>
							</div>
							<div>
								<dt className="text-[var(--admin-ui-fg-dim)]">
									{t('admin.evaluation.colScores')}
								</dt>
								<dd>
									<AdminJsonPreview
										title={t('admin.evaluation.scoresJsonTitle')}
										helper={t('admin.evaluation.scoresJsonHelper')}
										value={selectedRun.scores}
									/>
								</dd>
							</div>
							{selectedRun.error ? (
								<div>
									<dt className="text-[var(--admin-ui-fg-dim)]">
										{t('admin.evaluation.errorLabel')}
									</dt>
									<dd className="mt-1">
										<AdminStatusBanner tone="danger">
											{selectedRun.error}
										</AdminStatusBanner>
									</dd>
								</div>
							) : null}
						</dl>

						<FieldBlock label={t('admin.evaluation.humanNotes')}>
							<textarea
								value={humanNotesDraft}
								onChange={(event) => setHumanNotesDraft(event.target.value)}
								rows={4}
								className={cn(adminUiFieldClass, 'mt-4')}
							/>
						</FieldBlock>
						<AdminButton
							variant="secondary"
							className="mt-2"
							disabled={savingNotes}
							onClick={() => void handleSaveHumanNotes()}
						>
							{t('admin.actions.save')}
						</AdminButton>

						{selectedRun.samples && selectedRun.samples.length > 0 && (
							<div className="mt-4">
								<h4 className="mb-2 text-sm font-medium text-[var(--admin-ui-fg)]">
									{t('admin.evaluation.samples')}
								</h4>
								<ul className="grid gap-3">
									{selectedRun.samples.map((sample) => (
										<li
											key={sample.id}
											className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3"
										>
											<p className="text-xs text-[var(--admin-ui-fg-muted)]">
												{t('admin.evaluation.sampleLabel', {
													index: sample.case_index,
													labelSuffix: sample.label ? ` · ${sample.label}` : '',
												})}
											</p>
											<AdminJsonPreview
												title={t('admin.evaluation.scoresJsonTitle')}
												helper={t('admin.evaluation.scoresJsonHelper')}
												value={sample.scores}
											/>
											<div className="mt-3 grid gap-1 text-sm">
												<span
													className="text-[var(--admin-ui-fg)]"
													id={`pw-sample-notes-${sample.id}`}
												>
													{t(
														'admin.evaluation.sampleHumanNotes',
														'Sample human notes'
													)}
												</span>
												<AdminField
													aria-labelledby={`pw-sample-notes-${sample.id}`}
													value={sampleNotesDrafts[sample.id] ?? ''}
													onChange={(event) =>
														setSampleNotesDrafts((prev) => ({
															...prev,
															[sample.id]: event.target.value,
														}))
													}
												/>
											</div>
											<AdminButton
												variant="secondary"
												className="mt-2"
												disabled={savingSampleId === sample.id}
												onClick={() => void handleSaveSampleNotes(sample.id)}
											>
												{t('admin.actions.save')}
											</AdminButton>
										</li>
									))}
								</ul>
							</div>
						)}
					</Panel>
				)}
			</div>

			{error ? (
				<AdminStatusBanner tone="danger" className="xl:col-span-2">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<span>{error}</span>
						<AdminButton variant="ghost" onClick={() => void refresh()}>
							{t('admin.evaluation.retryLoad')}
						</AdminButton>
					</div>
				</AdminStatusBanner>
			) : null}
			{message ? (
				<AdminStatusBanner tone="success" className="xl:col-span-2">
					{message}
				</AdminStatusBanner>
			) : null}

			<DangerConfirmModal
				open={deleteDatasetOpen}
				title={t(
					'admin.evaluation.deleteDatasetTitle',
					'Delete evaluation dataset'
				)}
				description={t(
					'admin.evaluation.deleteDatasetBody',
					'Hard-deletes the selected dataset and cascades evaluation runs. Requires emperyworld_admin. Type DELETE to confirm.'
				)}
				confirmPhrase="DELETE"
				busy={datasetBusy}
				onCancel={() => setDeleteDatasetOpen(false)}
				onConfirm={() =>
					void (async () => {
						if (!selectedDatasetId) return;
						setDatasetBusy(true);
						setError(null);
						try {
							await deleteProfessionalWorldsEvaluationDataset(
								selectedDatasetId
							);
							setDeleteDatasetOpen(false);
							setSelectedDatasetId('');
							setMessage(
								t('admin.evaluation.datasetDeleted', 'Dataset deleted')
							);
							await refresh();
						} catch (err) {
							setError(
								err instanceof Error
									? err.message
									: t('admin.errors.operationFailed')
							);
						} finally {
							setDatasetBusy(false);
						}
					})()
				}
			/>
		</div>
	);
}
