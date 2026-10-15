/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Admin v2 types tab: dense table with multi-select, activate/deactivate, and full type.patch editor.
 *
 * Invariants:
 * - Selection is by type_key.
 * - Row click / Bulk edit open TypesBulkEditModal (full GenerationTypeUpdate surface).
 *
 * Related:
 * - src/features/ugs/admin-v2/UGSAdminV2PanelBody.tsx
 * - src/features/ugs/admin-v2/components/TypesBulkEditModal.tsx
 */

import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';
import type {
	UgsAdminV2BulkOperation,
	UgsAdminV2SnapshotDTO,
} from '@/services/api/ugsAdminV2';

import { UGS_DESKTOP_BTN } from '@/features/ugs/shared/ugsDesktopUi';
import { cn } from '@/utils/cn';

import {
	ugsAdminActiveStateBadgeClass,
	ugsAdminV2SearchInputClass,
	ugsAdminV2SearchLabelClass,
	ugsAdminV2SectionClass,
	ugsAdminV2TableFooterClass,
	ugsAdminV2TableHeadClass,
	ugsAdminV2TableRowClass,
	ugsAdminV2TableWrapClass,
} from '../ugsAdminV2Ui';
import {
	Button,
	InputField,
	Modal,
	TextAreaField,
} from '@/features/ugs/shared/ugsAdminUi';

import { TypesBulkEditModal } from '../components/TypesBulkEditModal';
import {
	buildTypeCreateOperation,
	emptyTypeCreateForm,
	type TypeCreateFormValues,
} from '../components/typeCreateUtils';
import { deleteGenerationType } from '@/services/api/ugsAdmin';
import { UGS_ADMIN_V2_SNAPSHOT_QUERY_KEY } from '@/services/api/ugsAdminQueryOptions';
import { DangerConfirmModal } from '@/pages/Admin/ui';
import { useNotifications } from '@/notifications';
import { useQueryClient } from '@tanstack/react-query';

function uniq(arr: string[]) {
	return Array.from(new Set(arr));
}

export function TypesTabV2({
	snapshot,
	onRequestBulk,
}: {
	snapshot: UgsAdminV2SnapshotDTO;
	onRequestBulk: (ops: UgsAdminV2BulkOperation[]) => void | Promise<void>;
}): React.ReactElement {
	const { t: tr } = useTranslation(UGS_ADMIN_V2_NS);
	const toast = useNotifications();
	const queryClient = useQueryClient();
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<Record<string, boolean>>({});
	const [editOpen, setEditOpen] = useState(false);
	const [editTargetKeys, setEditTargetKeys] = useState<string[]>([]);
	const [createOpen, setCreateOpen] = useState(false);
	const [createForm, setCreateForm] = useState<TypeCreateFormValues>(
		emptyTypeCreateForm()
	);
	const [createErrors, setCreateErrors] = useState<string[]>([]);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteBusy, setDeleteBusy] = useState(false);

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		const items = snapshot.types;
		if (!q) return items;
		return items.filter((t) => {
			return (
				t.type_key.toLowerCase().includes(q) ||
				t.display_name.toLowerCase().includes(q) ||
				t.category.toLowerCase().includes(q) ||
				t.provider.toLowerCase().includes(q)
			);
		});
	}, [snapshot.types, query]);

	const selectedKeys = useMemo(
		() => Object.keys(selected).filter((k) => selected[k]),
		[selected]
	);
	const resolvedByType = useMemo(
		() =>
			new Map(
				snapshot.resolved_models_by_type.map((item) => [item.type_key, item])
			),
		[snapshot.resolved_models_by_type]
	);

	const allVisibleSelected = rows.length
		? rows.every((r) => selected[r.type_key])
		: false;

	function toggleAllVisible(next: boolean) {
		const copy = { ...selected };
		for (const r of rows) copy[r.type_key] = next;
		setSelected(copy);
	}

	function clearSelection() {
		setSelected({});
	}

	function requestSetActive(isActive: boolean) {
		const keys = selectedKeys.length
			? selectedKeys
			: rows.map((r) => r.type_key);
		void onRequestBulk([
			{ kind: 'type.set_active', type_keys: uniq(keys), is_active: isActive },
		]);
	}

	function openBulkPatch() {
		setEditTargetKeys(
			selectedKeys.length
				? uniq(selectedKeys)
				: uniq(rows.map((r) => r.type_key))
		);
		setEditOpen(true);
	}

	function openTypeEditor(item: (typeof snapshot.types)[number]) {
		setEditTargetKeys([item.type_key]);
		setEditOpen(true);
	}

	function confirmEdit(ops: UgsAdminV2BulkOperation[]) {
		void onRequestBulk(ops);
		setEditOpen(false);
	}

	function requestClearModelNames() {
		const keys = selectedKeys.length
			? selectedKeys
			: rows.map((r) => r.type_key);
		void onRequestBulk([
			{ kind: 'type.clear_model_names', type_keys: uniq(keys) },
		]);
	}

	function openCreateType() {
		setCreateForm(emptyTypeCreateForm());
		setCreateErrors([]);
		setCreateOpen(true);
	}

	function setCreateField<K extends keyof TypeCreateFormValues>(
		key: K,
		value: TypeCreateFormValues[K]
	) {
		setCreateForm((prev) => ({ ...prev, [key]: value }));
	}

	function submitCreateType() {
		const { operation, errors } = buildTypeCreateOperation(
			createForm,
			tr('types.invalidJson')
		);
		if (errors.length || !operation) {
			setCreateErrors(errors);
			return;
		}
		setCreateErrors([]);
		void onRequestBulk([operation]);
		setCreateOpen(false);
	}

	return (
		<div className="space-y-4">
			<div className={ugsAdminV2SectionClass}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<h2 className="text-lg font-semibold">{tr('types.title')}</h2>
						<p className="mt-1 text-sm text-(--desktop-text-muted)">
							{tr('types.subtitle')}
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={openCreateType}
						>
							{tr('types.createType')}
						</button>
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={openBulkPatch}
						>
							{tr('common.bulkEdit')}
						</button>
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={requestClearModelNames}
						>
							{tr('types.clearModelNames')}
						</button>
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={() => requestSetActive(true)}
						>
							{tr('common.activate')}
						</button>
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={() => requestSetActive(false)}
						>
							{tr('common.deactivate')}
						</button>
						<button
							type="button"
							className={cn(UGS_DESKTOP_BTN.secondary, 'text-red-300')}
							disabled={!selectedKeys.length}
							onClick={() => setDeleteOpen(true)}
						>
							{tr('common.delete', 'Delete')}
						</button>
						<button
							type="button"
							className={cn(UGS_DESKTOP_BTN.secondary, 'disabled:opacity-60')}
							onClick={clearSelection}
							disabled={!selectedKeys.length}
						>
							{tr('common.clearSelection')}
						</button>
					</div>
				</div>

				<div className="mt-4 flex flex-wrap gap-3">
					<div className="min-w-[260px] flex-1">
						<label
							htmlFor="ugs-admin-v2-types-search"
							className={ugsAdminV2SearchLabelClass}
						>
							{tr('common.search')}
						</label>
						<input
							id="ugs-admin-v2-types-search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={tr('types.searchPlaceholder')}
							className={cn('mt-2', ugsAdminV2SearchInputClass)}
						/>
					</div>
					<div className="min-w-[220px]">
						<div className="text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							{tr('common.selected')}
						</div>
						<div className="mt-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-secondary)">
							{selectedKeys.length} / {snapshot.types.length}
						</div>
					</div>
				</div>
			</div>

			<div className={ugsAdminV2TableWrapClass}>
				<div className="overflow-auto">
					<table className="min-w-[980px] w-full text-left text-sm">
						<thead className={ugsAdminV2TableHeadClass}>
							<tr>
								<th className="px-4 py-3">
									<input
										type="checkbox"
										checked={allVisibleSelected}
										onChange={(e) => toggleAllVisible(e.target.checked)}
									/>
								</th>
								<th className="px-4 py-3">type_key</th>
								<th className="px-4 py-3">{tr('common.title')}</th>
								<th className="px-4 py-3">{tr('common.category')}</th>
								<th className="px-4 py-3">{tr('common.provider')}</th>
								<th className="px-4 py-3">{tr('common.status')}</th>
								<th className="px-4 py-3">Resolved model</th>
								<th className="px-4 py-3">{tr('common.source')}</th>
								<th className="px-4 py-3">{tr('common.cost')}</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((typeRow) => (
								<tr
									key={typeRow.type_key}
									className={ugsAdminV2TableRowClass}
									onClick={() => openTypeEditor(typeRow)}
								>
									<td className="px-4 py-3">
										<input
											type="checkbox"
											checked={!!selected[typeRow.type_key]}
											onClick={(e) => e.stopPropagation()}
											onChange={(e) =>
												setSelected((prev) => ({
													...prev,
													[typeRow.type_key]: e.target.checked,
												}))
											}
										/>
									</td>
									<td className="px-4 py-3 font-mono text-[0.8125rem] text-(--desktop-text-primary)">
										{typeRow.type_key}
									</td>
									<td className="px-4 py-3 text-(--desktop-text-primary)">
										{typeRow.display_name}
									</td>
									<td className="px-4 py-3 text-(--desktop-text-secondary)">
										{typeRow.category}
									</td>
									<td className="px-4 py-3 font-mono text-[0.75rem] text-(--desktop-text-secondary)">
										{typeRow.provider}
									</td>
									<td className="px-4 py-3">
										<span
											className={ugsAdminActiveStateBadgeClass(
												typeRow.is_active
											)}
										>
											{typeRow.is_active ? 'active' : 'inactive'}
										</span>
									</td>
									<td className="px-4 py-3 font-mono text-[0.75rem] text-(--desktop-text-secondary)">
										{resolvedByType.get(typeRow.type_key)?.resolved_model ||
											tr('common.emDash')}
									</td>
									<td className="px-4 py-3 text-xs text-(--desktop-text-muted)">
										{resolvedByType.get(typeRow.type_key)?.source ||
											tr('common.emDash')}
									</td>
									<td className="px-4 py-3 tabular-nums text-(--desktop-text-secondary)">
										{Number(typeRow.cost_credits ?? 0).toFixed(2)}
									</td>
								</tr>
							))}
							{rows.length === 0 ? (
								<tr>
									<td
										colSpan={9}
										className="px-4 py-8 text-center text-(--desktop-text-muted)"
									>
										{tr('common.noResults')}
									</td>
								</tr>
							) : null}
						</tbody>
					</table>
				</div>
				<div className={ugsAdminV2TableFooterClass}>
					{tr('common.visibleRows', { count: rows.length })}
				</div>
			</div>

			<TypesBulkEditModal
				open={editOpen}
				snapshot={snapshot}
				targetTypeKeys={editTargetKeys}
				onClose={() => setEditOpen(false)}
				onConfirm={confirmEdit}
			/>

			<Modal
				open={createOpen}
				title={tr('types.createTitle')}
				onClose={() => setCreateOpen(false)}
				size="xl"
			>
				<div className="space-y-4">
					<p className="text-sm text-(--desktop-text-muted)">
						{tr('types.createSubtitle')}
					</p>
					<div className="grid gap-4 sm:grid-cols-2">
						<InputField
							label="type_key"
							value={createForm.typeKey}
							onChange={(e) => setCreateField('typeKey', e.target.value)}
							placeholder="my_type_key"
						/>
						<InputField
							label="category"
							value={createForm.category}
							onChange={(e) => setCreateField('category', e.target.value)}
							placeholder="text / image / audio"
						/>
						<InputField
							label="display_name"
							value={createForm.displayName}
							onChange={(e) => setCreateField('displayName', e.target.value)}
						/>
						<InputField
							label="provider"
							value={createForm.provider}
							onChange={(e) => setCreateField('provider', e.target.value)}
							placeholder={tr('types.providerPlaceholder')}
						/>
						<InputField
							label="model_name"
							value={createForm.modelName}
							onChange={(e) => setCreateField('modelName', e.target.value)}
							hint={tr('types.modelNameHint')}
						/>
						<InputField
							label="complexity"
							value={createForm.complexity}
							onChange={(e) => setCreateField('complexity', e.target.value)}
						/>
						<InputField
							label="estimated_time"
							value={createForm.estimatedTime}
							onChange={(e) => setCreateField('estimatedTime', e.target.value)}
							inputMode="numeric"
							hint={tr('types.secondsHint')}
						/>
						<InputField
							label="max_retries"
							value={createForm.maxRetries}
							onChange={(e) => setCreateField('maxRetries', e.target.value)}
							inputMode="numeric"
						/>
						<InputField
							label="priority"
							value={createForm.priority}
							onChange={(e) => setCreateField('priority', e.target.value)}
							inputMode="numeric"
						/>
						<InputField
							label="cost_credits"
							value={createForm.costCredits}
							onChange={(e) => setCreateField('costCredits', e.target.value)}
							inputMode="decimal"
						/>
						<label className="text-sm text-(--desktop-text-secondary) sm:col-span-2">
							<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
								is_active
							</span>
							<select
								value={createForm.isActive}
								onChange={(e) =>
									setCreateField(
										'isActive',
										e.target.value as TypeCreateFormValues['isActive']
									)
								}
								className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
							>
								<option value="true">active</option>
								<option value="false">inactive</option>
							</select>
						</label>
					</div>
					<TextAreaField
						label="description"
						value={createForm.description}
						onChange={(e) => setCreateField('description', e.target.value)}
						rows={2}
					/>
					<TextAreaField
						label="parameters (JSON)"
						value={createForm.parametersRaw}
						onChange={(e) => setCreateField('parametersRaw', e.target.value)}
						rows={4}
						className="font-mono text-xs"
					/>
					<TextAreaField
						label="metadata (JSON)"
						value={createForm.metadataRaw}
						onChange={(e) => setCreateField('metadataRaw', e.target.value)}
						rows={4}
						className="font-mono text-xs"
					/>
					{createErrors.length ? (
						<ul className="space-y-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
							{createErrors.map((err) => (
								<li key={err}>{err}</li>
							))}
						</ul>
					) : null}
					<div className="flex flex-wrap gap-3 pt-2">
						<Button variant="secondary" onClick={() => setCreateOpen(false)}>
							{tr('common.cancel')}
						</Button>
						<Button
							onClick={submitCreateType}
							disabled={
								!createForm.typeKey.trim() ||
								!createForm.category.trim() ||
								!createForm.displayName.trim() ||
								!createForm.provider.trim()
							}
						>
							{tr('common.generateChanges')}
						</Button>
					</div>
				</div>
			</Modal>

			<DangerConfirmModal
				open={deleteOpen}
				title={tr('types.deleteTitle', 'Delete selected types')}
				description={tr(
					'types.deleteBody',
					'Hard-deletes {{count}} type(s) via legacy admin DELETE. This cannot be undone.',
					{ count: selectedKeys.length }
				)}
				confirmPhrase="DELETE"
				busy={deleteBusy}
				onCancel={() => setDeleteOpen(false)}
				onConfirm={() =>
					void (async () => {
						setDeleteBusy(true);
						try {
							for (const key of selectedKeys) {
								await deleteGenerationType(key);
							}
							setDeleteOpen(false);
							setSelected({});
							await queryClient.invalidateQueries({
								queryKey: UGS_ADMIN_V2_SNAPSHOT_QUERY_KEY,
							});
							toast.success(tr('types.deleteDone', 'Types deleted'));
						} catch (err) {
							toast.error(
								err instanceof Error
									? err.message
									: tr('common.deleteFailed', 'Delete failed')
							);
						} finally {
							setDeleteBusy(false);
						}
					})()
				}
			/>
		</div>
	);
}
