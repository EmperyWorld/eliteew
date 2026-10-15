/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal editor for ensemble plan draft create/edit (form + JSON tabs).
 *
 * Invariants:
 * - Focus trap + dialog chrome live here; save/validate stay in parent.
 *
 * Related:
 * - pages/Admin/desktopAiChat/EnsemblePlanWorkbench.tsx
 * - pages/Admin/ensemblePlan/DesktopEnsemblePlanFormEditor.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useDesktopAiDialogFocusTrap } from '../../../../features/desktop-ai-chat/useDesktopAiDialogFocusTrap';
import { DESKTOP_TYPOGRAPHY } from '../../../Desktop/constants';
import { DesktopEnsemblePlanFormEditor } from '../../ensemblePlan/DesktopEnsemblePlanFormEditor';
import type { EnsemblePlanFormState } from '../../ensemblePlan/ensemblePlanFormState';
import type { EnsemblePlanDraftRow } from '../desktopAiChatBlueprintTypes';

export type EnsemblePlanEditorTab = 'form' | 'json';

export type EnsemblePlanEditorDialogProps = {
	busy: boolean;
	actionState: string;
	editing: EnsemblePlanDraftRow | null;
	createTemplateId: string;
	onCreateTemplateIdChange: (value: string) => void;
	formTitle: string;
	onFormTitleChange: (value: string) => void;
	formDesc: string;
	onFormDescChange: (value: string) => void;
	formKeywords: string;
	onFormKeywordsChange: (value: string) => void;
	formSort: number;
	onFormSortChange: (value: number) => void;
	formActive: boolean;
	onFormActiveChange: (value: boolean) => void;
	planState: EnsemblePlanFormState;
	onPlanStateChange: (state: EnsemblePlanFormState) => void;
	editorTab: EnsemblePlanEditorTab;
	onEditorTabChange: (tab: EnsemblePlanEditorTab) => void;
	jsonText: string;
	onJsonTextChange: (value: string) => void;
	validationHint: string | null;
	validationMessage: string | null;
	validationRawJson: string | null;
	onValidationHint: (hint: string | null) => void;
	onClearValidation: () => void;
	onSave: () => void;
	onValidate: () => void;
	onClose: () => void;
};

export function EnsemblePlanEditorDialog({
	busy,
	actionState,
	editing,
	createTemplateId,
	onCreateTemplateIdChange,
	formTitle,
	onFormTitleChange,
	formDesc,
	onFormDescChange,
	formKeywords,
	onFormKeywordsChange,
	formSort,
	onFormSortChange,
	formActive,
	onFormActiveChange,
	planState,
	onPlanStateChange,
	editorTab,
	onEditorTabChange,
	jsonText,
	onJsonTextChange,
	validationHint,
	validationMessage,
	validationRawJson,
	onValidationHint,
	onClearValidation,
	onSave,
	onValidate,
	onClose,
}: EnsemblePlanEditorDialogProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const editorDialogRef = React.useRef<HTMLDivElement>(null);
	useDesktopAiDialogFocusTrap(editorDialogRef, true);

	return (
		<div
			className="fixed inset-0 z-[1200] flex items-stretch justify-center p-0 sm:items-center sm:p-4"
			aria-busy={busy ? 'true' : undefined}
		>
			<button
				type="button"
				className="absolute inset-0 bg-black/60"
				aria-label={t('adminEnsemblePlan.closeEditor')}
				onClick={onClose}
			/>
			<div
				ref={editorDialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="dac-blueprint-editor-title"
				tabIndex={-1}
				className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col rounded-none border border-white/15 bg-[#0a0520] shadow-2xl outline-none sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl"
			>
				<div className="shrink-0 border-b border-white/10 px-5 py-4">
					<h3
						id="dac-blueprint-editor-title"
						className={`${DESKTOP_TYPOGRAPHY.subtitle} text-white/95`}
					>
						{editing
							? t('adminEnsemblePlan.editDraft', {
									id: editing.template_id,
								})
							: t('adminEnsemblePlan.newDraft')}
					</h3>
					<p className={`${DESKTOP_TYPOGRAPHY.meta} mt-1 text-white/50`}>
						{t('adminEnsemblePlan.editorIntro')}
					</p>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
					<div className="grid gap-3 sm:grid-cols-2">
						<label className="flex flex-col gap-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminEnsemblePlan.dbTitleLabel')}
							</span>
							<input
								className="rounded border border-white/15 bg-slate-950 px-2 py-1.5 text-sm"
								value={formTitle}
								disabled={busy}
								onChange={(e) => onFormTitleChange(e.target.value)}
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminEnsemblePlan.keywordsLabel')}
							</span>
							<input
								className="rounded border border-white/15 bg-slate-950 px-2 py-1.5 text-sm"
								value={formKeywords}
								disabled={busy}
								onChange={(e) => onFormKeywordsChange(e.target.value)}
							/>
						</label>
						<label className="flex flex-col gap-1 sm:col-span-2">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminEnsemblePlan.descriptionLabel')}
							</span>
							<input
								className="rounded border border-white/15 bg-slate-950 px-2 py-1.5 text-sm"
								value={formDesc}
								disabled={busy}
								onChange={(e) => onFormDescChange(e.target.value)}
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminEnsemblePlan.colSort')}
							</span>
							<input
								type="number"
								className="rounded border border-white/15 bg-slate-950 px-2 py-1.5 text-sm w-28"
								value={formSort}
								disabled={busy}
								onChange={(e) => onFormSortChange(Number(e.target.value) || 0)}
							/>
						</label>
						<label className="flex items-center gap-2 mt-6">
							<input
								type="checkbox"
								checked={formActive}
								disabled={busy}
								onChange={(e) => onFormActiveChange(e.target.checked)}
							/>
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminEnsemblePlan.activeLabel')}
							</span>
						</label>
					</div>

					<DesktopEnsemblePlanFormEditor
						templateId={editing ? editing.template_id : createTemplateId}
						templateIdLocked={Boolean(editing)}
						onTemplateIdChange={onCreateTemplateIdChange}
						state={planState}
						onStateChange={onPlanStateChange}
						tab={editorTab}
						onTabChange={onEditorTabChange}
						jsonText={jsonText}
						onJsonTextChange={onJsonTextChange}
						validationHint={validationHint ?? validationMessage}
						onValidationHint={(hint) => {
							onValidationHint(hint);
							if (!hint) {
								onClearValidation();
							}
						}}
					/>

					{validationRawJson ? (
						<details className="rounded border border-amber-500/25 bg-amber-950/15 px-3 py-2">
							<summary
								className={`${DESKTOP_TYPOGRAPHY.caption} cursor-pointer text-amber-200/80`}
							>
								{t('adminEnsemblePlan.rawValidationDetails')}
							</summary>
							<pre className="mt-2 max-h-40 overflow-auto font-mono text-xs text-amber-100/80">
								{validationRawJson}
							</pre>
						</details>
					) : null}
				</div>

				<div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-white/10 bg-[#0a0520]/95 px-5 py-3 backdrop-blur-sm">
					<button
						type="button"
						onClick={onSave}
						disabled={busy}
						aria-busy={actionState === 'saving' ? 'true' : undefined}
						className="inline-flex items-center gap-1 rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm text-white disabled:opacity-50"
					>
						<ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
						{actionState === 'saving'
							? t('adminAiChat.saving')
							: t('adminEnsemblePlan.save')}
					</button>
					<button
						type="button"
						onClick={onValidate}
						disabled={busy}
						aria-busy={actionState === 'validating' ? 'true' : undefined}
						className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50"
					>
						{actionState === 'validating'
							? t('adminEnsemblePlan.validating')
							: t('adminEnsemblePlan.validateApi')}
					</button>
					<button
						type="button"
						onClick={onClose}
						disabled={busy}
						className="rounded-lg border border-white/15 px-3 py-1.5 text-sm"
					>
						{t('adminEnsemblePlan.closeEditor')}
					</button>
				</div>
			</div>
		</div>
	);
}
