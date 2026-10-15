/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWA companion admin — Action workflows tab: list, Monaco editor, validate-before-save, new workflow draft.
 *
 * Invariants:
 * - Save/Enable require successful Validate on current editor JSON (WF-6 operator safety).
 * - Mutations require ``workflowWriteEnabled`` (see ``ewaCompanionAdminWriteGate``).
 *
 * Related:
 * - documentation/product/ewa/EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { EwaCompanionAdminBoolBadge } from './EwaCompanionAdminBoolBadge';
import { EwaCompanionAdminCatalogFrame } from './ewaCompanionAdminCatalogFrame';
import { EwaCompanionEnvGateLink } from './EwaCompanionEnvGateLink';
import {
	disableEwaCompanionWorkflow,
	enableEwaCompanionWorkflowVersion,
	fetchEwaCompanionWorkflowAudit,
	fetchEwaCompanionWorkflowDetail,
	fetchEwaCompanionWorkflows,
	saveEwaCompanionWorkflowDefinition,
	validateEwaCompanionWorkflowDefinition,
	type EwaCompanionWorkflowSummary,
	type EwaCompanionWorkflowValidateResponse,
} from './ewaCompanionAdminApi';
import {
	isWorkflowEditorValidated,
	parseWorkflowEditorJson,
	workflowEditorFingerprint,
} from './ewaCompanionWorkflowEditorState';
import {
	EWA_COMPANION_NEW_WORKFLOW_KEY,
	formatCompanionWorkflowTemplateJson,
} from './ewaCompanionWorkflowTemplate';

const MonacoJsonEditor = React.lazy(
	() => import('./CompanionWorkflowMonacoTab')
);

function ValidationBar({
	result,
	error,
}: {
	result: EwaCompanionWorkflowValidateResponse | null;
	error: string | null;
}) {
	const { t } = useTranslation('desktopUi');
	if (error) {
		return (
			<div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
				{error}
			</div>
		);
	}
	if (!result) {
		return null;
	}
	const warnings = result.warnings ?? [];
	const errors = result.errors ?? [];
	const toolNames = result.tool_names ?? [];
	const warningsBlock =
		warnings.length > 0 ? (
			<div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
				<div className="font-medium">
					{t('ewaCompanionAdmin.validationWarnings')}
				</div>
				<ul className="mt-1 list-disc pl-5 text-xs">
					{warnings.map((line) => (
						<li key={line}>{line}</li>
					))}
				</ul>
			</div>
		) : null;

	if (result.ok) {
		return (
			<div className="space-y-2">
				<div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
					{t('ewaCompanionAdmin.validationOk', {
						steps: result.step_count,
						tools: toolNames.join(', ') || '—',
					})}
				</div>
				{warningsBlock}
			</div>
		);
	}
	return (
		<div className="space-y-2">
			<div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
				<div className="font-medium">
					{t('ewaCompanionAdmin.validationFailed')}
				</div>
				<ul className="mt-1 list-disc pl-5 text-xs">
					{errors.map((line) => (
						<li key={line}>{line}</li>
					))}
				</ul>
			</div>
			{warningsBlock}
		</div>
	);
}

export function EwaCompanionActionWorkflowsTab({
	workflowWriteEnabled,
	onOpenSetting,
}: {
	workflowWriteEnabled: boolean;
	onOpenSetting?: (settingKey: string) => void;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const queryClient = useQueryClient();
	const listQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'workflows'],
		queryFn: fetchEwaCompanionWorkflows,
		retry: false,
	});

	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const isNewDraft = selectedKey === EWA_COMPANION_NEW_WORKFLOW_KEY;
	const selectedId = isNewDraft ? null : selectedKey;

	const detailQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'workflow', selectedId],
		queryFn: () => fetchEwaCompanionWorkflowDetail(selectedId ?? ''),
		enabled: Boolean(selectedId),
	});
	const auditQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'workflow-audit', selectedId],
		queryFn: () => fetchEwaCompanionWorkflowAudit(selectedId ?? ''),
		enabled: Boolean(selectedId),
	});

	const [editorText, setEditorText] = useState('');
	const [validation, setValidation] =
		useState<EwaCompanionWorkflowValidateResponse | null>(null);
	const [validatedFingerprint, setValidatedFingerprint] = useState<
		string | null
	>(null);
	const [validationError, setValidationError] = useState<string | null>(null);
	const [actionMessage, setActionMessage] = useState<string | null>(null);

	const editorValidated = isWorkflowEditorValidated(
		editorText,
		validation,
		validatedFingerprint
	);

	useEffect(() => {
		if (isNewDraft) {
			return;
		}
		if (detailQuery.data?.definition) {
			setEditorText(JSON.stringify(detailQuery.data.definition, null, 2));
			setValidation(null);
			setValidatedFingerprint(null);
			setValidationError(null);
			setActionMessage(null);
		}
	}, [detailQuery.data?.definition, isNewDraft]);

	const invalidateValidation = () => {
		setValidation(null);
		setValidatedFingerprint(null);
	};

	const handleEditorChange = (value: string) => {
		setEditorText(value);
		if (validatedFingerprint !== null) {
			invalidateValidation();
		}
	};

	const startNewWorkflowDraft = () => {
		setSelectedKey(EWA_COMPANION_NEW_WORKFLOW_KEY);
		setEditorText(formatCompanionWorkflowTemplateJson());
		invalidateValidation();
		setValidationError(null);
		setActionMessage(null);
	};

	const validateMutation = useMutation({
		mutationFn: async () => {
			const parsed = parseWorkflowEditorJson(editorText);
			if (!parsed) {
				throw new Error('invalid_json');
			}
			return validateEwaCompanionWorkflowDefinition(parsed);
		},
		onSuccess: (result) => {
			setValidation(result);
			setValidatedFingerprint(
				result.ok ? workflowEditorFingerprint(editorText) : null
			);
			setValidationError(null);
			setActionMessage(null);
		},
		onError: () => {
			invalidateValidation();
			setValidationError(t('ewaCompanionAdmin.validationJsonError'));
		},
	});

	const saveMutation = useMutation({
		mutationFn: async () => {
			const parsed = parseWorkflowEditorJson(editorText);
			if (!parsed) {
				throw new Error('invalid_json');
			}
			return saveEwaCompanionWorkflowDefinition(parsed);
		},
		onSuccess: async (result) => {
			const savedId = String(
				(result.definition as Record<string, unknown>).workflow_id ??
					validation?.workflow_id ??
					''
			);
			setActionMessage(t('ewaCompanionAdmin.actionSaved'));
			if (savedId) {
				setSelectedKey(savedId);
			}
			invalidateValidation();
			await queryClient.invalidateQueries({
				queryKey: ['ewa', 'admin', 'companion'],
			});
		},
		onError: () => setActionMessage(t('ewaCompanionAdmin.actionSaveFailed')),
	});

	const enableMutation = useMutation({
		mutationFn: async () => {
			const parsed = parseWorkflowEditorJson(editorText);
			if (!parsed) {
				throw new Error('invalid_json');
			}
			const workflowId = String(parsed.workflow_id ?? selectedId ?? '');
			const version = Number(
				parsed.version ?? detailQuery.data?.pg_version ?? 1
			);
			return enableEwaCompanionWorkflowVersion(workflowId, version);
		},
		onSuccess: async () => {
			setActionMessage(t('ewaCompanionAdmin.actionEnabled'));
			await queryClient.invalidateQueries({
				queryKey: ['ewa', 'admin', 'companion'],
			});
		},
		onError: () => setActionMessage(t('ewaCompanionAdmin.actionEnableFailed')),
	});

	const disableMutation = useMutation({
		mutationFn: async () => disableEwaCompanionWorkflow(selectedId ?? ''),
		onSuccess: async () => {
			setActionMessage(t('ewaCompanionAdmin.actionDisabled'));
			await queryClient.invalidateQueries({
				queryKey: ['ewa', 'admin', 'companion'],
			});
		},
		onError: () => setActionMessage(t('ewaCompanionAdmin.actionDisableFailed')),
	});

	const workflows = listQuery.data?.workflows ?? [];
	const parsedVersion = useMemo(() => {
		return parseWorkflowEditorJson(editorText)?.version ?? null;
	}, [editorText]);

	const parsedEnvGate = useMemo(() => {
		const raw = parseWorkflowEditorJson(editorText)?.env_gate;
		return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
	}, [editorText]);

	const canSaveOrEnable = workflowWriteEnabled && editorValidated;

	const handleSave = () => {
		if (!editorValidated) {
			setActionMessage(t('ewaCompanionAdmin.workflowSaveNeedsValidation'));
			return;
		}
		saveMutation.mutate();
	};

	const handleEnable = () => {
		if (!editorValidated) {
			setActionMessage(t('ewaCompanionAdmin.workflowEnableNeedsValidation'));
			return;
		}
		enableMutation.mutate();
	};

	const showEditor =
		isNewDraft ||
		(Boolean(selectedId) &&
			!detailQuery.isLoading &&
			!detailQuery.error &&
			detailQuery.data);

	return (
		<EwaCompanionAdminCatalogFrame
			isLoading={listQuery.isLoading}
			error={listQuery.error}
			empty={false}
			loadingLabel={t('ewaCompanionAdmin.loadingWorkflows')}
			emptyLabel={t('ewaCompanionAdmin.emptyActionWorkflows')}
		>
			<div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
				<div className="flex flex-col gap-2">
					{workflowWriteEnabled ? (
						<button
							type="button"
							className={`${DESKTOP_INTERACTIVE.btnRounded} w-full bg-[rgb(var(--desktop-accent-rgb)/0.25)] px-3 py-2 text-sm text-[rgb(var(--desktop-accent-rgb)/0.95)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.3)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.35)]`}
							onClick={startNewWorkflowDraft}
						>
							{t('ewaCompanionAdmin.btnNewWorkflow')}
						</button>
					) : null}
					<div className="overflow-auto rounded-lg border border-white/10">
						<ul className="divide-y divide-white/5">
							{isNewDraft ? (
								<li>
									<div className="w-full bg-[rgb(var(--desktop-accent-rgb)/0.1)] px-3 py-2 text-left text-sm text-white">
										<div className="font-medium">
											{t('ewaCompanionAdmin.workflowNewDraftBadge')}
										</div>
										<div className="text-xs text-(--desktop-text-muted)">
											{t('ewaCompanionAdmin.btnNewWorkflow')}
										</div>
									</div>
								</li>
							) : null}
							{workflows.length === 0 && !isNewDraft ? (
								<li>
									<p
										className={`${DESKTOP_TYPOGRAPHY.meta} px-3 py-4 text-(--desktop-text-dim)`}
									>
										{t('ewaCompanionAdmin.emptyActionWorkflows')}
									</p>
								</li>
							) : null}
							{workflows.map((wf: EwaCompanionWorkflowSummary) => (
								<li key={wf.workflow_id}>
									<button
										type="button"
										className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.04] ${
											selectedKey === wf.workflow_id
												? 'bg-[rgb(var(--desktop-accent-rgb)/0.1)] text-white'
												: 'text-(--desktop-text-primary)'
										}`}
										onClick={() => setSelectedKey(wf.workflow_id)}
									>
										<div className="font-medium">
											{wf.title_ru || wf.workflow_id}
										</div>
										<div className="font-mono text-xs text-(--desktop-text-dim)">
											{wf.workflow_id}
										</div>
										<div className="text-xs text-(--desktop-text-muted)">
											{t('ewaCompanionAdmin.workflowListMeta', {
												version: wf.version,
												source: wf.source,
											})}{' '}
											<EwaCompanionAdminBoolBadge
												value={wf.effective_enabled}
											/>
										</div>
										{wf.env_gate ? (
											<div className="mt-0.5 text-[10px] text-(--desktop-text-dim)">
												<EwaCompanionEnvGateLink
													envGate={wf.env_gate}
													onOpenSetting={onOpenSetting}
													className="text-[10px]"
												/>
											</div>
										) : null}
									</button>
								</li>
							))}
						</ul>
					</div>
				</div>
				<div className="min-h-[240px] rounded-lg border border-white/10 bg-black/20 p-4">
					{!selectedKey ? (
						<p
							className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}
						>
							{t('ewaCompanionAdmin.selectWorkflowHint')}
						</p>
					) : detailQuery.isLoading && !isNewDraft ? (
						<p
							className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}
						>
							{t('ewaCompanionAdmin.loadingDetail')}
						</p>
					) : detailQuery.error && !isNewDraft ? (
						<p className="text-sm text-red-300">
							{t('ewaCompanionAdmin.errorWorkflowDetail')}
						</p>
					) : null}
					{showEditor ? (
						<div className="flex flex-col gap-3">
							{isNewDraft ? (
								<p
									className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}
								>
									{t('ewaCompanionAdmin.workflowNewIntro')}
								</p>
							) : null}
							{isNewDraft ? (
								<span className="inline-flex w-fit rounded bg-[rgb(var(--desktop-accent-rgb)/0.15)] px-2 py-0.5 text-xs text-[rgb(var(--desktop-accent-rgb)/0.9)]">
									{t('ewaCompanionAdmin.workflowNewDraftBadge')}
								</span>
							) : null}
							{!workflowWriteEnabled ? (
								<div
									className={`${DESKTOP_SURFACE.radius} border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100`}
								>
									{t('ewaCompanionAdmin.workflowReadOnlyHint')}
								</div>
							) : null}
							{!isNewDraft && detailQuery.data ? (
								<div className="flex flex-wrap items-center gap-2 text-sm text-(--desktop-text-secondary)">
									<span>
										{t('ewaCompanionAdmin.effectiveEnabled')}:{' '}
										<EwaCompanionAdminBoolBadge
											value={Boolean(detailQuery.data.effective_enabled)}
										/>
									</span>
									<span className="text-(--desktop-text-dim)">
										{t('ewaCompanionAdmin.source')}: {detailQuery.data.source}
									</span>
									{detailQuery.data.catalog_enabled != null ? (
										<span>
											{t('ewaCompanionAdmin.catalog')}:{' '}
											<EwaCompanionAdminBoolBadge
												value={Boolean(detailQuery.data.catalog_enabled)}
											/>
										</span>
									) : null}
									{parsedVersion != null ? (
										<span className="text-(--desktop-text-dim)">
											{t('ewaCompanionAdmin.editorVersion', {
												version: parsedVersion,
											})}
										</span>
									) : null}
								</div>
							) : null}

							{parsedEnvGate ? (
								<div className="text-sm text-(--desktop-text-muted)">
									<EwaCompanionEnvGateLink
										envGate={parsedEnvGate}
										onOpenSetting={onOpenSetting}
									/>
								</div>
							) : null}
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									className={`${DESKTOP_INTERACTIVE.btnRounded} bg-white/[0.06] px-3 py-1.5 text-sm text-(--desktop-text-primary) hover:bg-white/[0.1]`}
									onClick={() => validateMutation.mutate()}
									disabled={validateMutation.isPending}
								>
									{t('ewaCompanionAdmin.btnValidate')}
								</button>
								<button
									type="button"
									className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-sm ${
										canSaveOrEnable
											? 'bg-[rgb(var(--desktop-accent-rgb)/0.3)] text-white hover:bg-[rgb(var(--desktop-accent-rgb)/0.4)]'
											: 'cursor-not-allowed bg-white/[0.04] text-(--desktop-text-dim)'
									}`}
									onClick={handleSave}
									disabled={!workflowWriteEnabled || saveMutation.isPending}
									title={
										!editorValidated && workflowWriteEnabled
											? t('ewaCompanionAdmin.workflowSaveNeedsValidation')
											: undefined
									}
								>
									{t('ewaCompanionAdmin.btnSaveVersion')}
								</button>
								<button
									type="button"
									className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-sm ${
										canSaveOrEnable && !isNewDraft
											? 'bg-emerald-600/25 text-emerald-100 hover:bg-emerald-600/35'
											: 'cursor-not-allowed bg-white/[0.04] text-(--desktop-text-dim)'
									}`}
									onClick={handleEnable}
									disabled={
										!workflowWriteEnabled ||
										isNewDraft ||
										enableMutation.isPending
									}
									title={
										isNewDraft
											? t('ewaCompanionAdmin.workflowEnableAfterSave')
											: !editorValidated && workflowWriteEnabled
												? t('ewaCompanionAdmin.workflowEnableNeedsValidation')
												: undefined
									}
								>
									{t('ewaCompanionAdmin.btnEnable')}
								</button>
								<button
									type="button"
									className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-sm ${
										workflowWriteEnabled && !isNewDraft
											? 'bg-[rgb(var(--desktop-fg-primary-rgb)/0.14)] text-(--desktop-text-primary) hover:bg-[rgb(var(--desktop-fg-primary-rgb)/0.2)]'
											: 'cursor-not-allowed bg-white/[0.04] text-(--desktop-text-dim)'
									}`}
									onClick={() => disableMutation.mutate()}
									disabled={
										!workflowWriteEnabled ||
										isNewDraft ||
										!selectedId ||
										disableMutation.isPending
									}
								>
									{t('ewaCompanionAdmin.btnDisable')}
								</button>
							</div>

							{workflowWriteEnabled && !editorValidated && validation ? (
								<p className={`${DESKTOP_TYPOGRAPHY.meta} text-amber-200/90`}>
									{t('ewaCompanionAdmin.workflowValidationStale')}
								</p>
							) : null}
							{workflowWriteEnabled &&
							!editorValidated &&
							!validation &&
							selectedKey ? (
								<p
									className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-dim)`}
								>
									{t('ewaCompanionAdmin.workflowValidateBeforeSaveHint')}
								</p>
							) : null}

							<ValidationBar result={validation} error={validationError} />
							{actionMessage ? (
								<p
									className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}
								>
									{actionMessage}
								</p>
							) : null}

							<div className="overflow-hidden rounded border border-white/10">
								<Suspense
									fallback={
										<p
											className={`${DESKTOP_TYPOGRAPHY.meta} p-4 text-(--desktop-text-muted)`}
										>
											{t('ewaCompanionAdmin.loadingEditor')}
										</p>
									}
								>
									<MonacoJsonEditor
										value={editorText}
										onChange={handleEditorChange}
										editable={workflowWriteEnabled}
									/>
								</Suspense>
							</div>

							{!isNewDraft && auditQuery.data?.entries?.length ? (
								<div className="rounded border border-white/10 bg-black/30 p-3">
									<div className="mb-2 text-xs uppercase tracking-wide text-(--desktop-text-dim)">
										{t('ewaCompanionAdmin.auditTitle')}
									</div>
									<ul className="max-h-40 space-y-1 overflow-auto text-xs text-(--desktop-text-muted)">
										{auditQuery.data.entries.map((entry) => (
											<li key={entry.id}>
												{entry.created_at ?? '—'} · {entry.action} · v
												{entry.version}
												{entry.actor_sub ? ` · ${entry.actor_sub}` : ''}
											</li>
										))}
									</ul>
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</div>
		</EwaCompanionAdminCatalogFrame>
	);
}
