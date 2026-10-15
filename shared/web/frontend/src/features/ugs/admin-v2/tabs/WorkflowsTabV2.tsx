/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Admin v2 workflows tab: dense table with multi-select and full ComfyUIWorkflowUpdate editor.
 *
 * Invariants:
 * - Selection is by workflow slug.
 * - Row click opens full editor (json_body, metadata, model_dependencies, …).
 *
 * Related:
 * - src/features/ugs/admin-v2/UGSAdminV2PanelBody.tsx
 * - src/features/ugs/admin-v2/components/workflowEditUtils.ts
 */

import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';
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
import type {
	UgsAdminV2BulkOperation,
	UgsAdminV2SnapshotDTO,
} from '@/services/api/ugsAdminV2';

import {
	Button,
	InputField,
	Modal,
	TextAreaField,
} from '@/features/ugs/shared/ugsAdminUi';

import {
	baselineFromWorkflow,
	buildWorkflowPatch,
	formFromWorkflowBaseline,
	type WorkflowEditBaseline,
	type WorkflowEditFormValues,
	type WorkflowEditTriBool,
} from '../components/workflowEditUtils';
import {
	buildWorkflowCreateOperation,
	emptyWorkflowCreateForm,
	type WorkflowCreateFormValues,
} from '../components/workflowCreateUtils';
import { deleteWorkflow } from '@/services/api/ugsAdmin';
import { UGS_ADMIN_V2_SNAPSHOT_QUERY_KEY } from '@/services/api/ugsAdminQueryOptions';
import { DangerConfirmModal } from '@/pages/Admin/ui';
import { useNotifications } from '@/notifications';
import { useQueryClient } from '@tanstack/react-query';

function uniq(arr: string[]) {
	return Array.from(new Set(arr));
}

export function WorkflowsTabV2({
	snapshot,
	onRequestBulk,
}: {
	snapshot: UgsAdminV2SnapshotDTO;
	onRequestBulk: (ops: UgsAdminV2BulkOperation[]) => void | Promise<void>;
}): React.ReactElement {
	const { t } = useTranslation(UGS_ADMIN_V2_NS);
	const toast = useNotifications();
	const queryClient = useQueryClient();
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<Record<string, boolean>>({});
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteBusy, setDeleteBusy] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [editSlug, setEditSlug] = useState<string | null>(null);
	const [editBaseline, setEditBaseline] = useState<WorkflowEditBaseline | null>(
		null
	);
	const [form, setForm] = useState<WorkflowEditFormValues | null>(null);
	const [clientErrors, setClientErrors] = useState<string[]>([]);
	const [createOpen, setCreateOpen] = useState(false);
	const [createForm, setCreateForm] = useState<WorkflowCreateFormValues>(
		emptyWorkflowCreateForm()
	);
	const [createErrors, setCreateErrors] = useState<string[]>([]);
	const [importOverwrite, setImportOverwrite] = useState(false);

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		const items = snapshot.workflows;
		if (!q) return items;
		return items.filter((w) => {
			return (
				w.slug.toLowerCase().includes(q) ||
				w.name.toLowerCase().includes(q) ||
				(w.category ?? '').toLowerCase().includes(q)
			);
		});
	}, [snapshot.workflows, query]);

	const selectedSlugs = useMemo(
		() => Object.keys(selected).filter((k) => selected[k]),
		[selected]
	);

	const allVisibleSelected = rows.length
		? rows.every((r) => selected[r.slug])
		: false;

	function toggleAllVisible(next: boolean) {
		const copy = { ...selected };
		for (const r of rows) copy[r.slug] = next;
		setSelected(copy);
	}

	function clearSelection() {
		setSelected({});
	}

	function requestSetActive(isActive: boolean) {
		const slugs = selectedSlugs.length
			? selectedSlugs
			: rows.map((r) => r.slug);
		void onRequestBulk([
			{ kind: 'workflow.set_active', slugs: uniq(slugs), is_active: isActive },
		]);
	}

	function setField<K extends keyof WorkflowEditFormValues>(
		key: K,
		value: WorkflowEditFormValues[K]
	) {
		setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
	}

	function openWorkflowEditor(item: (typeof snapshot.workflows)[number]) {
		const base = baselineFromWorkflow(item);
		setEditSlug(item.slug);
		setEditBaseline(base);
		setForm(formFromWorkflowBaseline(base));
		setClientErrors([]);
		setEditOpen(true);
	}

	function submitWorkflowEditor() {
		if (!editSlug || !editBaseline || !form) return;
		const { patch, setActive, errors } = buildWorkflowPatch(
			form,
			editBaseline,
			t('workflows.invalidJson')
		);
		if (errors.length) {
			setClientErrors(errors);
			return;
		}
		const ops: UgsAdminV2BulkOperation[] = [];
		if (Object.keys(patch).length) {
			ops.push({
				kind: 'workflow.patch',
				slugs: [editSlug],
				patch,
			} as UgsAdminV2BulkOperation);
		}
		if (setActive != null) {
			ops.push({
				kind: 'workflow.set_active',
				slugs: [editSlug],
				is_active: setActive,
			});
		}
		if (!ops.length) {
			setClientErrors([t('workflows.noChanges')]);
			return;
		}
		setClientErrors([]);
		void onRequestBulk(ops);
		setEditOpen(false);
	}

	function openCreateWorkflow() {
		setCreateForm(emptyWorkflowCreateForm());
		setCreateErrors([]);
		setCreateOpen(true);
	}

	function setCreateField<K extends keyof WorkflowCreateFormValues>(
		key: K,
		value: WorkflowCreateFormValues[K]
	) {
		setCreateForm((prev) => ({ ...prev, [key]: value }));
	}

	function submitCreateWorkflow() {
		const { operation, errors } = buildWorkflowCreateOperation(
			createForm,
			t('workflows.invalidJson')
		);
		if (errors.length || !operation) {
			setCreateErrors(errors);
			return;
		}
		setCreateErrors([]);
		void onRequestBulk([operation]);
		setCreateOpen(false);
	}

	function requestImportFromDisk() {
		void onRequestBulk([
			{
				kind: 'workflow.import_from_disk',
				overwrite_existing: importOverwrite,
			},
		]);
	}

	return (
		<div className="space-y-4">
			<div className={ugsAdminV2SectionClass}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<h2 className="text-lg font-semibold">{t('workflows.title')}</h2>
						<p className="mt-1 text-sm text-(--desktop-text-muted)">
							{t('workflows.subtitle')}
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={openCreateWorkflow}
						>
							{t('workflows.createWorkflow')}
						</button>
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={requestImportFromDisk}
						>
							{t('workflows.importFromDisk')}
						</button>
						<label className="inline-flex items-center gap-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-secondary)">
							<input
								type="checkbox"
								checked={importOverwrite}
								onChange={(e) => setImportOverwrite(e.target.checked)}
							/>
							{t('workflows.overwriteExisting')}
						</label>
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={() => requestSetActive(true)}
						>
							{t('common.activate')}
						</button>
						<button
							type="button"
							className={UGS_DESKTOP_BTN.secondary}
							onClick={() => requestSetActive(false)}
						>
							{t('common.deactivate')}
						</button>
						<button
							type="button"
							className={cn(UGS_DESKTOP_BTN.secondary, 'text-red-300')}
							disabled={!selectedSlugs.length}
							onClick={() => setDeleteOpen(true)}
						>
							{t('common.delete', 'Delete')}
						</button>
						<button
							type="button"
							className={cn(UGS_DESKTOP_BTN.secondary, 'disabled:opacity-60')}
							onClick={clearSelection}
							disabled={!selectedSlugs.length}
						>
							{t('common.clearSelection')}
						</button>
					</div>
				</div>

				<div className="mt-4 flex flex-wrap gap-3">
					<div className="min-w-[260px] flex-1">
						<label
							htmlFor="ugs-admin-v2-workflows-search"
							className={ugsAdminV2SearchLabelClass}
						>
							{t('common.search')}
						</label>
						<input
							id="ugs-admin-v2-workflows-search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={t('workflows.searchPlaceholder')}
							className={cn('mt-2', ugsAdminV2SearchInputClass)}
						/>
					</div>
					<div className="min-w-[220px]">
						<div className="text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							{t('common.selected')}
						</div>
						<div className="mt-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-secondary)">
							{selectedSlugs.length} / {snapshot.workflows.length}
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
								<th className="px-4 py-3">Slug</th>
								<th className="px-4 py-3">{t('common.title')}</th>
								<th className="px-4 py-3">{t('common.category')}</th>
								<th className="px-4 py-3">{t('common.status')}</th>
								<th className="px-4 py-3">{t('common.version')}</th>
								<th className="px-4 py-3">{t('common.models')}</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((w) => (
								<tr
									key={w.slug}
									className={ugsAdminV2TableRowClass}
									onClick={() => openWorkflowEditor(w)}
								>
									<td className="px-4 py-3">
										<input
											type="checkbox"
											checked={!!selected[w.slug]}
											onClick={(e) => e.stopPropagation()}
											onChange={(e) =>
												setSelected((prev) => ({
													...prev,
													[w.slug]: e.target.checked,
												}))
											}
										/>
									</td>
									<td className="px-4 py-3 font-mono text-[0.8125rem] text-(--desktop-text-primary)">
										{w.slug}
									</td>
									<td className="px-4 py-3 text-(--desktop-text-primary)">
										{w.name}
									</td>
									<td className="px-4 py-3 text-(--desktop-text-secondary)">
										{w.category || t('common.emDash')}
									</td>
									<td className="px-4 py-3">
										<span
											className={ugsAdminActiveStateBadgeClass(w.is_active)}
										>
											{w.is_active ? 'active' : 'inactive'}
										</span>
									</td>
									<td className="px-4 py-3 tabular-nums text-(--desktop-text-secondary)">
										v{w.version}
									</td>
									<td className="px-4 py-3 text-(--desktop-text-secondary)">
										{(w.model_dependencies || []).slice(0, 3).join(', ') ||
											t('common.emDash')}
										{(w.model_dependencies || []).length > 3 ? '…' : ''}
									</td>
								</tr>
							))}
							{rows.length === 0 ? (
								<tr>
									<td
										colSpan={7}
										className="px-4 py-8 text-center text-(--desktop-text-muted)"
									>
										{t('common.noResults')}
									</td>
								</tr>
							) : null}
						</tbody>
					</table>
				</div>
				<div className={ugsAdminV2TableFooterClass}>
					{t('common.visibleRows', { count: rows.length })}
				</div>
			</div>

			<Modal
				open={editOpen}
				title={t('workflows.editTitle', { slug: editSlug ?? '' })}
				onClose={() => setEditOpen(false)}
				size="xl"
			>
				{form ? (
					<div className="space-y-4">
						<p className="text-sm text-(--desktop-text-muted)">
							{t('workflows.editSubtitle')}
						</p>
						<p className="text-xs font-mono text-(--desktop-text-muted)">
							slug: {editSlug} ({t('workflows.slugImmutable')})
						</p>

						<div className="grid gap-4 sm:grid-cols-2">
							<InputField
								label="name"
								value={form.name}
								onChange={(e) => setField('name', e.target.value)}
							/>
							<InputField
								label="category"
								value={form.category}
								onChange={(e) => setField('category', e.target.value)}
								placeholder="image / audio / video / general"
							/>
							<InputField
								label="version"
								value={form.version}
								onChange={(e) => setField('version', e.target.value)}
								inputMode="numeric"
							/>
							<InputField
								label="estimated_time"
								value={form.estimatedTime}
								onChange={(e) => setField('estimatedTime', e.target.value)}
								inputMode="numeric"
								hint={t('workflows.secondsHint')}
							/>
							<label className="text-sm text-(--desktop-text-secondary) sm:col-span-2">
								<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
									is_active
								</span>
								<select
									value={form.isActive}
									onChange={(e) =>
										setField('isActive', e.target.value as WorkflowEditTriBool)
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
							value={form.description}
							onChange={(e) => setField('description', e.target.value)}
							rows={3}
						/>
						<InputField
							label="model_dependencies"
							value={form.modelDependenciesCSV}
							onChange={(e) => setField('modelDependenciesCSV', e.target.value)}
							hint={t('workflows.modelDepsHint')}
						/>
						<TextAreaField
							label="json_body (JSON)"
							value={form.jsonBodyRaw}
							onChange={(e) => setField('jsonBodyRaw', e.target.value)}
							rows={12}
							className="font-mono text-xs"
							hint={t('workflows.jsonBodyHint')}
						/>
						<TextAreaField
							label="metadata (JSON)"
							value={form.metadataRaw}
							onChange={(e) => setField('metadataRaw', e.target.value)}
							rows={5}
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
							<Button variant="secondary" onClick={() => setEditOpen(false)}>
								{t('common.cancel')}
							</Button>
							<Button onClick={submitWorkflowEditor} disabled={!editSlug}>
								{t('common.generateChanges')}
							</Button>
						</div>
					</div>
				) : null}
			</Modal>

			<Modal
				open={createOpen}
				title={t('workflows.createTitle')}
				onClose={() => setCreateOpen(false)}
				size="xl"
			>
				<div className="space-y-4">
					<p className="text-sm text-(--desktop-text-muted)">
						{t('workflows.createSubtitle')}
					</p>
					<div className="grid gap-4 sm:grid-cols-2">
						<InputField
							label="name"
							value={createForm.name}
							onChange={(e) => setCreateField('name', e.target.value)}
						/>
						<InputField
							label="slug"
							value={createForm.slug}
							onChange={(e) => setCreateField('slug', e.target.value)}
							placeholder="my-workflow-slug"
						/>
						<InputField
							label="category"
							value={createForm.category}
							onChange={(e) => setCreateField('category', e.target.value)}
							placeholder="image / audio / video / general"
						/>
						<InputField
							label="version"
							value={createForm.version}
							onChange={(e) => setCreateField('version', e.target.value)}
							inputMode="numeric"
						/>
						<InputField
							label="estimated_time"
							value={createForm.estimatedTime}
							onChange={(e) => setCreateField('estimatedTime', e.target.value)}
							inputMode="numeric"
							hint={t('workflows.secondsHint')}
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
										e.target.value as WorkflowCreateFormValues['isActive']
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
						rows={3}
					/>
					<InputField
						label="model_dependencies"
						value={createForm.modelDependenciesCSV}
						onChange={(e) =>
							setCreateField('modelDependenciesCSV', e.target.value)
						}
						hint={t('workflows.modelDepsHint')}
					/>
					<TextAreaField
						label="json_body (JSON)"
						value={createForm.jsonBodyRaw}
						onChange={(e) => setCreateField('jsonBodyRaw', e.target.value)}
						rows={12}
						className="font-mono text-xs"
						hint={t('workflows.jsonBodyHint')}
					/>
					<TextAreaField
						label="metadata (JSON)"
						value={createForm.metadataRaw}
						onChange={(e) => setCreateField('metadataRaw', e.target.value)}
						rows={5}
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
							{t('common.cancel')}
						</Button>
						<Button
							onClick={submitCreateWorkflow}
							disabled={!createForm.name.trim() || !createForm.slug.trim()}
						>
							{t('common.generateChanges')}
						</Button>
					</div>
				</div>
			</Modal>

			<DangerConfirmModal
				open={deleteOpen}
				title={t('workflows.deleteTitle', 'Delete selected workflows')}
				description={t(
					'workflows.deleteBody',
					'Hard-deletes {{count}} workflow(s) via legacy admin DELETE. This cannot be undone.',
					{ count: selectedSlugs.length }
				)}
				confirmPhrase="DELETE"
				busy={deleteBusy}
				onCancel={() => setDeleteOpen(false)}
				onConfirm={() =>
					void (async () => {
						setDeleteBusy(true);
						try {
							for (const slug of selectedSlugs) {
								await deleteWorkflow(slug);
							}
							setDeleteOpen(false);
							setSelected({});
							await queryClient.invalidateQueries({
								queryKey: UGS_ADMIN_V2_SNAPSHOT_QUERY_KEY,
							});
							toast.success(t('workflows.deleteDone', 'Workflows deleted'));
						} catch (err) {
							toast.error(
								err instanceof Error
									? err.message
									: t('common.deleteFailed', 'Delete failed')
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
