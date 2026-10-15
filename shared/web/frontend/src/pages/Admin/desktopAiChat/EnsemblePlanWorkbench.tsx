/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Three-zone workbench for ensemble plan blueprint admin (builtins, drafts, editor modal).
 *
 * Invariants:
 * - Editor opens in modal/drawer, not inline expand.
 * - Modal chrome lives under ensemblePlanWorkbench/*; this file owns list + actions.
 *
 * Related:
 * - pages/Admin/desktopAiChat/DesktopAiChatBlueprintTab.tsx
 * - pages/Admin/desktopAiChat/ensemblePlanWorkbench/EnsemblePlanEditorDialog.tsx
 * - pages/Admin/ensemblePlan/DesktopEnsemblePlanFormEditor.tsx
 */

import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { log } from '../../../utils/logger';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import {
	extractApiErrorDetail,
	translateEnsemblePlanApiDetail,
} from '../ensemblePlan/ensemblePlanApiErrorI18n';
import { translateEnsemblePlanParseFailure } from '../ensemblePlan/ensemblePlanFormErrorI18n';
import {
	emptyEnsemblePlanFormState,
	formStateToPlanBody,
	parsePlanBodyToForm,
} from '../ensemblePlan/ensemblePlanFormState';
import {
	createEnsemblePlanDraft,
	deleteEnsemblePlanDraft,
	duplicateEnsemblePlanBuiltin,
	fetchEnsemblePlanBuiltinBody,
	fetchEnsemblePlanDraft,
	patchEnsemblePlanDraft,
	validateEnsemblePlanBody,
} from './desktopAiChatBlueprintApi';
import { useDesktopAiChatBlueprint } from './DesktopAiChatBlueprintContext';
import { DesktopAiChatAdminStatusBanner } from './DesktopAiChatAdminStatusBanner';
import type { EnsemblePlanDraftRow } from './desktopAiChatBlueprintTypes';
import {
	EnsemblePlanDuplicateWizard,
	type DuplicateWizardStep,
} from './ensemblePlanWorkbench/EnsemblePlanDuplicateWizard';
import {
	EnsemblePlanEditorDialog,
	type EnsemblePlanEditorTab,
} from './ensemblePlanWorkbench/EnsemblePlanEditorDialog';

export function EnsemblePlanWorkbench(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const {
		drafts,
		builtins,
		actionState,
		statusKind,
		statusMessage,
		validationMessage,
		validationRawJson,
		refresh,
		setActionState,
		setStatus,
		setValidation,
		clearStatus,
	} = useDesktopAiChatBlueprint();

	const [selectedBuiltinId, setSelectedBuiltinId] = React.useState('');
	const [dupWizardOpen, setDupWizardOpen] = React.useState(false);
	const [dupWizardStep, setDupWizardStep] =
		React.useState<DuplicateWizardStep>('pick');
	const [dupNewId, setDupNewId] = React.useState('');
	const [dupTitle, setDupTitle] = React.useState('');

	const [editing, setEditing] = React.useState<EnsemblePlanDraftRow | null>(
		null
	);
	const [editorOpen, setEditorOpen] = React.useState(false);
	const [editorTab, setEditorTab] =
		React.useState<EnsemblePlanEditorTab>('form');
	const [formTitle, setFormTitle] = React.useState('');
	const [formDesc, setFormDesc] = React.useState('');
	const [formKeywords, setFormKeywords] = React.useState('');
	const [formSort, setFormSort] = React.useState(0);
	const [formActive, setFormActive] = React.useState(true);
	const [createTemplateId, setCreateTemplateId] = React.useState('');
	const [planState, setPlanState] = React.useState(
		emptyEnsemblePlanFormState()
	);
	const [jsonText, setJsonText] = React.useState('');
	const [validationHint, setValidationHint] = React.useState<string | null>(
		null
	);

	const [planRowToDelete, setPlanRowToDelete] =
		React.useState<EnsemblePlanDraftRow | null>(null);
	const [confirmDeactivateOpen, setConfirmDeactivateOpen] =
		React.useState(false);

	const openEditorButtonRef = React.useRef<HTMLButtonElement>(null);

	const busy = actionState !== 'idle';

	React.useEffect(() => {
		if (!selectedBuiltinId && builtins[0]?.id) {
			setSelectedBuiltinId(builtins[0].id);
		}
	}, [builtins, selectedBuiltinId]);

	const resetEditorFields = () => {
		setEditing(null);
		setCreateTemplateId('');
		setPlanState(emptyEnsemblePlanFormState());
		setEditorTab('form');
		setJsonText('');
		setFormTitle('');
		setFormDesc('');
		setFormKeywords('');
		setFormSort(0);
		setFormActive(true);
		setValidationHint(null);
	};

	const openCreate = () => {
		clearStatus();
		resetEditorFields();
		setEditorOpen(true);
	};

	const closeEditor = () => {
		setEditorOpen(false);
		resetEditorFields();
		openEditorButtonRef.current?.focus();
	};

	const openEdit = async (row: EnsemblePlanDraftRow) => {
		clearStatus();
		setActionState('saving');
		setValidationHint(null);
		try {
			const full = await fetchEnsemblePlanDraft(row.id);
			setEditing(full);
			setEditorOpen(true);
			setCreateTemplateId(full.template_id);
			const rawBody = (full.body ?? {}) as unknown;
			const parsed = parsePlanBodyToForm(rawBody);
			if (parsed.ok) {
				setPlanState(parsed.state);
				setEditorTab('form');
				setJsonText('');
			} else {
				setPlanState(emptyEnsemblePlanFormState());
				setValidationHint(translateEnsemblePlanParseFailure(parsed, t));
				setJsonText(JSON.stringify(full.body ?? {}, null, 2));
				setEditorTab('json');
			}
			setFormTitle(full.title);
			setFormDesc(full.description);
			setFormKeywords((full.keywords ?? []).join(', '));
			setFormSort(full.sort_order);
			setFormActive(full.is_active);
		} catch (e) {
			log.error(
				'EnsemblePlanWorkbench',
				'open edit failed',
				e instanceof Error ? e : undefined
			);
			setStatus(
				'error',
				e instanceof Error ? e.message : t('adminEnsemblePlan.openError')
			);
		} finally {
			setActionState('idle');
		}
	};

	const resolveBodyForSave = (): {
		body: Record<string, unknown>;
		error: string | null;
	} => {
		const tid = editing ? editing.template_id.trim() : createTemplateId.trim();
		if (!editing && !tid) {
			return { body: {}, error: t('adminEnsemblePlan.needTemplateId') };
		}
		const canonicalTid = tid || 'draft';
		if (editorTab === 'json') {
			try {
				const parsed = JSON.parse(jsonText) as unknown;
				if (
					typeof parsed !== 'object' ||
					parsed === null ||
					Array.isArray(parsed)
				) {
					return { body: {}, error: t('adminEnsemblePlan.jsonMustBeObject') };
				}
				return { body: parsed as Record<string, unknown>, error: null };
			} catch {
				return { body: {}, error: t('adminEnsemblePlan.templateJsonInvalid') };
			}
		}
		return {
			body: formStateToPlanBody(planState, canonicalTid) as Record<
				string,
				unknown
			>,
			error: null,
		};
	};

	const resolveBodyForValidate = (): {
		body: Record<string, unknown>;
		error: string | null;
	} => {
		const tid = editing ? editing.template_id.trim() : createTemplateId.trim();
		if (!editing && !tid) {
			return {
				body: {},
				error: t('adminEnsemblePlan.needTemplateIdForIdCheck'),
			};
		}
		const canonicalTid = tid || '_';
		if (editorTab === 'json') {
			try {
				const parsed = JSON.parse(jsonText) as Record<string, unknown>;
				if (
					typeof parsed !== 'object' ||
					parsed === null ||
					Array.isArray(parsed)
				) {
					return { body: {}, error: t('adminEnsemblePlan.jsonMustBeObject') };
				}
				return { body: parsed, error: null };
			} catch {
				return { body: {}, error: t('adminEnsemblePlan.jsonInvalid') };
			}
		}
		return {
			body: formStateToPlanBody(planState, canonicalTid) as Record<
				string,
				unknown
			>,
			error: null,
		};
	};

	const performSave = async () => {
		clearStatus();
		const { body, error: bodyErr } = resolveBodyForSave();
		if (bodyErr) {
			setStatus('error', bodyErr);
			return;
		}
		const kw = formKeywords
			.split(/[,;\n]+/)
			.map((s) => s.trim())
			.filter(Boolean);
		setActionState('saving');
		try {
			if (editing) {
				await patchEnsemblePlanDraft(editing.id, {
					title: formTitle,
					description: formDesc,
					keywords: kw,
					sort_order: formSort,
					is_active: formActive,
					body,
				});
				setStatus('success', t('adminEnsemblePlan.saved'));
			} else {
				const tid = String(body.id ?? createTemplateId).trim();
				if (!tid) {
					setStatus('error', t('adminEnsemblePlan.needRootId'));
					return;
				}
				await createEnsemblePlanDraft({
					template_id: tid,
					title: formTitle || tid,
					description: formDesc,
					keywords: kw,
					sort_order: formSort,
					is_active: formActive,
					body,
				});
				setStatus('success', t('adminEnsemblePlan.created'));
			}
			closeEditor();
			await refresh();
		} catch (e) {
			const translated = translateEnsemblePlanApiDetail(
				extractApiErrorDetail(e),
				t,
				e instanceof Error ? e.message : t('adminEnsemblePlan.saveError')
			);
			setStatus('error', translated.message);
		} finally {
			setActionState('idle');
		}
	};

	const saveEditor = async () => {
		if (editing?.is_active && !formActive) {
			setConfirmDeactivateOpen(true);
			return;
		}
		await performSave();
	};

	const validateAgainstApi = async () => {
		clearStatus();
		const { body, error: bodyErr } = resolveBodyForValidate();
		if (bodyErr) {
			setValidation(bodyErr);
			return;
		}
		const tid =
			editing?.template_id.trim() || createTemplateId.trim() || undefined;
		setActionState('validating');
		try {
			await validateEnsemblePlanBody({
				template_id: tid || undefined,
				body,
			});
			setValidation(null);
			setStatus('success', t('adminEnsemblePlan.schemaOk'));
		} catch (e) {
			const translated = translateEnsemblePlanApiDetail(
				extractApiErrorDetail(e),
				t,
				e instanceof Error ? e.message : t('adminEnsemblePlan.validateError')
			);
			setValidation(translated.message, translated.rawJson);
		} finally {
			setActionState('idle');
		}
	};

	const openDuplicateWizard = (builtinId?: string) => {
		clearStatus();
		setSelectedBuiltinId(builtinId ?? selectedBuiltinId);
		setDupNewId('');
		setDupTitle('');
		setDupWizardStep(builtinId ? 'details' : 'pick');
		setDupWizardOpen(true);
	};

	const duplicateBuiltin = async () => {
		clearStatus();
		const source = selectedBuiltinId;
		const ns = dupNewId.trim();
		if (!source || !ns) {
			setStatus('error', t('adminEnsemblePlan.pickBuiltinAndId'));
			return;
		}
		setActionState('saving');
		try {
			await duplicateEnsemblePlanBuiltin({
				source_id: source,
				new_template_id: ns,
				title: dupTitle.trim() || undefined,
			});
			setDupWizardOpen(false);
			setDupNewId('');
			setDupTitle('');
			setStatus('success', t('adminEnsemblePlan.copyCreated'));
			await refresh();
		} catch (e) {
			const translated = translateEnsemblePlanApiDetail(
				extractApiErrorDetail(e),
				t,
				e instanceof Error ? e.message : t('adminEnsemblePlan.genericError')
			);
			setStatus('error', translated.message);
		} finally {
			setActionState('idle');
		}
	};

	const loadBuiltinIntoForm = async (builtinId?: string) => {
		const source = builtinId ?? selectedBuiltinId;
		if (!source) {
			setStatus('error', t('adminEnsemblePlan.pickBuiltin'));
			return;
		}
		clearStatus();
		setActionState('saving');
		setValidationHint(null);
		try {
			const res = await fetchEnsemblePlanBuiltinBody(source);
			const parsed = parsePlanBodyToForm(res.template);
			if (!parsed.ok) {
				setStatus('error', translateEnsemblePlanParseFailure(parsed, t));
				return;
			}
			setEditing(null);
			setEditorOpen(true);
			setPlanState(parsed.state);
			setCreateTemplateId('');
			setFormTitle(parsed.state.title || source);
			setFormDesc(parsed.state.description);
			setFormKeywords((res.keywords ?? []).join(', '));
			setEditorTab('form');
			setJsonText('');
			setFormSort(0);
			setFormActive(true);
			setStatus('success', t('adminEnsemblePlan.builtinLoaded'));
		} catch (e) {
			setStatus(
				'error',
				e instanceof Error ? e.message : t('adminEnsemblePlan.loadBuiltinError')
			);
		} finally {
			setActionState('idle');
		}
	};

	const confirmRemoveRow = async () => {
		const row = planRowToDelete;
		if (!row) return;
		clearStatus();
		setActionState('saving');
		try {
			await deleteEnsemblePlanDraft(row.id);
			setStatus('success', t('adminEnsemblePlan.deleted'));
			await refresh();
		} catch (e) {
			setStatus(
				'error',
				e instanceof Error ? e.message : t('adminEnsemblePlan.deleteError')
			);
		} finally {
			setActionState('idle');
			setPlanRowToDelete(null);
		}
	};

	return (
		<div className="space-y-6">
			<DesktopAiChatAdminStatusBanner
				kind={statusKind}
				message={statusMessage}
			/>

			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className={`${DESKTOP_TYPOGRAPHY.body} max-w-3xl text-white/70`}>
					{t('adminEnsemblePlan.panelDescription')}
				</p>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => void refresh()}
						disabled={busy}
						className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/90 hover:bg-white/5 disabled:opacity-50"
					>
						<ArrowPathIcon className="h-4 w-4" aria-hidden />
						{t('adminEnsemblePlan.refresh')}
					</button>
					<button
						ref={openEditorButtonRef}
						type="button"
						onClick={openCreate}
						className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/90 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
					>
						<PlusIcon className="h-4 w-4" aria-hidden />
						{t('adminEnsemblePlan.newPlan')}
					</button>
				</div>
			</div>

			<section aria-labelledby="dac-blueprint-builtins-title">
				<h3
					id="dac-blueprint-builtins-title"
					className={`${DESKTOP_TYPOGRAPHY.subtitle} mb-3 text-white/90`}
				>
					{t('adminEnsemblePlan.builtinTemplates')}
				</h3>
				{builtins.length === 0 ? (
					<p className={`${DESKTOP_TYPOGRAPHY.caption} text-white/50`}>
						{t('adminEnsemblePlan.noBuiltins')}
					</p>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
						{builtins.map((b) => {
							const selected = b.id === selectedBuiltinId;
							const kwPreview = (b.keywords ?? []).slice(0, 4).join(', ');
							const example = (b.example_command ?? '').trim();
							return (
								<article
									key={b.id}
									className={`rounded-lg border p-4 transition-colors ${
										selected
											? 'border-violet-400/50 bg-violet-950/25 ring-1 ring-violet-400/30'
											: 'border-white/10 bg-black/25 hover:border-white/20'
									}`}
								>
									<button
										type="button"
										className="w-full text-left"
										onClick={() => setSelectedBuiltinId(b.id)}
										aria-pressed={selected}
									>
										<p className="font-medium text-white/95">{b.title}</p>
										<p className="mt-1 font-mono text-xs text-violet-200/80">
											{b.id}
										</p>
										{kwPreview ? (
											<p
												className={`${DESKTOP_TYPOGRAPHY.caption} mt-2 text-white/55`}
											>
												{t('adminEnsemblePlan.keywordsPreview', {
													keywords: kwPreview,
												})}
											</p>
										) : null}
										{example ? (
											<p
												className={`${DESKTOP_TYPOGRAPHY.caption} mt-2 text-white/60`}
											>
												<span className="text-white/45">
													{t('adminEnsemblePlan.exampleRequest')}{' '}
												</span>
												<code className="rounded bg-black/40 px-1 py-0.5 text-violet-200/90">
													{example}
												</code>
											</p>
										) : null}
									</button>
									<div className="mt-3 flex flex-wrap gap-2">
										<button
											type="button"
											disabled={busy}
											onClick={() => openDuplicateWizard(b.id)}
											className="rounded-lg bg-violet-600/90 px-2.5 py-1 text-xs text-white disabled:opacity-50"
										>
											{t('adminEnsemblePlan.duplicateToDb')}
										</button>
										<button
											type="button"
											disabled={busy}
											onClick={() => void loadBuiltinIntoForm(b.id)}
											className="rounded-lg border border-violet-400/40 px-2.5 py-1 text-xs text-violet-200 hover:bg-violet-950/40 disabled:opacity-50"
										>
											{t('adminEnsemblePlan.openInEditor')}
										</button>
									</div>
								</article>
							);
						})}
					</div>
				)}
				{builtins.length > 0 ? (
					<div className="mt-3">
						<button
							type="button"
							disabled={busy || !selectedBuiltinId}
							onClick={() => openDuplicateWizard()}
							className="text-sm text-violet-300 hover:underline disabled:opacity-50"
						>
							{t('adminEnsemblePlan.duplicateWizardOpen')}
						</button>
					</div>
				) : null}
			</section>

			<section aria-labelledby="dac-blueprint-drafts-title">
				<h3
					id="dac-blueprint-drafts-title"
					className={`${DESKTOP_TYPOGRAPHY.subtitle} mb-3 text-white/90`}
				>
					{t('adminEnsemblePlan.draftsSectionTitle')}
				</h3>
				{drafts.length === 0 ? (
					<p className={`${DESKTOP_TYPOGRAPHY.caption} text-white/50`}>
						{t('adminEnsemblePlan.noDrafts')}
					</p>
				) : (
					<div className="overflow-x-auto rounded-lg border border-white/10">
						<table className="w-full min-w-[640px] text-left text-sm text-white/85">
							<thead className="bg-white/5 text-xs text-white/55 uppercase">
								<tr>
									<th className="px-3 py-2">
										{t('adminEnsemblePlan.colTemplateId')}
									</th>
									<th className="px-3 py-2">
										{t('adminEnsemblePlan.colTitle')}
									</th>
									<th className="px-3 py-2">
										{t('adminEnsemblePlan.colActive')}
									</th>
									<th className="px-3 py-2">
										{t('adminEnsemblePlan.colSort')}
									</th>
									<th className="px-3 py-2 w-32">
										{t('adminEnsemblePlan.colActions')}
									</th>
								</tr>
							</thead>
							<tbody>
								{drafts.map((row) => (
									<tr
										key={row.id}
										className="border-t border-white/10 hover:bg-white/3"
									>
										<td className="px-3 py-2 font-mono text-xs text-violet-200/90">
											{row.template_id}
										</td>
										<td className="px-3 py-2">{row.title}</td>
										<td className="px-3 py-2">
											<span
												className={`rounded-full px-2 py-0.5 text-xs ${
													row.is_active
														? 'bg-emerald-500/15 text-emerald-200'
														: 'bg-white/10 text-white/50'
												}`}
											>
												{row.is_active
													? t('adminEnsemblePlan.activeYes')
													: t('adminEnsemblePlan.activeNo')}
											</span>
										</td>
										<td className="px-3 py-2">{row.sort_order}</td>
										<td className="px-3 py-2">
											<div className="flex gap-1">
												<button
													type="button"
													onClick={() => void openEdit(row)}
													disabled={busy}
													className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
												>
													{t('adminEnsemblePlan.editRow')}
												</button>
												<button
													type="button"
													onClick={() => setPlanRowToDelete(row)}
													disabled={busy}
													className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300/90 hover:bg-red-950/40 disabled:opacity-50"
													aria-label={t('adminEnsemblePlan.deleteAria')}
												>
													<TrashIcon className="h-3.5 w-3.5" />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{editorOpen ? (
				<EnsemblePlanEditorDialog
					busy={busy}
					actionState={actionState}
					editing={editing}
					createTemplateId={createTemplateId}
					onCreateTemplateIdChange={setCreateTemplateId}
					formTitle={formTitle}
					onFormTitleChange={setFormTitle}
					formDesc={formDesc}
					onFormDescChange={setFormDesc}
					formKeywords={formKeywords}
					onFormKeywordsChange={setFormKeywords}
					formSort={formSort}
					onFormSortChange={setFormSort}
					formActive={formActive}
					onFormActiveChange={setFormActive}
					planState={planState}
					onPlanStateChange={setPlanState}
					editorTab={editorTab}
					onEditorTabChange={setEditorTab}
					jsonText={jsonText}
					onJsonTextChange={setJsonText}
					validationHint={validationHint}
					validationMessage={validationMessage}
					validationRawJson={validationRawJson}
					onValidationHint={setValidationHint}
					onClearValidation={() => setValidation(null)}
					onSave={() => void saveEditor()}
					onValidate={() => void validateAgainstApi()}
					onClose={closeEditor}
				/>
			) : null}

			{dupWizardOpen ? (
				<EnsemblePlanDuplicateWizard
					busy={busy}
					step={dupWizardStep}
					onStepChange={setDupWizardStep}
					builtins={builtins}
					selectedBuiltinId={selectedBuiltinId}
					onSelectedBuiltinIdChange={setSelectedBuiltinId}
					newTemplateId={dupNewId}
					onNewTemplateIdChange={setDupNewId}
					title={dupTitle}
					onTitleChange={setDupTitle}
					onSubmit={() => void duplicateBuiltin()}
					onClose={() => setDupWizardOpen(false)}
				/>
			) : null}

			<ConfirmDeleteModal
				isOpen={planRowToDelete !== null}
				onClose={() => setPlanRowToDelete(null)}
				onConfirm={confirmRemoveRow}
				title={t('adminEnsemblePlan.deleteModalTitle')}
				warningMessage={
					planRowToDelete
						? planRowToDelete.is_active
							? t('adminEnsemblePlan.deleteActiveModalBody', {
									id: planRowToDelete.template_id,
								})
							: t('adminEnsemblePlan.deleteModalBody', {
									id: planRowToDelete.template_id,
								})
						: ''
				}
				confirmButtonLabel={t('adminEnsemblePlan.deleteConfirm')}
				confirmButtonLoadingLabel={t('adminEnsemblePlan.deleteConfirmLoading')}
				cancelButtonLabel={t('adminEnsemblePlan.deleteCancel')}
			/>

			<ConfirmDeleteModal
				isOpen={confirmDeactivateOpen}
				onClose={() => setConfirmDeactivateOpen(false)}
				onConfirm={async () => {
					setConfirmDeactivateOpen(false);
					await performSave();
				}}
				title={t('adminEnsemblePlan.deactivateModalTitle')}
				warningMessage={t('adminEnsemblePlan.deactivateModalBody', {
					id: editing?.template_id ?? '',
				})}
				confirmButtonLabel={t('adminEnsemblePlan.deactivateConfirm')}
				cancelButtonLabel={t('adminEnsemblePlan.deleteCancel')}
			/>
		</div>
	);
}
