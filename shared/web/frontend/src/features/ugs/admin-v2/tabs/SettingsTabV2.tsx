/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Admin v2 settings tab: scoped list with create/update/delete via bulk validate/apply.
 *
 * Invariants:
 * - Settings mutations must use settings.* bulk operations, matching legacy /settings REST semantics.
 *
 * Related:
 * - src/services/api/ugsAdminV2.ts
 * - shared/api/services/ugs/admin_v2_apply.py
 */

import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	UGS_DESKTOP_BTN,
	UGS_DESKTOP_TABLE,
} from '@/features/ugs/shared/ugsDesktopUi';
import { jsonString, parseJsonInput } from '@/features/ugs/shared/ugsAdminUi';
import { SCOPE_VALUES } from '@/features/ugs/shared/ugsAdminConstants';
import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';
import type {
	UgsAdminV2BulkOperation,
	UgsAdminV2SnapshotDTO,
} from '@/services/api/ugsAdminV2';
import type { UGSSettingDTO } from '@/services/api/ugsAdmin';
import { cn } from '@/utils/cn';

import { BulkPatchModal } from '../components/BulkPatchModal';
import {
	ugsAdminV2SearchInputClass,
	ugsAdminV2SearchLabelClass,
	ugsAdminV2SectionClass,
	ugsAdminV2TableFooterClass,
	ugsAdminV2TableHeadClass,
	ugsAdminV2TableRowClass,
	ugsAdminV2TableWrapClass,
} from '../ugsAdminV2Ui';

function uniq(arr: string[]) {
	return Array.from(new Set(arr));
}

export function SettingsTabV2({
	snapshot,
	onRequestBulk,
}: {
	snapshot: UgsAdminV2SnapshotDTO;
	onRequestBulk: (ops: UgsAdminV2BulkOperation[]) => void | Promise<void>;
}): React.ReactElement {
	const { t } = useTranslation(UGS_ADMIN_V2_NS);
	const [scopeFilter, setScopeFilter] = useState('');
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<Record<string, boolean>>({});
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<UGSSettingDTO | null>(null);
	const [formScope, setFormScope] = useState<UGSSettingDTO['scope']>('global');
	const [formKey, setFormKey] = useState('');
	const [formDescription, setFormDescription] = useState('');
	const [formCompanyId, setFormCompanyId] = useState('');
	const [formProjectId, setFormProjectId] = useState('');
	const [formUserId, setFormUserId] = useState('');
	const [formJson, setFormJson] = useState('{}');

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		return snapshot.settings.items.filter((item) => {
			if (scopeFilter && item.scope !== scopeFilter) return false;
			if (!q) return true;
			return (
				item.key.toLowerCase().includes(q) ||
				item.scope.toLowerCase().includes(q) ||
				(item.description ?? '').toLowerCase().includes(q)
			);
		});
	}, [query, scopeFilter, snapshot.settings.items]);

	const selectedIds = useMemo(
		() => Object.keys(selected).filter((id) => selected[id]),
		[selected]
	);

	function toggle(id: string, checked: boolean) {
		setSelected((prev) => ({ ...prev, [id]: checked }));
	}

	function openCreate() {
		setEditing(null);
		setFormScope('global');
		setFormKey('');
		setFormDescription('');
		setFormCompanyId('');
		setFormProjectId('');
		setFormUserId('');
		setFormJson('{}');
		setModalOpen(true);
	}

	function openEdit(item: UGSSettingDTO) {
		setEditing(item);
		setFormScope(item.scope);
		setFormKey(item.key);
		setFormDescription(item.description ?? '');
		setFormCompanyId(item.company_id ?? '');
		setFormProjectId(item.project_id ?? '');
		setFormUserId(item.user_id ?? '');
		setFormJson(jsonString(item.value));
		setModalOpen(true);
	}

	function submitSetting() {
		const invalidJsonMessage = t('validation.invalidJson');
		const value = parseJsonInput(formJson, invalidJsonMessage) as Record<
			string,
			unknown
		>;
		if (editing) {
			void onRequestBulk([
				{
					kind: 'settings.patch',
					setting_ids: [editing.id],
					patch: {
						value,
						description: formDescription.trim() || null,
						company_id: formCompanyId.trim() || null,
						project_id: formProjectId.trim() || null,
						user_id: formUserId.trim() || null,
					},
				},
			]);
		} else {
			const key = formKey.trim();
			if (!key) return;
			void onRequestBulk([
				{
					kind: 'settings.create',
					setting: {
						scope: formScope,
						key,
						value,
						description: formDescription.trim() || null,
						company_id: formCompanyId.trim() || null,
						project_id: formProjectId.trim() || null,
						user_id: formUserId.trim() || null,
					},
				},
			]);
		}
		setModalOpen(false);
	}

	function requestDeleteSelected() {
		const ids =
			selectedIds.length > 0
				? uniq(selectedIds)
				: rows.filter((row) => selected[row.id]).map((row) => row.id);
		if (!ids.length) return;
		void onRequestBulk([{ kind: 'settings.delete', setting_ids: uniq(ids) }]);
		setSelected({});
	}

	return (
		<div className="space-y-4">
			<div className={ugsAdminV2SectionClass}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<h2 className="text-lg font-semibold text-(--desktop-text-primary)">
							{t('settings.title')}
						</h2>
						<p className="mt-2 text-sm text-(--desktop-text-muted)">
							{t('settings.subtitle')}
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={UGS_DESKTOP_BTN.primary}
							onClick={openCreate}
						>
							{t('settings.addAction')}
						</button>
						<button
							type="button"
							className={UGS_DESKTOP_BTN.danger}
							onClick={requestDeleteSelected}
							disabled={!selectedIds.length}
						>
							{t('settings.deleteSelected')}
						</button>
					</div>
				</div>

				<div className="mt-4 flex flex-wrap gap-3">
					<div className="min-w-[220px] flex-1">
						<label
							htmlFor="ugs-admin-v2-settings-search"
							className={ugsAdminV2SearchLabelClass}
						>
							{t('common.search')}
						</label>
						<input
							id="ugs-admin-v2-settings-search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={t('settings.searchPlaceholder')}
							className={cn('mt-2', ugsAdminV2SearchInputClass)}
						/>
					</div>
					<div className="min-w-[180px]">
						<label
							htmlFor="ugs-admin-v2-settings-scope"
							className={ugsAdminV2SearchLabelClass}
						>
							scope
						</label>
						<select
							id="ugs-admin-v2-settings-scope"
							value={scopeFilter}
							onChange={(e) => setScopeFilter(e.target.value)}
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
						>
							<option value="">{t('settings.allScopes')}</option>
							{SCOPE_VALUES.map((scope) => (
								<option key={scope} value={scope}>
									{scope}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className={cn(ugsAdminV2TableWrapClass, 'mt-4')}>
					<div className="overflow-auto">
						<table className="min-w-[980px] w-full text-left text-sm">
							<thead className={ugsAdminV2TableHeadClass}>
								<tr>
									<th className="px-4 py-3" aria-label="select" />
									<th className="px-4 py-3">scope</th>
									<th className="px-4 py-3">key</th>
									<th className="px-4 py-3">company</th>
									<th className="px-4 py-3">project</th>
									<th className="px-4 py-3">user</th>
									<th className="px-4 py-3">updated</th>
									<th className="px-4 py-3">{t('settings.actions')}</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((s) => (
									<tr key={s.id} className={ugsAdminV2TableRowClass}>
										<td className="px-4 py-3">
											<input
												type="checkbox"
												checked={!!selected[s.id]}
												onChange={(e) => toggle(s.id, e.target.checked)}
												aria-label={s.key}
											/>
										</td>
										<td className="px-4 py-3 text-(--desktop-text-secondary)">
											{s.scope}
										</td>
										<td className="px-4 py-3 font-mono text-[0.75rem] text-(--desktop-text-primary)">
											{s.key}
										</td>
										<td className="px-4 py-3 font-mono text-[0.75rem] text-(--desktop-text-muted)">
											{s.company_id || t('common.emDash')}
										</td>
										<td className="px-4 py-3 font-mono text-[0.75rem] text-(--desktop-text-muted)">
											{s.project_id || t('common.emDash')}
										</td>
										<td className="px-4 py-3 font-mono text-[0.75rem] text-(--desktop-text-muted)">
											{s.user_id || t('common.emDash')}
										</td>
										<td className="px-4 py-3 text-(--desktop-text-muted)">
											{s.updated_at || t('common.emDash')}
										</td>
										<td className="px-4 py-3">
											<button
												type="button"
												className={UGS_DESKTOP_BTN.secondary}
												onClick={() => openEdit(s)}
											>
												{t('settings.editAction')}
											</button>
										</td>
									</tr>
								))}
								{rows.length === 0 ? (
									<tr>
										<td colSpan={8} className={UGS_DESKTOP_TABLE.empty}>
											{t('common.noRecords')}
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
			</div>

			<BulkPatchModal
				open={modalOpen}
				title={
					editing
						? t('settings.editTitle', { key: editing.key })
						: t('settings.createTitle')
				}
				subtitle={t('settings.modalHint')}
				onClose={() => setModalOpen(false)}
				onConfirm={submitSetting}
				confirmLabel={t('common.apply')}
			>
				<div className="grid gap-3 sm:grid-cols-2">
					<label className="text-sm text-(--desktop-text-secondary)">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							scope
						</span>
						<select
							value={formScope}
							disabled={Boolean(editing)}
							onChange={(e) =>
								setFormScope(e.target.value as UGSSettingDTO['scope'])
							}
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary) disabled:opacity-60"
						>
							{SCOPE_VALUES.map((scope) => (
								<option key={scope} value={scope}>
									{scope}
								</option>
							))}
						</select>
					</label>
					<label className="text-sm text-(--desktop-text-secondary)">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							key
						</span>
						<input
							value={formKey}
							disabled={Boolean(editing)}
							onChange={(e) => setFormKey(e.target.value)}
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary) disabled:opacity-60"
						/>
					</label>
					<label className="text-sm text-(--desktop-text-secondary) sm:col-span-2">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							description
						</span>
						<input
							value={formDescription}
							onChange={(e) => setFormDescription(e.target.value)}
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
						/>
					</label>
					<label className="text-sm text-(--desktop-text-secondary)">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							company_id
						</span>
						<input
							value={formCompanyId}
							disabled={Boolean(editing)}
							onChange={(e) => setFormCompanyId(e.target.value)}
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary) disabled:opacity-60"
						/>
					</label>
					<label className="text-sm text-(--desktop-text-secondary)">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							project_id
						</span>
						<input
							value={formProjectId}
							disabled={Boolean(editing)}
							onChange={(e) => setFormProjectId(e.target.value)}
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary) disabled:opacity-60"
						/>
					</label>
					<label className="text-sm text-(--desktop-text-secondary) sm:col-span-2">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							user_id
						</span>
						<input
							value={formUserId}
							disabled={Boolean(editing)}
							onChange={(e) => setFormUserId(e.target.value)}
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary) disabled:opacity-60"
						/>
					</label>
				</div>
				<label className="block text-sm text-(--desktop-text-secondary)">
					<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
						value (JSON)
					</span>
					<textarea
						value={formJson}
						onChange={(e) => setFormJson(e.target.value)}
						rows={8}
						className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 font-mono text-[0.75rem] text-(--desktop-text-primary)"
					/>
				</label>
			</BulkPatchModal>
		</div>
	);
}
