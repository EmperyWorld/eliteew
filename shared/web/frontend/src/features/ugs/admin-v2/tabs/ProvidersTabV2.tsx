/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Admin v2 providers tab: dense table, multi-select, and safe bulk actions.
 *
 * Invariants:
 * - Selection is by provider_name.
 *
 * Related:
 * - src/features/ugs/admin-v2/UGSAdminV2PanelBody.tsx
 */

import * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { Button, InputField, Modal } from '@/features/ugs/shared/ugsAdminUi';
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
import { ProvidersBulkEditModal } from '../components/ProvidersBulkEditModal';
import { deleteProvider } from '@/services/api/ugsAdmin';
import { UGS_ADMIN_V2_SNAPSHOT_QUERY_KEY } from '@/services/api/ugsAdminQueryOptions';
import { DangerConfirmModal } from '@/pages/Admin/ui';
import { useNotifications } from '@/notifications';
import { useQueryClient } from '@tanstack/react-query';

function uniq(arr: string[]) {
	return Array.from(new Set(arr));
}

type ProviderRole = 'text' | 'image' | 'audio' | 'other';
type ProviderPreset =
	| 'text_llm'
	| 'text_embeddings'
	| 'text_rerank'
	| 'image_comfyui'
	| 'audio_whisper'
	| 'audio_tts'
	| 'other';

function providerRoleFromConfig(
	p: UgsAdminV2SnapshotDTO['providers'][number]
): ProviderRole {
	const raw = p.config_json?.provider_role;
	if (raw === 'text' || raw === 'image' || raw === 'audio' || raw === 'other')
		return raw;

	// Sensible defaults for legacy rows; custom providers should set provider_role explicitly.
	const t = (p.provider_type ?? '').trim().toLowerCase();
	if (t === 'llama' || t === 'llama') return 'text';
	if (t.includes('comfyui')) return 'image';
	if (t.includes('whisper') || t.includes('silero')) return 'audio';
	return 'other';
}

function applyPreset(preset: ProviderPreset): {
	role: ProviderRole;
	health_endpoint?: string;
	timeout_seconds?: number;
	max_concurrent?: number;
} {
	if (preset === 'text_llm')
		return {
			role: 'text',
			health_endpoint: '/health',
			timeout_seconds: 120,
			max_concurrent: 4,
		};
	if (preset === 'text_embeddings')
		return {
			role: 'text',
			health_endpoint: '/health',
			timeout_seconds: 180,
			max_concurrent: 2,
		};
	if (preset === 'text_rerank')
		return {
			role: 'text',
			health_endpoint: '/health',
			timeout_seconds: 120,
			max_concurrent: 2,
		};
	if (preset === 'image_comfyui')
		return {
			role: 'image',
			health_endpoint: '/system_stats',
			timeout_seconds: 300,
			max_concurrent: 3,
		};
	if (preset === 'audio_whisper')
		return {
			role: 'audio',
			health_endpoint: '/health',
			timeout_seconds: 120,
			max_concurrent: 2,
		};
	if (preset === 'audio_tts')
		return {
			role: 'audio',
			health_endpoint: '/health',
			timeout_seconds: 90,
			max_concurrent: 3,
		};
	return { role: 'other', timeout_seconds: 120, max_concurrent: 3 };
}

function providerModels(
	snapshot: UgsAdminV2SnapshotDTO,
	providerName: string
): string[] {
	const models = snapshot.model_inventory
		.filter((m) => m.provider_name === providerName)
		.map((m) => m.model_id);
	return Array.from(new Set(models)).sort();
}

export function ProvidersTabV2({
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
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteBusy, setDeleteBusy] = useState(false);
	const [bulkOpen, setBulkOpen] = useState(false);
	const [bulkTargetNames, setBulkTargetNames] = useState<string[]>([]);
	const [bulkAutoScanModels, setBulkAutoScanModels] = useState(false);
	const [defaultModelOpen, setDefaultModelOpen] = useState(false);
	const [defaultModelProvider, setDefaultModelProvider] = useState<
		string | null
	>(null);
	const [defaultModelValue, setDefaultModelValue] = useState('');
	const [createOpen, setCreateOpen] = useState(false);
	const [createName, setCreateName] = useState('');
	const [createType, setCreateType] = useState('');
	const [createBaseUrl, setCreateBaseUrl] = useState('');
	const [createRole, setCreateRole] = useState<ProviderRole>('other');
	const [createPreset, setCreatePreset] = useState<ProviderPreset>('other');
	const [createHealth, setCreateHealth] = useState('');
	const [createTimeout, setCreateTimeout] = useState('120');
	const [createLimit, setCreateLimit] = useState('3');
	const [createDisplayLabel, setCreateDisplayLabel] = useState('');
	const [createApiKeyRequired, setCreateApiKeyRequired] = useState(false);
	const [createCostPerRequest, setCreateCostPerRequest] = useState('0');
	const [createFallbackPriority, setCreateFallbackPriority] = useState('0');
	const [createFallbackForCsv, setCreateFallbackForCsv] = useState('');

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		const items = snapshot.providers;
		if (!q) return items;
		return items.filter((p) => {
			return (
				p.provider_name.toLowerCase().includes(q) ||
				p.provider_type.toLowerCase().includes(q) ||
				(p.base_url ?? '').toLowerCase().includes(q)
			);
		});
	}, [snapshot.providers, query]);

	const selectedNames = useMemo(
		() => Object.keys(selected).filter((k) => selected[k]),
		[selected]
	);

	const allVisibleSelected = rows.length
		? rows.every((r) => selected[r.provider_name])
		: false;

	function toggleAllVisible(next: boolean) {
		const copy = { ...selected };
		for (const r of rows) copy[r.provider_name] = next;
		setSelected(copy);
	}

	function clearSelection() {
		setSelected({});
	}

	function requestEnable(enabled: boolean) {
		const names = selectedNames.length
			? selectedNames
			: rows.map((r) => r.provider_name);
		void onRequestBulk([
			{ kind: 'provider.set_enabled', provider_names: uniq(names), enabled },
		]);
	}

	function openBulkPatch() {
		setBulkTargetNames(
			selectedNames.length
				? uniq(selectedNames)
				: uniq(rows.map((r) => r.provider_name))
		);
		setBulkOpen(true);
	}

	function openCreateProvider() {
		setCreateName('');
		setCreateType('');
		setCreateBaseUrl('');
		setCreateRole('other');
		setCreatePreset('other');
		setCreateHealth('');
		setCreateTimeout('120');
		setCreateLimit('3');
		setCreateDisplayLabel('');
		setCreateApiKeyRequired(false);
		setCreateCostPerRequest('0');
		setCreateFallbackPriority('0');
		setCreateFallbackForCsv('');
		setCreateOpen(true);
	}

	function submitCreateProvider() {
		const name = createName.trim();
		const type = createType.trim();
		if (!name || !type) return;
		const baseUrl = createBaseUrl.trim();
		const health = createHealth.trim();
		const timeout = Number(createTimeout);
		const limit = Number(createLimit);
		const costPerRequest = Number(createCostPerRequest);
		const fallbackPriority = Number(createFallbackPriority);
		const fallbackFor = createFallbackForCsv
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);
		const displayLabel = createDisplayLabel.trim();
		void onRequestBulk([
			{
				kind: 'provider.create',
				provider: {
					provider_name: name,
					provider_type: type,
					base_url: baseUrl || null,
					enabled: true,
					api_key_required: createApiKeyRequired,
					health_endpoint: health || null,
					timeout_seconds: Number.isFinite(timeout) ? timeout : 120,
					max_concurrent: Number.isFinite(limit) ? limit : 3,
					cost_per_request: Number.isFinite(costPerRequest)
						? costPerRequest
						: 0,
					fallback_priority: Number.isFinite(fallbackPriority)
						? fallbackPriority
						: 0,
					fallback_for: fallbackFor,
					display_label: displayLabel || null,
					config_json: {
						provider_role: createRole,
						provider_preset: createPreset,
					},
				},
			},
		]);
		setCreateOpen(false);
	}

	function openProviderEditor(
		providerName: string,
		options?: { autoScanModels?: boolean }
	) {
		setBulkTargetNames([providerName]);
		setBulkAutoScanModels(Boolean(options?.autoScanModels));
		setBulkOpen(true);
	}

	function openSetDefaultModel(providerName: string) {
		setDefaultModelProvider(providerName);
		setDefaultModelValue('');
		setDefaultModelOpen(true);
	}

	function submitSetDefaultModel() {
		if (!defaultModelProvider) return;
		const value = defaultModelValue.trim();
		if (!value) return;
		const provider = snapshot.providers.find(
			(p) => p.provider_name === defaultModelProvider
		);
		const prevConfig =
			provider &&
			typeof provider.config_json === 'object' &&
			provider.config_json
				? provider.config_json
				: {};
		void onRequestBulk([
			{
				kind: 'provider.patch',
				provider_names: [defaultModelProvider],
				patch: {
					config_json: {
						...prevConfig,
						default_model: value,
						provider_role: 'text',
					},
				},
			},
		]);
		setDefaultModelOpen(false);
	}

	function confirmBulkPatch(ops: UgsAdminV2BulkOperation[]) {
		const normalized = ops.map((op) => {
			if ('provider_names' in op) {
				return {
					...op,
					provider_names: uniq(op.provider_names),
				} as UgsAdminV2BulkOperation;
			}
			return op;
		});
		void onRequestBulk(normalized);
		setBulkOpen(false);
	}

	return (
		<div className="space-y-4">
			<div className={ugsAdminV2SectionClass}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<h2 className="text-lg font-semibold">{tr('providers.title')}</h2>
						<p className="mt-1 text-sm text-(--desktop-text-muted)">
							{tr('providers.subtitle')}
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={cn(
								UGS_DESKTOP_BTN.secondary,
								'inline-flex items-center gap-2'
							)}
							onClick={openBulkPatch}
						>
							{tr('common.bulkEdit')}
						</button>
						<button
							type="button"
							className={cn(
								UGS_DESKTOP_BTN.secondary,
								'inline-flex items-center gap-2'
							)}
							onClick={openCreateProvider}
						>
							{tr('providers.addProvider')}
						</button>
						<button
							type="button"
							className={cn(
								UGS_DESKTOP_BTN.secondary,
								'inline-flex items-center gap-2'
							)}
							onClick={() => requestEnable(true)}
						>
							{tr('common.enable')}
						</button>
						<button
							type="button"
							className={cn(
								UGS_DESKTOP_BTN.secondary,
								'inline-flex items-center gap-2'
							)}
							onClick={() => requestEnable(false)}
						>
							{tr('common.disable')}
						</button>
						<button
							type="button"
							className={cn(
								UGS_DESKTOP_BTN.secondary,
								'inline-flex items-center gap-2 text-red-300'
							)}
							disabled={!selectedNames.length}
							onClick={() => setDeleteOpen(true)}
						>
							{tr('common.delete', 'Delete')}
						</button>
						<button
							type="button"
							className={cn(
								UGS_DESKTOP_BTN.secondary,
								'inline-flex items-center gap-2'
							)}
							onClick={clearSelection}
							disabled={!selectedNames.length}
						>
							{tr('common.clearSelection')}
						</button>
					</div>
				</div>
				<div className="mt-4 flex flex-wrap gap-3">
					<div className="min-w-[260px] flex-1">
						<label
							htmlFor="ugs-admin-v2-providers-search"
							className={ugsAdminV2SearchLabelClass}
						>
							{tr('common.search')}
						</label>
						<input
							id="ugs-admin-v2-providers-search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={tr('providers.searchPlaceholder')}
							className={cn('mt-2', ugsAdminV2SearchInputClass)}
						/>
					</div>
					<div className="min-w-[220px]">
						<div className="text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							{tr('common.selected')}
						</div>
						<div className="mt-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-secondary)">
							{selectedNames.length} / {snapshot.providers.length}
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
								<th className="px-4 py-3">{tr('common.name')}</th>
								<th className="px-4 py-3">{tr('common.type')}</th>
								<th className="px-4 py-3">{tr('common.status')}</th>
								<th className="px-4 py-3">Default model</th>
								<th className="px-4 py-3">base_url</th>
								<th className="px-4 py-3">health</th>
								<th className="px-4 py-3">timeout</th>
								<th className="px-4 py-3">{tr('common.limit')}</th>
								<th className="px-4 py-3">actions</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((p) => (
								<tr
									key={p.provider_name}
									className={ugsAdminV2TableRowClass}
									onClick={() => openProviderEditor(p.provider_name)}
								>
									<td className="px-4 py-3">
										<input
											type="checkbox"
											checked={!!selected[p.provider_name]}
											onClick={(e) => e.stopPropagation()}
											onChange={(e) =>
												setSelected((prev) => ({
													...prev,
													[p.provider_name]: e.target.checked,
												}))
											}
										/>
									</td>
									<td className="px-4 py-3 font-semibold text-(--desktop-text-primary)">
										{p.provider_name}
									</td>
									<td className="px-4 py-3 font-mono text-[0.8125rem] text-(--desktop-text-secondary)">
										{p.provider_type}
									</td>
									<td className="px-4 py-3">
										<span
											className={ugsAdminActiveStateBadgeClass(!!p.enabled)}
										>
											{p.enabled ? 'enabled' : 'disabled'}
										</span>
									</td>
									<td className="px-4 py-3 font-mono text-[0.75rem] text-(--desktop-text-secondary)">
										{providerRoleFromConfig(p) === 'text' &&
										typeof p.config_json?.default_model === 'string' &&
										p.config_json.default_model.trim()
											? p.config_json.default_model
											: tr('common.emDash')}
									</td>
									<td className="px-4 py-3 font-mono text-[0.75rem] text-(--desktop-text-secondary)">
										{p.base_url || tr('common.emDash')}
									</td>
									<td className="px-4 py-3 font-mono text-[0.75rem] text-(--desktop-text-secondary)">
										{p.health_endpoint || tr('common.emDash')}
									</td>
									<td className="px-4 py-3 text-(--desktop-text-secondary)">
										{p.timeout_seconds}s
									</td>
									<td className="px-4 py-3 text-(--desktop-text-secondary)">
										{p.max_concurrent}
									</td>
									<td className="px-4 py-3">
										<div className="flex flex-wrap gap-2">
											{providerRoleFromConfig(p) === 'text' ? (
												<Button
													variant="secondary"
													onClick={(e) => {
														e.stopPropagation();
														openProviderEditor(p.provider_name, {
															autoScanModels: true,
														});
													}}
												>
													{tr('providers.scanModels')}
												</Button>
											) : null}
											{providerRoleFromConfig(p) === 'text' ? (
												<Button
													variant="secondary"
													onClick={(e) => {
														e.stopPropagation();
														openSetDefaultModel(p.provider_name);
													}}
												>
													{tr('providers.setDefaultModel')}
												</Button>
											) : null}
										</div>
									</td>
								</tr>
							))}
							{rows.length === 0 ? (
								<tr>
									<td
										colSpan={10}
										className="px-4 py-8 text-center text-(--desktop-text-muted)"
									>
										{tr('common.noResults')}
									</td>
								</tr>
							) : null}
						</tbody>
					</table>
				</div>
				<div
					className={cn(
						ugsAdminV2TableFooterClass,
						'flex items-center justify-between gap-3'
					)}
				>
					<div className="flex items-center gap-2">
						<ArrowPathIcon className="h-4 w-4 opacity-70" aria-hidden />
						<span>
							{tr('common.snapshotAt', {
								date: new Date(snapshot.generated_at).toLocaleString(),
							})}
						</span>
					</div>
					<span>{tr('common.visibleRows', { count: rows.length })}</span>
				</div>
			</div>

			<ProvidersBulkEditModal
				open={bulkOpen}
				snapshot={snapshot}
				targetProviderNames={bulkTargetNames}
				autoScanModels={bulkAutoScanModels}
				onAutoScanModelsConsumed={() => setBulkAutoScanModels(false)}
				onClose={() => setBulkOpen(false)}
				onConfirm={confirmBulkPatch}
			/>

			<Modal
				open={defaultModelOpen}
				title={tr('providers.defaultModelTitle', {
					provider: defaultModelProvider ?? '',
				})}
				onClose={() => setDefaultModelOpen(false)}
				size="lg"
			>
				<div className="space-y-4">
					<InputField
						label="default_model"
						value={defaultModelValue}
						onChange={(e) => setDefaultModelValue(e.target.value)}
						placeholder="model id"
						list="ugs-admin-v2-provider-default-models"
						hint={tr('providers.defaultModelHint')}
					/>
					<datalist id="ugs-admin-v2-provider-default-models">
						{defaultModelProvider
							? providerModels(snapshot, defaultModelProvider).map((m) => (
									<option key={m} value={m} />
								))
							: null}
					</datalist>
					<div className="flex flex-wrap gap-3 pt-2">
						<Button
							variant="secondary"
							onClick={() => setDefaultModelOpen(false)}
						>
							{tr('common.cancel')}
						</Button>
						<Button
							onClick={submitSetDefaultModel}
							disabled={!defaultModelValue.trim()}
						>
							{tr('common.generateChanges')}
						</Button>
					</div>
				</div>
			</Modal>

			<Modal
				open={createOpen}
				title={tr('providers.createTitle')}
				onClose={() => setCreateOpen(false)}
				size="lg"
			>
				<div className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<InputField
							label="provider_name"
							value={createName}
							onChange={(e) => setCreateName(e.target.value)}
							placeholder="my_provider"
						/>
						<InputField
							label="provider_type"
							value={createType}
							onChange={(e) => setCreateType(e.target.value)}
							placeholder="custom_text"
						/>
						<InputField
							label="base_url"
							value={createBaseUrl}
							onChange={(e) => setCreateBaseUrl(e.target.value)}
							placeholder="http://host:port"
						/>
						<label className="text-sm text-(--desktop-text-secondary)">
							<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
								preset
							</span>
							<select
								value={createPreset}
								onChange={(e) => {
									const next = e.target.value as ProviderPreset;
									setCreatePreset(next);
									const p = applyPreset(next);
									setCreateRole(p.role);
									setCreateHealth(p.health_endpoint ?? '');
									setCreateTimeout(String(p.timeout_seconds ?? 120));
									setCreateLimit(String(p.max_concurrent ?? 3));
								}}
								className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
							>
								<option value="text_llm">text: LLM (chat)</option>
								<option value="text_embeddings">text: embeddings</option>
								<option value="text_rerank">text: rerank</option>
								<option value="image_comfyui">image: ComfyUI</option>
								<option value="audio_whisper">audio: Whisper/STT</option>
								<option value="audio_tts">audio: TTS</option>
								<option value="other">other</option>
							</select>
						</label>
						<InputField
							label="health_endpoint"
							value={createHealth}
							onChange={(e) => setCreateHealth(e.target.value)}
							placeholder="/health"
						/>
						<InputField
							label="timeout_seconds"
							value={createTimeout}
							onChange={(e) => setCreateTimeout(e.target.value)}
							placeholder={tr('common.forExample', { value: '120' })}
							inputMode="numeric"
						/>
						<InputField
							label="max_concurrent"
							value={createLimit}
							onChange={(e) => setCreateLimit(e.target.value)}
							placeholder={tr('common.forExample', { value: '3' })}
							inputMode="numeric"
						/>
						<InputField
							label="display_label"
							value={createDisplayLabel}
							onChange={(e) => setCreateDisplayLabel(e.target.value)}
							placeholder={tr('bulkEditProviders.displayLabelPlaceholder')}
						/>
						<InputField
							label="cost_per_request"
							value={createCostPerRequest}
							onChange={(e) => setCreateCostPerRequest(e.target.value)}
							inputMode="decimal"
						/>
						<InputField
							label="fallback_priority"
							value={createFallbackPriority}
							onChange={(e) => setCreateFallbackPriority(e.target.value)}
							inputMode="numeric"
						/>
						<InputField
							label="fallback_for"
							value={createFallbackForCsv}
							onChange={(e) => setCreateFallbackForCsv(e.target.value)}
							hint={tr('bulkEditProviders.fallbackForHint')}
						/>
						<label className="inline-flex items-center gap-2 text-sm text-(--desktop-text-secondary) sm:col-span-2">
							<input
								type="checkbox"
								checked={createApiKeyRequired}
								onChange={(e) => setCreateApiKeyRequired(e.target.checked)}
							/>
							api_key_required
						</label>
						<label className="text-sm text-(--desktop-text-secondary)">
							<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
								provider_role
							</span>
							<select
								value={createRole}
								onChange={(e) => setCreateRole(e.target.value as ProviderRole)}
								className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
							>
								<option value="text">text</option>
								<option value="image">image</option>
								<option value="audio">audio</option>
								<option value="other">other</option>
							</select>
							<div className="mt-1 text-xs text-(--desktop-text-muted)">
								{tr('providers.providerRoleHint')}
							</div>
						</label>
					</div>
					<div className="flex flex-wrap gap-3 pt-2">
						<Button variant="secondary" onClick={() => setCreateOpen(false)}>
							{tr('common.cancel')}
						</Button>
						<Button
							onClick={submitCreateProvider}
							disabled={!createName.trim() || !createType.trim()}
						>
							{tr('common.generateChanges')}
						</Button>
					</div>
				</div>
			</Modal>

			<DangerConfirmModal
				open={deleteOpen}
				title={tr('providers.deleteTitle', 'Delete selected providers')}
				description={tr(
					'providers.deleteBody',
					'Hard-deletes {{count}} provider(s) via legacy admin DELETE. This cannot be undone.',
					{ count: selectedNames.length }
				)}
				confirmPhrase="DELETE"
				busy={deleteBusy}
				onCancel={() => setDeleteOpen(false)}
				onConfirm={() =>
					void (async () => {
						setDeleteBusy(true);
						try {
							for (const name of selectedNames) {
								await deleteProvider(name);
							}
							setDeleteOpen(false);
							setSelected({});
							await queryClient.invalidateQueries({
								queryKey: UGS_ADMIN_V2_SNAPSHOT_QUERY_KEY,
							});
							toast.success(tr('providers.deleteDone', 'Providers deleted'));
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
