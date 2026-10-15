/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Document outline card for ensemble plan drafts (sections, step links, subsections).
 *
 * Invariants:
 * - Must render under EnsemblePlanEditorI18nProvider.
 *
 * Related:
 * - `../DesktopEnsemblePlanFormEditor.tsx`
 * - `../ensemblePlanFormState.ts`
 */

import {
	ChevronRightIcon,
	ListBulletIcon,
	PlusIcon,
	SparklesIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import {
	DesktopNativeSelect,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
} from '../../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../../Desktop/constants';
import type {
	EnsemblePlanFormState,
	PlanOutlineSectionRow,
	PlanOutlineSubRow,
} from '../ensemblePlanFormState';
import {
	emptyOutlineSection,
	emptyOutlineSubrow,
} from '../ensemblePlanFormState';
import { BTN_ICON, BTN_SECONDARY, CARD, INPUT } from './editorShared';
import { useEditorT } from './editorI18n';

function OutlineSectionEditor({
	sec,
	stepIdOptions,
	onChange,
	onRemove,
	sectionIndex,
}: {
	sec: PlanOutlineSectionRow;
	stepIdOptions: string[];
	onChange: (next: PlanOutlineSectionRow) => void;
	onRemove: () => void;
	sectionIndex: number;
}) {
	const t = useEditorT();
	const toggleStep = (sid: string) => {
		const set = new Set(sec.step_ids);
		if (set.has(sid)) set.delete(sid);
		else set.add(sid);
		onChange({ ...sec, step_ids: [...set] });
	};

	const updateSub = (idx: number, next: PlanOutlineSubRow) => {
		const subs = [...sec.subsections];
		subs[idx] = next;
		onChange({ ...sec, subsections: subs });
	};

	const removeSub = (idx: number) => {
		onChange({
			...sec,
			subsections: sec.subsections.filter((_, j) => j !== idx),
		});
	};

	return (
		<div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3 space-y-3">
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
					{t('adminEnsemblePlan.editor.sectionN', { n: sectionIndex + 1 })}
				</span>
				<button
					type="button"
					className={`${BTN_ICON} text-red-300/80`}
					onClick={onRemove}
					aria-label={t('adminEnsemblePlan.editor.deleteSectionAria')}
				>
					<TrashIcon className="h-4 w-4" />
				</button>
			</div>
			<div className="flex flex-wrap gap-2 items-end">
				<label className="flex flex-col gap-1 flex-1 min-w-[160px]">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('adminEnsemblePlan.editor.docHeadingLabel')}
					</span>
					<input
						className={INPUT}
						value={sec.heading}
						onChange={(e) => onChange({ ...sec, heading: e.target.value })}
						placeholder={t('adminEnsemblePlan.editor.docHeadingPlaceholder')}
					/>
				</label>
				<label className="flex flex-col gap-1 w-44">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('adminEnsemblePlan.editor.internalIdLabel')}
					</span>
					<span className={`${DESKTOP_TYPOGRAPHY.meta} text-white/35`}>
						{t('adminEnsemblePlan.editor.internalIdOptional')}
					</span>
					<input
						className={`${INPUT} font-mono text-xs`}
						value={sec.section_id}
						onChange={(e) => onChange({ ...sec, section_id: e.target.value })}
						placeholder={t('adminEnsemblePlan.editor.internalIdPlaceholder')}
					/>
				</label>
			</div>
			<div>
				<div className={`${DESKTOP_TYPOGRAPHY.caption} mb-2 text-white/65`}>
					{t('adminEnsemblePlan.editor.whichStepsLabel')}
				</div>
				{stepIdOptions.length === 0 ? (
					<p className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminEnsemblePlan.editor.defineStepsFirst')}
					</p>
				) : (
					<div className="flex flex-wrap gap-2">
						{stepIdOptions.map((sid) => (
							<label
								key={sid}
								className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-black/35 px-2.5 py-1.5 text-xs transition-colors hover:border-white/20"
							>
								<input
									type="checkbox"
									className="rounded border-white/20"
									checked={sec.step_ids.includes(sid)}
									onChange={() => toggleStep(sid)}
								/>
								<span className="font-mono text-emerald-200/90">{sid}</span>
							</label>
						))}
					</div>
				)}
			</div>
			<details className="group/sub rounded-lg border border-white/10 bg-black/20 open:bg-black/30">
				<summary className="cursor-pointer list-none px-2 py-2 text-xs text-white/60 [&::-webkit-details-marker]:hidden">
					<span className="inline-flex items-center gap-1">
						<ChevronRightIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-open/sub:rotate-90" />
						{t('adminEnsemblePlan.editor.subsectionsLabel')}
					</span>
				</summary>
				<div className="space-y-2 border-t border-white/10 p-2">
					<p className={`${DESKTOP_TYPOGRAPHY.meta} text-white/45 px-1`}>
						{t('adminEnsemblePlan.editor.subsectionsHint')}
					</p>
					{sec.subsections.map((sub, idx) => (
						<div key={sub.uiKey} className="flex flex-wrap gap-2 items-end">
							<input
								className={`${INPUT} min-w-[120px] flex-1`}
								placeholder={t(
									'adminEnsemblePlan.editor.subheadingPlaceholder'
								)}
								value={sub.heading}
								onChange={(e) =>
									updateSub(idx, { ...sub, heading: e.target.value })
								}
							/>
							<div className="w-44 shrink-0">
								<DesktopNativeSelect
									className="font-mono text-xs"
									value={sub.step_id}
									onChange={(e) =>
										updateSub(idx, { ...sub, step_id: e.target.value })
									}
									aria-label={t('adminEnsemblePlan.editor.stepForSubAria')}
								>
									<option
										className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										value=""
									>
										{t('adminEnsemblePlan.editor.stepForSubPlaceholder')}
									</option>
									{stepIdOptions.map((sid) => (
										<option
											key={sid}
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											value={sid}
										>
											{sid}
										</option>
									))}
								</DesktopNativeSelect>
							</div>
							<button
								type="button"
								className={BTN_ICON}
								onClick={() => removeSub(idx)}
								aria-label={t('adminEnsemblePlan.editor.deleteSubAria')}
							>
								<TrashIcon className="h-3.5 w-3.5" />
							</button>
						</div>
					))}
					<button
						type="button"
						className={BTN_SECONDARY}
						onClick={() =>
							onChange({
								...sec,
								subsections: [...sec.subsections, emptyOutlineSubrow()],
							})
						}
					>
						<PlusIcon className="h-3.5 w-3.5" />
						{t('adminEnsemblePlan.editor.addSubsection')}
					</button>
				</div>
			</details>
		</div>
	);
}

export type EnsemblePlanOutlineSectionProps = {
	state: EnsemblePlanFormState;
	stepIdOptions: string[];
	onStateChange: (next: EnsemblePlanFormState) => void;
	onBuildFromSteps: () => void;
};

export function EnsemblePlanOutlineSection({
	state,
	stepIdOptions,
	onStateChange,
	onBuildFromSteps,
}: EnsemblePlanOutlineSectionProps): React.ReactElement {
	const t = useEditorT();

	return (
		<section id="plan-editor-outline" className={CARD}>
			<div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
						<ListBulletIcon className="h-4 w-4 text-emerald-300/95" />
						{t('adminEnsemblePlan.editor.docOutlineTitle')}
					</h3>
					<p
						className={`${DESKTOP_TYPOGRAPHY.meta} mt-1 max-w-xl text-white/45`}
					>
						{t('adminEnsemblePlan.editor.outlineHint')}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-900/50"
						onClick={onBuildFromSteps}
						title={t('adminEnsemblePlan.editor.buildFromStepsTitle')}
					>
						<SparklesIcon className="h-3.5 w-3.5" />
						{t('adminEnsemblePlan.editor.buildFromSteps')}
					</button>
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/85 hover:bg-white/5"
						onClick={() =>
							onStateChange({
								...state,
								outline: [...state.outline, emptyOutlineSection()],
							})
						}
					>
						<PlusIcon className="h-3.5 w-3.5" />
						{t('adminEnsemblePlan.editor.emptySection')}
					</button>
				</div>
			</div>
			<div className="space-y-3">
				{state.outline.map((sec, idx) => (
					<OutlineSectionEditor
						key={sec.uiKey}
						sec={sec}
						sectionIndex={idx}
						stepIdOptions={stepIdOptions}
						onChange={(next) => {
							const outline = [...state.outline];
							outline[idx] = next;
							onStateChange({ ...state, outline });
						}}
						onRemove={() => {
							onStateChange({
								...state,
								outline: state.outline.filter((_, j) => j !== idx),
							});
						}}
					/>
				))}
			</div>
			{state.outline.length === 0 ? (
				<p className={`${DESKTOP_TYPOGRAPHY.meta} mt-3 text-white/40`}>
					{t('adminEnsemblePlan.editor.outlineEmptyHint')}
				</p>
			) : null}
		</section>
	);
}
