/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin orchestrator for structured + JSON ensemble PlanTemplate editor (admin System).
 * Section UI lives under `ensemblePlanForm/`; stable import path unchanged.
 *
 * Invariants:
 * - Parent ≤400 LOC; section children ≤500 LOC.
 * - Public export `DesktopEnsemblePlanFormEditor` + props type stay at this path.
 *
 * Related:
 * - `ensemblePlanForm/*`, `ensemblePlanFormState.ts`
 * - `documentation/product/DESKTOP-ENSEMBLE-PLAN-AUTHORING.md`
 */

import {
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type {
	EnsemblePlanFormState,
	PlanStepRow,
} from './ensemblePlanFormState';
import {
	formStateToPlanBody,
	newEmptyStepRow,
	outlineOneSectionPerStep,
	parsePlanBodyToForm,
	renameStepIdInState,
	validateStepIdsUnique,
} from './ensemblePlanFormState';
import { translateEnsemblePlanParseFailure } from './ensemblePlanFormErrorI18n';
import { EnsemblePlanAdvancedSection } from './ensemblePlanForm/EnsemblePlanAdvancedSection';
import { EnsemblePlanBasicsSection } from './ensemblePlanForm/EnsemblePlanBasicsSection';
import { EnsemblePlanFormChrome } from './ensemblePlanForm/EnsemblePlanFormChrome';
import { EnsemblePlanJsonPanel } from './ensemblePlanForm/EnsemblePlanJsonPanel';
import { EnsemblePlanOutlineSection } from './ensemblePlanForm/EnsemblePlanOutlineSection';
import { EnsemblePlanStepsSection } from './ensemblePlanForm/EnsemblePlanStepsSection';
import { EnsemblePlanEditorI18nProvider } from './ensemblePlanForm/editorI18n';
import type { EnsemblePlanEditorTab } from './ensemblePlanForm/editorShared';

export type DesktopEnsemblePlanFormEditorProps = {
	templateId: string;
	onTemplateIdChange?: (id: string) => void;
	templateIdLocked?: boolean;
	state: EnsemblePlanFormState;
	onStateChange: (next: EnsemblePlanFormState) => void;
	tab: EnsemblePlanEditorTab;
	onTabChange: (t: EnsemblePlanEditorTab) => void;
	jsonText: string;
	onJsonTextChange: (s: string) => void;
	validationHint: string | null;
	onValidationHint: (s: string | null) => void;
};

export function DesktopEnsemblePlanFormEditor({
	templateId,
	onTemplateIdChange,
	templateIdLocked = false,
	state,
	onStateChange,
	tab,
	onTabChange,
	jsonText,
	onJsonTextChange,
	validationHint,
	onValidationHint,
}: DesktopEnsemblePlanFormEditorProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const stepIdsSorted = state.steps
		.map((s) => s.step_id.trim())
		.filter(Boolean);
	const localErr = validateStepIdsUnique(state);
	const outlineRefsOk =
		state.outline.every((sec) =>
			sec.step_ids.every((id) => stepIdsSorted.includes(id.trim()))
		) &&
		state.outline.every((sec) =>
			sec.subsections.every(
				(sub) =>
					!sub.step_id.trim() || stepIdsSorted.includes(sub.step_id.trim())
			)
		);
	const allStepsMapped =
		state.steps.length === 0 ||
		state.steps.every((s) => {
			const id = s.step_id.trim();
			return !id || state.outline.some((sec) => sec.step_ids.includes(id));
		});
	const outlineOk =
		!localErr &&
		outlineRefsOk &&
		allStepsMapped &&
		(state.steps.length === 0 || state.outline.length > 0);

	const pushFormToJson = React.useCallback(() => {
		const tid = templateId.trim() || 'draft';
		const body = formStateToPlanBody(state, tid);
		onJsonTextChange(JSON.stringify(body, null, 2));
		onValidationHint(null);
	}, [state, templateId, onJsonTextChange, onValidationHint]);

	const pullJsonToForm = React.useCallback(() => {
		let parsed: unknown;
		try {
			parsed = JSON.parse(jsonText) as unknown;
		} catch {
			onValidationHint(t('adminEnsemblePlan.editor.invalidJsonSyntax'));
			return;
		}
		const r = parsePlanBodyToForm(parsed);
		if (!r.ok) {
			onValidationHint(translateEnsemblePlanParseFailure(r, t));
			return;
		}
		onStateChange(r.state);
		onValidationHint(null);
		if (onTemplateIdChange) {
			const id = (parsed as { id?: unknown }).id;
			if (typeof id === 'string' && id.trim()) onTemplateIdChange(id.trim());
		}
	}, [jsonText, onStateChange, onValidationHint, onTemplateIdChange, t]);

	const onTabSwitch = (next: EnsemblePlanEditorTab) => {
		if (next === tab) return;
		if (next === 'json' && tab === 'form') {
			pushFormToJson();
		} else if (next === 'form' && tab === 'json') {
			pullJsonToForm();
		}
		onTabChange(next);
	};

	const handleStepDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const keys = state.steps.map((s) => s.uiKey);
		const oldIndex = keys.indexOf(String(active.id));
		const newIndex = keys.indexOf(String(over.id));
		if (oldIndex < 0 || newIndex < 0) return;
		onStateChange({
			...state,
			steps: arrayMove(state.steps, oldIndex, newIndex),
		});
	};

	const addStep = () => {
		onStateChange({
			...state,
			steps: [...state.steps, newEmptyStepRow(state)],
		});
	};

	const updateStep = (idx: number, next: PlanStepRow) => {
		const steps = [...state.steps];
		steps[idx] = next;
		onStateChange({ ...state, steps });
	};

	const removeStep = (idx: number) => {
		onStateChange({
			...state,
			steps: state.steps.filter((_, j) => j !== idx),
		});
	};

	const moveStep = (idx: number, dir: -1 | 1) => {
		const j = idx + dir;
		if (j < 0 || j >= state.steps.length) return;
		onStateChange({ ...state, steps: arrayMove(state.steps, idx, j) });
	};

	const renameCommitted = (idx: number, oldId: string, newId: string) => {
		const cur = state.steps[idx];
		if (!cur || cur.step_id.trim() !== oldId) return;
		onStateChange(renameStepIdInState(state, oldId, newId));
	};

	const buildOutlineFromSteps = () => {
		if (state.steps.length === 0) {
			onValidationHint(t('adminEnsemblePlan.editor.addStepFirst'));
			return;
		}
		onValidationHint(null);
		onStateChange(outlineOneSectionPerStep(state));
	};

	return (
		<EnsemblePlanEditorI18nProvider t={t}>
			<div className="space-y-4">
				<EnsemblePlanFormChrome
					state={state}
					tab={tab}
					onTabSwitch={onTabSwitch}
					templateId={templateId}
					onTemplateIdChange={onTemplateIdChange}
					templateIdLocked={templateIdLocked}
					validationHint={validationHint}
					localErr={localErr}
					outlineOk={outlineOk}
					onPushFormToJson={pushFormToJson}
					onApplyJsonToBuilder={() => {
						pullJsonToForm();
						onTabChange('form');
					}}
				/>

				{tab === 'form' ? (
					<div className="space-y-6">
						<EnsemblePlanBasicsSection
							state={state}
							onStateChange={onStateChange}
						/>
						<EnsemblePlanStepsSection
							state={state}
							sensors={sensors}
							onDragEnd={handleStepDragEnd}
							onAddStep={addStep}
							onUpdateStep={updateStep}
							onRemoveStep={removeStep}
							onMoveStep={moveStep}
							onRenameStepId={renameCommitted}
						/>
						<EnsemblePlanOutlineSection
							state={state}
							stepIdOptions={stepIdsSorted}
							onStateChange={onStateChange}
							onBuildFromSteps={buildOutlineFromSteps}
						/>
						<EnsemblePlanAdvancedSection
							state={state}
							onStateChange={onStateChange}
						/>
					</div>
				) : (
					<EnsemblePlanJsonPanel
						jsonText={jsonText}
						onJsonTextChange={onJsonTextChange}
					/>
				)}
			</div>
		</EnsemblePlanEditorI18nProvider>
	);
}
