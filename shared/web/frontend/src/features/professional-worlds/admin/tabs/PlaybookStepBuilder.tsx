/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ordered step editor for Professional Worlds admin AI playbooks (action keys, JSON input mapping, stop-on-error).
 *
 * Invariants:
 * - Step order is normalized on each structural change; persisted payload matches backend `AdminProfessionalPlaybookStepUpsert`.
 * - `input_mapping` is always a JSON object in the UI (empty object when blank).
 * - Does not import adminUiShared (Wave 3 New World tab helper).
 *
 * Related:
 * - src/features/professional-worlds/admin/tabs/PlaybooksTab.tsx
 * - shared/api/schemas/professional_worlds.py
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AdminButton, AdminSelect, adminUiFieldClass } from '@/pages/Admin/ui';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { cn } from '@/utils/cn';

import { parseJsonObjectField } from '../adminJsonValidation';
import type { AdminProfessionalPlaybookStep } from '../types';

export type PlaybookActionOption = {
	readonly action_key: string;
	readonly display_name: string;
};

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
	htmlFor,
	children,
}: {
	label: string;
	htmlFor?: string;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-1 text-sm text-[var(--admin-ui-fg-muted)]">
			<label
				htmlFor={htmlFor}
				className="text-[length:var(--admin-ui-text-xs)] text-[var(--admin-ui-fg)]"
			>
				{label}
			</label>
			{children}
		</div>
	);
}

function MappingJsonField({
	label,
	value,
	labelKey,
	onCommit,
}: {
	label: string;
	labelKey: string;
	value: Record<string, unknown>;
	onCommit: (next: Record<string, unknown>) => void;
}) {
	const fieldId = useId();
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setText(JSON.stringify(value ?? {}, null, 2));
		setError(null);
	}, [value]);

	return (
		<FieldBlock label={label} htmlFor={fieldId}>
			<textarea
				id={fieldId}
				rows={4}
				className={cn(adminUiFieldClass, 'font-mono text-xs')}
				value={text}
				onChange={(e) => setText(e.target.value)}
				onBlur={() => {
					try {
						const parsed = parseJsonObjectField(text, labelKey);
						setError(null);
						onCommit(parsed);
					} catch (err) {
						setError(
							err instanceof Error
								? err.message
								: t('admin.playbooks.inputMappingInvalid')
						);
					}
				}}
				spellCheck={false}
			/>
			<p className="text-[11px] leading-relaxed text-[var(--admin-ui-fg-muted)]">
				{t('admin.playbooks.inputMappingHint')}
			</p>
			{error ? (
				<p className="text-[11px] leading-relaxed text-[var(--admin-ui-status-warning)]">
					{error}
				</p>
			) : null}
		</FieldBlock>
	);
}

export type PlaybookStepDraft = AdminProfessionalPlaybookStep;

function normalizeOrders(steps: PlaybookStepDraft[]): PlaybookStepDraft[] {
	return steps.map((step, index) => ({
		...step,
		step_order: index + 1,
	}));
}

export function PlaybookStepBuilder({
	steps,
	availableActions,
	onChange,
}: {
	steps: PlaybookStepDraft[];
	availableActions: PlaybookActionOption[];
	onChange: (next: PlaybookStepDraft[]) => void;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const availableActionKeys = availableActions.map(
		(action) => action.action_key
	);

	function patchStep(index: number, patch: Partial<PlaybookStepDraft>) {
		const copy = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
		onChange(normalizeOrders(copy));
	}

	function removeStep(index: number) {
		onChange(normalizeOrders(steps.filter((_, i) => i !== index)));
	}

	function moveStep(index: number, delta: number) {
		const n = index + delta;
		if (n < 0 || n >= steps.length) {
			return;
		}
		const copy = [...steps];
		const tmp = copy[index] as PlaybookStepDraft;
		copy[index] = copy[n] as PlaybookStepDraft;
		copy[n] = tmp;
		onChange(normalizeOrders(copy));
	}

	function addStep() {
		const firstKey = availableActions[0]?.action_key ?? '';
		onChange(
			normalizeOrders([
				...steps,
				{
					step_order: steps.length + 1,
					action_key: firstKey,
					input_mapping: {},
					stop_on_error: true,
				},
			])
		);
	}

	return (
		<Panel title={t('admin.playbooks.stepBuilderTitle')}>
			<div className="mb-3 flex flex-wrap gap-2">
				<AdminButton
					onClick={addStep}
					disabled={availableActionKeys.length === 0}
				>
					{t('admin.playbooks.addStep')}
				</AdminButton>
				{availableActionKeys.length === 0 && (
					<p className="text-xs text-[var(--admin-ui-status-warning)]">
						{t('admin.playbooks.noActionsHint')}
					</p>
				)}
			</div>

			<div className="grid gap-3">
				{steps.length === 0 && (
					<p className="text-sm text-[var(--admin-ui-fg-muted)]">
						{t('admin.playbooks.stepsEmpty')}
					</p>
				)}
				{steps.map((step, index) => (
					<div
						key={String(step.step_order)}
						className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3"
					>
						<div className="mb-2 flex flex-wrap items-center gap-2">
							<span className="text-xs font-semibold text-[var(--admin-ui-fg)]">
								{t('admin.playbooks.stepLabel', { order: step.step_order })}
							</span>
							<div className="ml-auto flex flex-wrap gap-1">
								<AdminButton
									variant="ghost"
									onClick={() => moveStep(index, -1)}
									aria-label={t('admin.playbooks.moveStepUp', {
										order: step.step_order,
									})}
								>
									{t('admin.playbooks.moveUp')}
								</AdminButton>
								<AdminButton
									variant="ghost"
									onClick={() => moveStep(index, 1)}
									aria-label={t('admin.playbooks.moveStepDown', {
										order: step.step_order,
									})}
								>
									{t('admin.playbooks.moveDown')}
								</AdminButton>
								<AdminButton variant="danger" onClick={() => removeStep(index)}>
									{t('admin.playbooks.removeStep')}
								</AdminButton>
							</div>
						</div>

						<FieldBlock label={t('admin.playbooks.actionKey')}>
							<AdminSelect
								value={step.action_key}
								onChange={(e) =>
									patchStep(index, { action_key: e.target.value })
								}
							>
								{step.action_key &&
									!availableActionKeys.includes(step.action_key) && (
										<option value={step.action_key}>
											{step.action_key} ({t('admin.playbooks.unknownAction')})
										</option>
									)}
								{availableActions.map((action) => (
									<option key={action.action_key} value={action.action_key}>
										{t('admin.playbooks.actionOption', {
											name: action.display_name,
											actionKey: action.action_key,
										})}
									</option>
								))}
							</AdminSelect>
						</FieldBlock>

						<label className="mb-2 mt-2 flex items-center gap-2 text-xs text-[var(--admin-ui-fg-muted)]">
							<input
								type="checkbox"
								checked={step.stop_on_error}
								onChange={(e) =>
									patchStep(index, { stop_on_error: e.target.checked })
								}
							/>
							{t('admin.playbooks.stopOnError')}
						</label>

						<MappingJsonField
							label={t('admin.playbooks.inputMapping')}
							labelKey={t('admin.playbooks.inputMapping')}
							value={step.input_mapping ?? {}}
							onCommit={(parsed) => patchStep(index, { input_mapping: parsed })}
						/>
					</div>
				))}
			</div>
		</Panel>
	);
}
