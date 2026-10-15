/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Steps card for ensemble plan drafts — DnD reorder, step fields, required slots.
 *
 * Invariants:
 * - Must render under EnsemblePlanEditorI18nProvider.
 * - Drag handle aria labels use adminEnsemblePlan.editor.dragStepAria / Title.
 *
 * Related:
 * - `../DesktopEnsemblePlanFormEditor.tsx`
 * - `../ensemblePlanFormState.ts`
 */

import {
	DndContext,
	closestCenter,
	type DragEndEvent,
	type SensorDescriptor,
	type SensorOptions,
} from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
	Bars2Icon,
	ChevronDownIcon,
	ChevronRightIcon,
	ChevronUpIcon,
	NumberedListIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../../Desktop/constants';
import type {
	EnsemblePlanFormState,
	PlanSlotRow,
	PlanStepRow,
} from '../ensemblePlanFormState';
import { newEmptySlotRow } from '../ensemblePlanFormState';
import { BTN_ICON, BTN_SECONDARY, CARD, INPUT } from './editorShared';
import { useEditorT } from './editorI18n';

function SortableStepShell({
	id,
	stepIndex,
	children,
}: {
	id: string;
	stepIndex: number;
	children: React.ReactNode;
}) {
	const t = useEditorT();
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`rounded-xl border border-white/10 bg-black/40 ${
				isDragging ? 'z-10 opacity-95 ring-2 ring-violet-400/40' : ''
			}`}
		>
			<div className="flex gap-0 sm:gap-1">
				<button
					type="button"
					className="mt-2 sm:mt-3 shrink-0 cursor-grab touch-none self-start rounded-l-lg border-r border-white/10 px-2 py-3 text-white/40 hover:bg-white/5 hover:text-white/65"
					aria-label={t('adminEnsemblePlan.editor.dragStepAria', {
						n: stepIndex + 1,
					})}
					title={t('adminEnsemblePlan.editor.dragStepTitle')}
					{...attributes}
					{...listeners}
				>
					<Bars2Icon className="h-5 w-5" />
				</button>
				<div className="min-w-0 flex-1 p-3 pl-2">{children}</div>
			</div>
		</div>
	);
}

function RequiredSlotsEditor({
	rows,
	onChange,
}: {
	rows: PlanSlotRow[];
	onChange: (rows: PlanSlotRow[]) => void;
}) {
	const t = useEditorT();
	return (
		<div className="rounded-lg border border-white/10 bg-black/25 p-3 space-y-2">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<div className={`${DESKTOP_TYPOGRAPHY.caption} text-white/70`}>
					{t('adminEnsemblePlan.editor.slotsLabel')}
				</div>
				<span className={`${DESKTOP_TYPOGRAPHY.meta} text-white/40`}>
					{t('adminEnsemblePlan.editor.slotsHint')}
				</span>
			</div>
			{rows.length === 0 ? (
				<p className={`${DESKTOP_TYPOGRAPHY.meta} text-white/45`}>
					{t('adminEnsemblePlan.editor.slotsEmptyHint')}
				</p>
			) : null}
			{rows.map((row, i) => (
				<div key={row.uiKey} className="flex gap-2 items-center">
					<input
						className={`${INPUT} flex-1 font-mono text-xs`}
						placeholder={t('adminEnsemblePlan.editor.slotPlaceholder')}
						value={row.key}
						onChange={(e) => {
							const next = [...rows];
							next[i] = { ...row, key: e.target.value };
							onChange(next);
						}}
					/>
					<input
						type="number"
						className={`${INPUT} w-20`}
						title={t('adminEnsemblePlan.editor.slotWeightTitle')}
						value={row.value}
						onChange={(e) => {
							const next = [...rows];
							next[i] = { ...row, value: Number(e.target.value) || 0 };
							onChange(next);
						}}
					/>
					<button
						type="button"
						className={BTN_ICON}
						onClick={() => onChange(rows.filter((_, j) => j !== i))}
						aria-label={t('adminEnsemblePlan.editor.deleteSlotAria')}
					>
						<TrashIcon className="h-3.5 w-3.5" />
					</button>
				</div>
			))}
			<button
				type="button"
				className={BTN_SECONDARY}
				onClick={() => onChange([...rows, newEmptySlotRow()])}
			>
				<PlusIcon className="h-3.5 w-3.5" />
				{t('adminEnsemblePlan.editor.addAxis')}
			</button>
		</div>
	);
}

function StepEditor({
	step,
	stepNumber,
	onChange,
	onRemove,
	onMove,
	canUp,
	canDown,
	onStepIdCommit,
}: {
	step: PlanStepRow;
	stepNumber: number;
	onChange: (next: PlanStepRow) => void;
	onRemove: () => void;
	onMove: (dir: -1 | 1) => void;
	canUp: boolean;
	canDown: boolean;
	onStepIdCommit: (oldId: string, newId: string) => void;
}) {
	const t = useEditorT();
	const [sidDraft, setSidDraft] = React.useState(step.step_id);

	React.useEffect(() => {
		setSidDraft(step.step_id);
	}, [step.step_id]);

	const previewTitle =
		step.title.trim() || t('adminEnsemblePlan.editor.untitledStep');

	return (
		<details className="group/step open:pb-0" open={stepNumber <= 1}>
			<summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 pr-1 text-left [&::-webkit-details-marker]:hidden">
				<ChevronRightIcon className="h-4 w-4 shrink-0 text-white/45 transition-transform group-open/step:rotate-90" />
				<span className="inline-flex items-center gap-2 text-sm font-medium text-white/90">
					<span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-violet-600/35 px-1.5 font-mono text-[11px] text-violet-100">
						{stepNumber}
					</span>
					<span className="font-mono text-xs text-violet-200/90">
						{step.step_id || '—'}
					</span>
					<span className="text-white/50">—</span>
					<span className="truncate font-normal text-white/75">
						{previewTitle}
					</span>
				</span>
			</summary>
			<div className="space-y-3 border-t border-white/10 pt-3 mt-2">
				<div className="flex flex-wrap gap-2 items-end">
					<label className="flex flex-col gap-1 w-36">
						<span className={DESKTOP_TYPOGRAPHY.caption}>
							{t('adminEnsemblePlan.editor.stepIdLabel')}
						</span>
						<span
							className={`${DESKTOP_TYPOGRAPHY.meta} text-white/40 -mt-0.5 mb-0.5`}
						>
							{t('adminEnsemblePlan.editor.stepIdHint')}
						</span>
						<input
							className={`${INPUT} font-mono text-xs`}
							value={sidDraft}
							onChange={(e) => setSidDraft(e.target.value)}
							onBlur={() => {
								const o = step.step_id.trim();
								const n = sidDraft.trim();
								if (n && n !== o) onStepIdCommit(o, n);
							}}
						/>
					</label>
					<label className="flex flex-col gap-1 min-w-[200px] flex-1">
						<span className={DESKTOP_TYPOGRAPHY.caption}>
							{t('adminEnsemblePlan.editor.shortTitleLabel')}
						</span>
						<span
							className={`${DESKTOP_TYPOGRAPHY.meta} text-white/40 -mt-0.5 mb-0.5`}
						>
							{t('adminEnsemblePlan.editor.shortTitleHint')}
						</span>
						<input
							className={INPUT}
							value={step.title}
							onChange={(e) => onChange({ ...step, title: e.target.value })}
							placeholder={t('adminEnsemblePlan.editor.shortTitlePlaceholder')}
						/>
					</label>
					<div className="flex gap-1 pb-0.5">
						<button
							type="button"
							className={BTN_ICON}
							disabled={!canUp}
							onClick={() => onMove(-1)}
							aria-label={t('adminEnsemblePlan.editor.moveUpAria')}
							title={t('adminEnsemblePlan.editor.moveUpTitle')}
						>
							<ChevronUpIcon className="h-4 w-4" />
						</button>
						<button
							type="button"
							className={BTN_ICON}
							disabled={!canDown}
							onClick={() => onMove(1)}
							aria-label={t('adminEnsemblePlan.editor.moveDownAria')}
							title={t('adminEnsemblePlan.editor.moveDownTitle')}
						>
							<ChevronDownIcon className="h-4 w-4" />
						</button>
						<button
							type="button"
							className={`${BTN_ICON} text-red-300/90 border-red-500/35`}
							onClick={onRemove}
							aria-label={t('adminEnsemblePlan.editor.deleteStepAria')}
						>
							<TrashIcon className="h-4 w-4" />
						</button>
					</div>
				</div>
				<label className="block">
					<span className={`${DESKTOP_TYPOGRAPHY.caption} mb-0.5 block`}>
						{t('adminEnsemblePlan.editor.modelInstructionLabel')}
					</span>
					<span
						className={`${DESKTOP_TYPOGRAPHY.meta} text-white/45 mb-1.5 block`}
					>
						{t('adminEnsemblePlan.editor.modelInstructionHint')}
					</span>
					<textarea
						className={`${INPUT} min-h-[160px] font-mono text-xs leading-relaxed`}
						value={step.instruction_for_model}
						onChange={(e) =>
							onChange({ ...step, instruction_for_model: e.target.value })
						}
						placeholder={t(
							'adminEnsemblePlan.editor.modelInstructionPlaceholder'
						)}
					/>
				</label>
				<RequiredSlotsEditor
					rows={step.required_slots}
					onChange={(rows) => onChange({ ...step, required_slots: rows })}
				/>
			</div>
		</details>
	);
}

export type EnsemblePlanStepsSectionProps = {
	state: EnsemblePlanFormState;
	sensors: SensorDescriptor<SensorOptions>[];
	onDragEnd: (event: DragEndEvent) => void;
	onAddStep: () => void;
	onUpdateStep: (idx: number, next: PlanStepRow) => void;
	onRemoveStep: (idx: number) => void;
	onMoveStep: (idx: number, dir: -1 | 1) => void;
	onRenameStepId: (idx: number, oldId: string, newId: string) => void;
};

export function EnsemblePlanStepsSection({
	state,
	sensors,
	onDragEnd,
	onAddStep,
	onUpdateStep,
	onRemoveStep,
	onMoveStep,
	onRenameStepId,
}: EnsemblePlanStepsSectionProps): React.ReactElement {
	const t = useEditorT();
	const stepUiKeys = state.steps.map((s) => s.uiKey);

	return (
		<section id="plan-editor-steps" className={CARD}>
			<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
					<NumberedListIcon className="h-4 w-4 text-violet-300/95" />
					{t('adminEnsemblePlan.editor.generationStepsTitle')}
				</h3>
				<button
					type="button"
					className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
					onClick={onAddStep}
				>
					<PlusIcon className="h-4 w-4" />
					{t('adminEnsemblePlan.editor.addStep')}
				</button>
			</div>
			<p className={`${DESKTOP_TYPOGRAPHY.meta} mb-4 text-white/45`}>
				{t('adminEnsemblePlan.editor.dragOrderHint')}
			</p>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={onDragEnd}
			>
				<SortableContext
					items={stepUiKeys}
					strategy={verticalListSortingStrategy}
				>
					<div className="space-y-3">
						{state.steps.map((st, idx) => (
							<SortableStepShell key={st.uiKey} id={st.uiKey} stepIndex={idx}>
								<StepEditor
									step={st}
									stepNumber={idx + 1}
									onChange={(n) => onUpdateStep(idx, n)}
									onRemove={() => onRemoveStep(idx)}
									onMove={(dir) => onMoveStep(idx, dir)}
									canUp={idx > 0}
									canDown={idx < state.steps.length - 1}
									onStepIdCommit={(o, n) => onRenameStepId(idx, o, n)}
								/>
							</SortableStepShell>
						))}
					</div>
				</SortableContext>
			</DndContext>
			{state.steps.length === 0 ? (
				<div
					className={`mt-4 rounded-lg border border-dashed border-white/15 bg-black/20 px-4 py-8 text-center ${DESKTOP_TYPOGRAPHY.meta}`}
				>
					<p className="mb-2 text-white/70">
						{t('adminEnsemblePlan.editor.noStepsYet')}
					</p>
					<p className="text-white/45">
						{t('adminEnsemblePlan.editor.noStepsHint')}
					</p>
				</div>
			) : null}
		</section>
	);
}
