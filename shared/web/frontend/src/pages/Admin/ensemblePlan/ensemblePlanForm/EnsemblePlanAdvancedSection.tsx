/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Advanced card for ensemble plan drafts (global required_slots axes).
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
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../../Desktop/constants';
import type {
	EnsemblePlanFormState,
	PlanSlotRow,
} from '../ensemblePlanFormState';
import { newEmptySlotRow } from '../ensemblePlanFormState';
import { BTN_ICON, BTN_SECONDARY, CARD, INPUT } from './editorShared';
import { useEditorT } from './editorI18n';

function GlobalSlotsEditor({
	rows,
	onChange,
}: {
	rows: PlanSlotRow[];
	onChange: (rows: PlanSlotRow[]) => void;
}) {
	const t = useEditorT();
	return (
		<div className="space-y-2">
			<div className="text-sm font-medium text-white/85">
				{t('adminEnsemblePlan.editor.globalSlotsTitle')}
			</div>
			<p className={`${DESKTOP_TYPOGRAPHY.meta} text-white/50`}>
				{t('adminEnsemblePlan.editor.globalSlotsHint')}
			</p>
			{rows.map((row, i) => (
				<div key={row.uiKey} className="flex gap-2 items-center">
					<input
						className={`${INPUT} flex-1 font-mono text-xs`}
						value={row.key}
						onChange={(e) => {
							const next = [...rows];
							next[i] = { ...row, key: e.target.value };
							onChange(next);
						}}
					/>
					<input
						type="number"
						className={`${INPUT} w-24`}
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
						aria-label={t('adminEnsemblePlan.editor.deleteAria')}
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
				{t('adminEnsemblePlan.editor.add')}
			</button>
		</div>
	);
}

export type EnsemblePlanAdvancedSectionProps = {
	state: EnsemblePlanFormState;
	onStateChange: (next: EnsemblePlanFormState) => void;
};

export function EnsemblePlanAdvancedSection({
	state,
	onStateChange,
}: EnsemblePlanAdvancedSectionProps): React.ReactElement {
	const t = useEditorT();

	return (
		<section id="plan-editor-advanced" className={CARD}>
			<details className="group/adv">
				<summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-white/85 [&::-webkit-details-marker]:hidden">
					<ChevronRightIcon className="h-4 w-4 text-white/45 transition-transform group-open/adv:rotate-90" />
					{t('adminEnsemblePlan.editor.advancedTitle')}
				</summary>
				<div className="mt-4 border-t border-white/10 pt-4">
					<GlobalSlotsEditor
						rows={state.slots}
						onChange={(slots) => onStateChange({ ...state, slots })}
					/>
				</div>
			</details>
		</section>
	);
}
