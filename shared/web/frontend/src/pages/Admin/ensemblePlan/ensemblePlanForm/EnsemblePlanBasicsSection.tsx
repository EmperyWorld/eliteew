/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Basics card for ensemble plan drafts (schema/version/title/description/limits).
 *
 * Invariants:
 * - Must render under EnsemblePlanEditorI18nProvider.
 *
 * Related:
 * - `../DesktopEnsemblePlanFormEditor.tsx`
 * - `../ensemblePlanFormState.ts`
 */

import { SparklesIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../../Desktop/constants';
import type { EnsemblePlanFormState } from '../ensemblePlanFormState';
import { CARD, INPUT } from './editorShared';
import { useEditorT } from './editorI18n';

export type EnsemblePlanBasicsSectionProps = {
	state: EnsemblePlanFormState;
	onStateChange: (next: EnsemblePlanFormState) => void;
};

export function EnsemblePlanBasicsSection({
	state,
	onStateChange,
}: EnsemblePlanBasicsSectionProps): React.ReactElement {
	const t = useEditorT();

	return (
		<section id="plan-editor-basics" className={CARD}>
			<h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
				<SparklesIcon className="h-4 w-4 text-amber-200/90" />
				{t('adminEnsemblePlan.editor.mainDescriptionTitle')}
			</h3>
			<div className="grid gap-3 sm:grid-cols-2">
				<label className="flex flex-col gap-1">
					<span className={DESKTOP_TYPOGRAPHY.caption}>schema_version</span>
					<input
						type="number"
						className={INPUT}
						value={state.schema_version}
						onChange={(e) =>
							onStateChange({
								...state,
								schema_version: Number(e.target.value) || 1,
							})
						}
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className={DESKTOP_TYPOGRAPHY.caption}>version</span>
					<input
						type="number"
						className={INPUT}
						value={state.version}
						onChange={(e) =>
							onStateChange({
								...state,
								version: Math.max(1, Math.trunc(Number(e.target.value) || 1)),
							})
						}
					/>
				</label>
				<label className="flex flex-col gap-1 sm:col-span-2">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('adminEnsemblePlan.editor.planNameLabel')}
					</span>
					<input
						className={INPUT}
						value={state.title}
						onChange={(e) => onStateChange({ ...state, title: e.target.value })}
						placeholder={t('adminEnsemblePlan.editor.planNamePlaceholder')}
					/>
				</label>
				<label className="flex flex-col gap-1 sm:col-span-2">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('adminEnsemblePlan.editor.shortDescLabel')}
					</span>
					<textarea
						className={`${INPUT} min-h-[72px]`}
						value={state.description}
						onChange={(e) =>
							onStateChange({ ...state, description: e.target.value })
						}
						placeholder={t('adminEnsemblePlan.editor.shortDescPlaceholder')}
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('adminEnsemblePlan.editor.maxStepsLabel')}
					</span>
					<span className={`${DESKTOP_TYPOGRAPHY.meta} text-white/40`}>
						1–10
					</span>
					<input
						type="number"
						min={1}
						max={10}
						className={INPUT}
						value={state.max_steps_per_hero}
						onChange={(e) => {
							const n = Math.min(
								10,
								Math.max(1, Math.trunc(Number(e.target.value) || 1))
							);
							onStateChange({ ...state, max_steps_per_hero: n });
						}}
					/>
				</label>
				<label className="flex items-center gap-3 sm:col-span-1 sm:mt-10">
					<input
						type="checkbox"
						className="h-4 w-4 rounded border-white/20"
						checked={state.allow_mermaid}
						onChange={(e) =>
							onStateChange({
								...state,
								allow_mermaid: e.target.checked,
							})
						}
					/>
					<div>
						<div className="text-sm text-white/85">
							{t('adminEnsemblePlan.editor.allowMermaidLabel')}
						</div>
						<div className={`${DESKTOP_TYPOGRAPHY.meta} text-white/45`}>
							{t('adminEnsemblePlan.editor.allowMermaidHint')}
						</div>
					</div>
				</label>
			</div>
		</section>
	);
}
