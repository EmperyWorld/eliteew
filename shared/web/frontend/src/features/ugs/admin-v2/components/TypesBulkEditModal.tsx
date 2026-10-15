/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full GenerationTypeUpdate editor for UGS Admin v2 — single-row or multi-target type.patch.
 *
 * Invariants:
 * - Does not apply directly; emits type.patch (+ optional type.set_active via is_active in patch).
 * - Single target prefills all fields; multi target empty = skip field.
 * - type_key is immutable (not in GenerationTypeUpdate).
 *
 * Related:
 * - src/features/ugs/admin-v2/tabs/TypesTabV2.tsx
 * - src/features/ugs/admin-v2/components/typesBulkEditUtils.ts
 */

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	Button,
	InputField,
	Modal,
	TextAreaField,
} from '@/features/ugs/shared/ugsAdminUi';
import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';
import type {
	UgsAdminV2BulkOperation,
	UgsAdminV2SnapshotDTO,
} from '@/services/api/ugsAdminV2';

import {
	baselineFromType,
	buildTypePatch,
	emptyTypesEditForm,
	formFromBaseline,
	type TypesEditBaseline,
	type TypesEditFormValues,
	type TypesEditTriBool,
} from './typesBulkEditUtils';

export function TypesBulkEditModal({
	open,
	snapshot,
	targetTypeKeys,
	onClose,
	onConfirm,
}: {
	open: boolean;
	snapshot: UgsAdminV2SnapshotDTO;
	targetTypeKeys: string[];
	onClose: () => void;
	onConfirm: (ops: UgsAdminV2BulkOperation[]) => void;
}): React.ReactElement {
	const { t } = useTranslation(UGS_ADMIN_V2_NS);
	const [form, setForm] = useState<TypesEditFormValues>(emptyTypesEditForm);
	const [baseline, setBaseline] = useState<TypesEditBaseline | null>(null);
	const [clientErrors, setClientErrors] = useState<string[]>([]);

	const singleKey = targetTypeKeys.length === 1 ? targetTypeKeys[0] : null;
	const singleType = useMemo(() => {
		if (!singleKey) return null;
		return snapshot.types.find((row) => row.type_key === singleKey) ?? null;
	}, [singleKey, snapshot.types]);

	const resolvedHint = useMemo(() => {
		if (!singleKey) return null;
		return (
			snapshot.resolved_models_by_type.find((r) => r.type_key === singleKey) ??
			null
		);
	}, [singleKey, snapshot.resolved_models_by_type]);

	useEffect(() => {
		if (!open) return;
		setClientErrors([]);
		if (singleType) {
			const base = baselineFromType(singleType);
			setBaseline(base);
			setForm(formFromBaseline(base));
			return;
		}
		setBaseline(null);
		setForm(emptyTypesEditForm());
	}, [open, singleType]);

	function setField<K extends keyof TypesEditFormValues>(
		key: K,
		value: TypesEditFormValues[K]
	) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	function submit() {
		const { patch, errors } = buildTypePatch(
			form,
			baseline,
			t('types.invalidJson')
		);
		if (errors.length) {
			setClientErrors(errors);
			return;
		}
		if (!Object.keys(patch).length) {
			setClientErrors([t('types.noChanges')]);
			return;
		}
		if (!targetTypeKeys.length) {
			setClientErrors([t('types.noTargets')]);
			return;
		}
		setClientErrors([]);
		onConfirm([
			{
				kind: 'type.patch',
				type_keys: targetTypeKeys,
				patch,
			} as UgsAdminV2BulkOperation,
		]);
	}

	const title = singleKey
		? t('types.editTitle', { typeKey: singleKey })
		: t('types.bulkEditTitle');

	return (
		<Modal open={open} title={title} onClose={onClose} size="xl">
			<div className="space-y-4">
				<p className="text-sm text-(--desktop-text-muted)">
					{singleKey ? t('types.editSubtitle') : t('types.bulkEditSubtitle')}
				</p>
				{singleKey ? (
					<p className="text-xs text-(--desktop-text-muted)">
						{t('types.targetCount', { count: 1 })} ·{' '}
						<span className="font-mono">{singleKey}</span>
					</p>
				) : (
					<p className="text-xs text-(--desktop-text-muted)">
						{t('types.targetCount', { count: targetTypeKeys.length })}
					</p>
				)}

				{resolvedHint ? (
					<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-xs text-(--desktop-text-secondary)">
						{t('types.resolvedModelHint', {
							model: resolvedHint.resolved_model || t('common.emDash'),
							source: resolvedHint.source || t('common.emDash'),
						})}
					</div>
				) : null}

				<div className="grid gap-4 sm:grid-cols-2">
					<InputField
						label="display_name"
						value={form.displayName}
						onChange={(e) => setField('displayName', e.target.value)}
					/>
					<InputField
						label="category"
						value={form.category}
						onChange={(e) => setField('category', e.target.value)}
						placeholder="text / image / audio / video"
					/>
					<InputField
						label="provider"
						value={form.provider}
						onChange={(e) => setField('provider', e.target.value)}
						placeholder={t('types.providerPlaceholder')}
					/>
					<InputField
						label="complexity"
						value={form.complexity}
						onChange={(e) => setField('complexity', e.target.value)}
						placeholder="low / medium / high"
					/>
					<InputField
						label="model_name"
						value={form.modelName}
						onChange={(e) => setField('modelName', e.target.value)}
						hint={t('types.modelNameHint')}
					/>
					<label className="text-sm text-(--desktop-text-secondary)">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							is_active
						</span>
						<select
							value={form.isActive}
							onChange={(e) =>
								setField('isActive', e.target.value as TypesEditTriBool)
							}
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
						>
							{!singleKey ? (
								<option value="">{t('common.doNotChange')}</option>
							) : null}
							<option value="true">active</option>
							<option value="false">inactive</option>
						</select>
					</label>
					<InputField
						label="priority"
						value={form.priority}
						onChange={(e) => setField('priority', e.target.value)}
						inputMode="numeric"
					/>
					<InputField
						label="cost_credits"
						value={form.costCredits}
						onChange={(e) => setField('costCredits', e.target.value)}
						inputMode="decimal"
					/>
					<InputField
						label="estimated_time"
						value={form.estimatedTime}
						onChange={(e) => setField('estimatedTime', e.target.value)}
						inputMode="numeric"
						hint={t('types.secondsHint')}
					/>
					<InputField
						label="max_retries"
						value={form.maxRetries}
						onChange={(e) => setField('maxRetries', e.target.value)}
						inputMode="numeric"
					/>
				</div>

				<TextAreaField
					label="description"
					value={form.description}
					onChange={(e) => setField('description', e.target.value)}
					rows={3}
				/>
				<TextAreaField
					label="parameters (JSON)"
					value={form.parametersRaw}
					onChange={(e) => setField('parametersRaw', e.target.value)}
					rows={8}
					className="font-mono text-xs"
				/>
				<TextAreaField
					label="metadata (JSON)"
					value={form.metadataRaw}
					onChange={(e) => setField('metadataRaw', e.target.value)}
					rows={6}
					className="font-mono text-xs"
				/>

				{clientErrors.length ? (
					<ul className="space-y-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
						{clientErrors.map((err) => (
							<li key={err}>{err}</li>
						))}
					</ul>
				) : null}

				<div className="flex flex-wrap gap-3 pt-2">
					<Button variant="secondary" onClick={onClose}>
						{t('common.cancel')}
					</Button>
					<Button onClick={submit} disabled={!targetTypeKeys.length}>
						{t('common.generateChanges')}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
