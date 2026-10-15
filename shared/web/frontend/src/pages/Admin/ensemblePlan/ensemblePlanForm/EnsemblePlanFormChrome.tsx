/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared chrome for ensemble plan form editor: how-it-works, section jump, tabs,
 * JSON sync actions, template slug, validation alerts, status strip.
 *
 * Invariants:
 * - Validation alerts use aria-live="assertive".
 * - Must render under EnsemblePlanEditorI18nProvider (except uses passed `t` for errors).
 *
 * Related:
 * - `../DesktopEnsemblePlanFormEditor.tsx`
 * - `../ensemblePlanFormErrorI18n.ts`
 */

import {
	CodeBracketIcon,
	InformationCircleIcon,
	ListBulletIcon,
	NumberedListIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../../Desktop/constants';
import { ADMIN_SHELL_INPUT_MONO } from '../../shell/adminFormClasses';
import type { EnsemblePlanFormState } from '../ensemblePlanFormState';
import { translateEnsemblePlanFormError } from '../ensemblePlanFormErrorI18n';
import {
	BTN_SECONDARY,
	HINT_BOX,
	SECTION_NAV_BTN,
	scrollToSection,
	type EnsemblePlanEditorTab,
} from './editorShared';
import { useEditorT } from './editorI18n';

export type EnsemblePlanFormChromeProps = {
	state: EnsemblePlanFormState;
	tab: EnsemblePlanEditorTab;
	onTabSwitch: (next: EnsemblePlanEditorTab) => void;
	templateId: string;
	onTemplateIdChange?: (id: string) => void;
	templateIdLocked?: boolean;
	validationHint: string | null;
	localErr: string | null;
	outlineOk: boolean;
	onPushFormToJson: () => void;
	onApplyJsonToBuilder: () => void;
};

export function EnsemblePlanFormChrome({
	state,
	tab,
	onTabSwitch,
	templateId,
	onTemplateIdChange,
	templateIdLocked = false,
	validationHint,
	localErr,
	outlineOk,
	onPushFormToJson,
	onApplyJsonToBuilder,
}: EnsemblePlanFormChromeProps): React.ReactElement {
	const t = useEditorT();

	return (
		<>
			<div className={`${HINT_BOX} flex gap-2`} role="note">
				<InformationCircleIcon
					className="h-4 w-4 shrink-0 text-sky-300/80 mt-0.5"
					aria-hidden
				/>
				<div>{t('adminEnsemblePlan.editor.howItWorks')}</div>
			</div>

			<div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-2">
				<span className={`${DESKTOP_TYPOGRAPHY.caption} mr-1 text-white/45`}>
					{t('adminEnsemblePlan.editor.jumpTo')}
				</span>
				<button
					type="button"
					className={`${SECTION_NAV_BTN} border-white/12 bg-white/5 text-white/80 hover:bg-white/10`}
					onClick={() => scrollToSection('plan-editor-basics')}
				>
					<SparklesIcon className="h-3.5 w-3.5 text-amber-200/80" />
					{t('adminEnsemblePlan.editor.mainTab')}
				</button>
				<button
					type="button"
					className={`${SECTION_NAV_BTN} border-white/12 bg-white/5 text-white/80 hover:bg-white/10`}
					onClick={() => scrollToSection('plan-editor-steps')}
				>
					<NumberedListIcon className="h-3.5 w-3.5 text-violet-300/90" />
					{t('adminEnsemblePlan.editor.stepsTab', {
						count: state.steps.length,
					})}
				</button>
				<button
					type="button"
					className={`${SECTION_NAV_BTN} border-white/12 bg-white/5 text-white/80 hover:bg-white/10`}
					onClick={() => scrollToSection('plan-editor-outline')}
				>
					<ListBulletIcon className="h-3.5 w-3.5 text-emerald-300/90" />
					{t('adminEnsemblePlan.editor.outlineTab', {
						count: state.outline.length,
					})}
				</button>
				<button
					type="button"
					className={`${SECTION_NAV_BTN} border-white/12 bg-white/5 text-white/80 hover:bg-white/10`}
					onClick={() => scrollToSection('plan-editor-advanced')}
				>
					{t('adminEnsemblePlan.editor.moreSections')}
				</button>
			</div>

			<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => onTabSwitch('form')}
						className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
							tab === 'form'
								? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
								: 'border border-white/15 text-white/80 hover:bg-white/5'
						}`}
					>
						{t('adminEnsemblePlan.editor.builderTab')}
					</button>
					<button
						type="button"
						onClick={() => onTabSwitch('json')}
						className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
							tab === 'json'
								? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
								: 'border border-white/15 text-white/80 hover:bg-white/5'
						}`}
					>
						<CodeBracketIcon className="h-4 w-4 opacity-90" />
						{t('adminEnsemblePlan.editor.rawJsonTab')}
					</button>
				</div>
				<p
					className={`${DESKTOP_TYPOGRAPHY.meta} max-w-xl text-white/50 sm:pt-2`}
				>
					{tab === 'form'
						? t('adminEnsemblePlan.editor.formSyncHint')
						: t('adminEnsemblePlan.editor.jsonPasteHint')}
				</p>
			</div>

			<div className="flex flex-wrap gap-2">
				{tab === 'json' ? (
					<button
						type="button"
						className={`${BTN_SECONDARY} border-violet-400/30 bg-violet-950/30`}
						onClick={onApplyJsonToBuilder}
					>
						{t('adminEnsemblePlan.editor.applyJsonToBuilder')}
					</button>
				) : (
					<button
						type="button"
						className={BTN_SECONDARY}
						onClick={onPushFormToJson}
					>
						{t('adminEnsemblePlan.editor.openStateInJson')}
					</button>
				)}
			</div>

			{templateIdLocked ? null : (
				<label className="flex max-w-md flex-col gap-1">
					<span className={`${DESKTOP_TYPOGRAPHY.caption} text-white/80`}>
						{t('adminEnsemblePlan.editor.templateSlugLabel')}
					</span>
					<span className={`${DESKTOP_TYPOGRAPHY.meta} text-white/45`}>
						{t('adminEnsemblePlan.editor.templateSlugHint')}
					</span>
					<input
						className={`${ADMIN_SHELL_INPUT_MONO} text-xs`}
						value={templateId}
						onChange={(e) => onTemplateIdChange?.(e.target.value)}
						placeholder={t('adminEnsemblePlan.editor.templateSlugPlaceholder')}
					/>
				</label>
			)}

			{validationHint ? (
				<div
					className="rounded-lg border border-amber-400/35 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/90"
					role="alert"
					aria-live="assertive"
				>
					{validationHint}
				</div>
			) : null}
			{localErr && tab === 'form' ? (
				<div
					className="rounded-lg border border-orange-400/35 bg-orange-950/20 px-3 py-2 text-sm text-orange-100/90"
					role="alert"
					aria-live="assertive"
				>
					{translateEnsemblePlanFormError(localErr, t)}
				</div>
			) : null}

			{tab === 'form' ? (
				<div className="flex flex-wrap gap-3 text-xs text-white/50">
					<span
						className={
							state.steps.length > 0 ? 'text-emerald-300/90' : 'text-white/40'
						}
					>
						{t('adminEnsemblePlan.editor.stepsCountLine', {
							ok:
								state.steps.length > 0
									? t('adminEnsemblePlan.editor.checkMark')
									: t('adminEnsemblePlan.editor.pendingMark'),
							count: state.steps.length,
						})}
					</span>
					<span className="text-white/25">|</span>
					<span className={outlineOk ? 'text-emerald-300/90' : 'text-white/40'}>
						{t('adminEnsemblePlan.editor.outlineOkLine', {
							ok: outlineOk
								? t('adminEnsemblePlan.editor.checkMark')
								: t('adminEnsemblePlan.editor.pendingMark'),
						})}
					</span>
					<span className="text-white/25">|</span>
					<span className={state.allow_mermaid ? 'text-sky-300/80' : ''}>
						{t('adminEnsemblePlan.editor.mermaidLine', {
							value: state.allow_mermaid
								? t('adminEnsemblePlan.editor.yes')
								: t('adminEnsemblePlan.editor.no'),
						})}
					</span>
				</div>
			) : null}
		</>
	);
}
