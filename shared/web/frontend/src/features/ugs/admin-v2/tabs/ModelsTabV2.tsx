/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Admin v2 models tab: DB-backed model routes, provider defaults, inventory, and config-source audit.
 *
 * Invariants:
 * - Model changes create bulk operations; direct per-type `model_name` editing is not exposed.
 *
 * Related:
 * - src/services/api/ugsAdminV2.ts
 * - src/features/ugs/admin-v2/UGSAdminV2PanelBody.tsx
 */

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	UGS_DESKTOP_BTN,
	UGS_SEVERITY_BADGE,
} from '@/features/ugs/shared/ugsDesktopUi';
import { cn } from '@/utils/cn';

import {
	ugsAdminV2SectionClass,
	ugsAdminV2TableHeadClass,
	ugsAdminV2TableRowClass,
	ugsAdminV2TableWrapClass,
} from '../ugsAdminV2Ui';
import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';
import { getLlamaModels } from '@/services/api/ugsAdmin';
import { jsonString } from '@/features/ugs/shared/ugsAdminUi';
import type {
	UgsAdminV2BulkOperation,
	UgsAdminV2ModelRoutesDTO,
	UgsAdminV2SnapshotDTO,
} from '@/services/api/ugsAdminV2';

import {
	allowlistCsvFromRoutes,
	buildAllowlistPatch,
	buildModelRoutesReplaceOperation,
	emptyRoutesPatch,
} from '../components/modelRoutesUtils';

const TEXT_MODEL_PROVIDER_TYPES = new Set(['llama', 'llama', 'miso']);

export function ModelsTabV2({
	snapshot,
	onRequestBulk,
}: {
	snapshot: UgsAdminV2SnapshotDTO;
	onRequestBulk: (ops: UgsAdminV2BulkOperation[]) => void | Promise<void>;
}): React.ReactElement {
	const { t } = useTranslation(UGS_ADMIN_V2_NS);
	const [scope, setScope] = useState<
		'global' | 'provider' | 'category' | 'domain' | 'type'
	>('global');
	const [routeKey, setRouteKey] = useState('');
	const [model, setModel] = useState(
		snapshot.model_routes.global_default_model ?? ''
	);
	const [providerName, setProviderName] = useState(
		snapshot.providers[0]?.provider_name ?? ''
	);
	const [providerDefaultModel, setProviderDefaultModel] = useState('');
	const [selectedRecommendations, setSelectedRecommendations] = useState<
		Record<string, boolean>
	>({});
	const [discoverProvider, setDiscoverProvider] = useState('');
	const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
	const [discovering, setDiscovering] = useState(false);
	const [discoverError, setDiscoverError] = useState<string | null>(null);
	const [allowlistCsv, setAllowlistCsv] = useState('');
	const [replaceRoutesRaw, setReplaceRoutesRaw] = useState('');
	const [replaceRoutesErrors, setReplaceRoutesErrors] = useState<string[]>([]);
	const [importOverwrite, setImportOverwrite] = useState(false);

	const textProviders = useMemo(
		() =>
			snapshot.providers.filter((provider) =>
				TEXT_MODEL_PROVIDER_TYPES.has(
					String(provider.provider_type ?? '')
						.trim()
						.toLowerCase()
				)
			),
		[snapshot.providers]
	);

	useEffect(() => {
		setDiscoverProvider((current) => {
			if (current && textProviders.some((p) => p.provider_name === current)) {
				return current;
			}
			return textProviders[0]?.provider_name ?? '';
		});
	}, [textProviders]);

	useEffect(() => {
		setModel(snapshot.model_routes.global_default_model ?? '');
		setProviderName(snapshot.providers[0]?.provider_name ?? '');
		setRouteKey('');
		setAllowlistCsv(allowlistCsvFromRoutes(snapshot.model_routes));
		setReplaceRoutesRaw(jsonString(snapshot.model_routes));
	}, [snapshot.model_routes, snapshot.providers]);

	const models = useMemo(
		() =>
			Array.from(
				new Set([
					...snapshot.model_inventory.map((m) => m.model_id),
					...discoveredModels,
				])
			).sort(),
		[snapshot.model_inventory, discoveredModels]
	);
	const affectedTypes = useMemo(() => {
		if (scope === 'global') return snapshot.types.length;
		if (!routeKey.trim()) return 0;
		if (scope === 'provider')
			return snapshot.types.filter((t) => t.provider === routeKey).length;
		if (scope === 'category')
			return snapshot.types.filter((t) => t.category === routeKey).length;
		if (scope === 'domain') {
			return snapshot.resolved_models_by_type.filter(
				(r) => r.domain === routeKey
			).length;
		}
		return snapshot.types.some((t) => t.type_key === routeKey) ? 1 : 0;
	}, [routeKey, scope, snapshot.resolved_models_by_type, snapshot.types]);

	function currentScopedRouteValue(): string | null {
		if (scope === 'global')
			return snapshot.model_routes.global_default_model ?? null;
		const key = routeKey.trim();
		if (!key) return null;
		if (scope === 'provider')
			return snapshot.model_routes.provider_defaults[key] ?? null;
		if (scope === 'category')
			return snapshot.model_routes.category_defaults[key] ?? null;
		if (scope === 'domain')
			return snapshot.model_routes.domain_defaults[key] ?? null;
		return snapshot.model_routes.type_overrides[key] ?? null;
	}

	function buildRoutesPatch(
		nextValue: string | null
	): UgsAdminV2ModelRoutesDTO {
		const routes = emptyRoutesPatch();
		const nextModel = model.trim();
		const value = nextValue === null ? null : nextModel;
		if (scope === 'global') routes.global_default_model = value ?? '';
		if (scope === 'provider' && routeKey.trim())
			routes.provider_defaults[routeKey.trim()] = value;
		if (scope === 'category' && routeKey.trim())
			routes.category_defaults[routeKey.trim()] = value;
		if (scope === 'domain' && routeKey.trim())
			routes.domain_defaults[routeKey.trim()] = value;
		if (scope === 'type' && routeKey.trim())
			routes.type_overrides[routeKey.trim()] = value;
		return routes;
	}

	function requestRoutePatch() {
		void onRequestBulk([
			{ kind: 'model_routes.patch', routes: buildRoutesPatch(model.trim()) },
		]);
	}

	function requestRouteDelete() {
		void onRequestBulk([
			{ kind: 'model_routes.patch', routes: buildRoutesPatch(null) },
		]);
	}

	function requestProviderDefault() {
		if (!providerName || !providerDefaultModel.trim()) return;
		void onRequestBulk([
			{
				kind: 'provider.default_model.set',
				provider_names: [providerName],
				default_model: providerDefaultModel.trim(),
			},
		]);
	}

	function requestProviderModelsRefresh() {
		if (!providerName) return;
		void onRequestBulk([
			{ kind: 'provider.models.refresh', provider_names: [providerName] },
		]);
	}

	function requestWorkflowImport() {
		void onRequestBulk([
			{
				kind: 'workflow.import_from_disk',
				overwrite_existing: importOverwrite,
			},
		]);
	}

	function requestAllowlistPatch() {
		void onRequestBulk([
			{
				kind: 'model_routes.patch',
				routes: buildAllowlistPatch(allowlistCsv),
			},
		]);
	}

	function requestRoutesReplace() {
		const { operation, errors } = buildModelRoutesReplaceOperation(
			replaceRoutesRaw,
			t('validation.invalidJson')
		);
		if (errors.length || !operation) {
			setReplaceRoutesErrors(errors);
			return;
		}
		setReplaceRoutesErrors([]);
		void onRequestBulk([operation]);
	}

	function toggleRecommendation(id: string, checked: boolean) {
		setSelectedRecommendations((prev) => ({ ...prev, [id]: checked }));
	}

	function requestSelectedRecommendations() {
		const operations = snapshot.autofix_recommendations
			.filter((item) => selectedRecommendations[item.id])
			.flatMap((item) => item.operations);
		if (!operations.length) return;
		void onRequestBulk(operations);
	}

	async function discoverLlamaModels() {
		const provider = textProviders.find(
			(item) => item.provider_name === discoverProvider
		);
		const baseUrl = provider?.base_url?.trim();
		if (!baseUrl) {
			setDiscoverError(t('validation.baseUrlRequiredBeforeScan'));
			return;
		}
		setDiscovering(true);
		setDiscoverError(null);
		try {
			const liveModels = await getLlamaModels(baseUrl);
			setDiscoveredModels(liveModels);
		} catch (err) {
			setDiscoverError(
				err instanceof Error ? err.message : t('validation.modelsFetchFailed')
			);
		} finally {
			setDiscovering(false);
		}
	}

	function requestDiscoverProviderRefresh() {
		if (!discoverProvider) return;
		void onRequestBulk([
			{ kind: 'provider.models.refresh', provider_names: [discoverProvider] },
		]);
	}

	const currentRouteValue = currentScopedRouteValue();
	const routeIssues = snapshot.issues.filter(
		(issue) => issue.entity_type === 'model_route'
	);

	return (
		<div className="space-y-4">
			<div className={ugsAdminV2SectionClass}>
				<h2 className="text-lg font-semibold">{t('models.title')}</h2>
				<p className="mt-1 text-sm text-(--desktop-text-muted)">
					{t('models.subtitle')}
				</p>
				<div className="mt-5 grid gap-4 lg:grid-cols-5">
					<label className="text-sm text-(--desktop-text-secondary)">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							scope
						</span>
						<select
							value={scope}
							onChange={(e) => setScope(e.target.value as typeof scope)}
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
						>
							<option value="global">global</option>
							<option value="provider">provider</option>
							<option value="category">category</option>
							<option value="domain">domain</option>
							<option value="type">type exception</option>
						</select>
					</label>
					<label className="text-sm text-(--desktop-text-secondary) lg:col-span-2">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							route key
						</span>
						<input
							value={routeKey}
							onChange={(e) => setRouteKey(e.target.value)}
							disabled={scope === 'global'}
							placeholder="provider/category/domain/type_key"
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary) disabled:opacity-50"
						/>
					</label>
					<label className="text-sm text-(--desktop-text-secondary) lg:col-span-2">
						<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
							model
						</span>
						<input
							list="ugs-admin-v2-models"
							value={model}
							onChange={(e) => setModel(e.target.value)}
							placeholder="model id"
							className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary) placeholder:opacity-55"
						/>
						<datalist id="ugs-admin-v2-models">
							{models.map((m) => (
								<option key={m} value={m} />
							))}
						</datalist>
					</label>
				</div>
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<button
						type="button"
						className={UGS_DESKTOP_BTN.primary}
						onClick={requestRoutePatch}
						disabled={scope !== 'global' && !routeKey.trim()}
					>
						{t('models.saveRoute')}
					</button>
					<button
						type="button"
						className={UGS_DESKTOP_BTN.danger}
						onClick={requestRouteDelete}
						disabled={
							(scope !== 'global' && !routeKey.trim()) || !currentRouteValue
						}
					>
						{t('models.deleteRoute')}
					</button>
					<span className="text-sm text-(--desktop-text-muted)">
						{t('models.previewAffectedTypes', { count: affectedTypes })}
						{currentRouteValue
							? t('models.currentRoute', { value: currentRouteValue })
							: ''}
					</span>
				</div>
			</div>

			<div className={ugsAdminV2SectionClass}>
				<h3 className="font-semibold">{t('models.allowlistTitle')}</h3>
				<p className="mt-1 text-sm text-(--desktop-text-muted)">
					{t('models.allowlistHint')}
				</p>
				<label className="mt-4 block text-sm text-(--desktop-text-secondary)">
					<span className="block text-xs font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
						request_model_override_allowlist
					</span>
					<input
						value={allowlistCsv}
						onChange={(e) => setAllowlistCsv(e.target.value)}
						placeholder="model-a, model-b"
						className="mt-2 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 font-mono text-sm text-(--desktop-text-primary) placeholder:opacity-55"
					/>
				</label>
				<button
					type="button"
					className={cn('mt-4', UGS_DESKTOP_BTN.secondary)}
					onClick={requestAllowlistPatch}
				>
					{t('models.saveAllowlist')}
				</button>
			</div>

			<div
				className={cn(
					ugsAdminV2SectionClass,
					'border-amber-500/35 bg-amber-500/10'
				)}
			>
				<h3 className="font-semibold text-amber-950 dark:text-amber-100">
					{t('models.replaceRoutesTitle')}
				</h3>
				<p className="mt-1 text-sm text-amber-950/80 dark:text-amber-100/80">
					{t('models.replaceRoutesHint')}
				</p>
				<textarea
					value={replaceRoutesRaw}
					onChange={(e) => setReplaceRoutesRaw(e.target.value)}
					rows={14}
					className="mt-4 w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 font-mono text-xs text-(--desktop-text-primary)"
				/>
				{replaceRoutesErrors.length ? (
					<ul className="mt-3 space-y-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
						{replaceRoutesErrors.map((err) => (
							<li key={err}>{err}</li>
						))}
					</ul>
				) : null}
				<div className="mt-4 flex flex-wrap gap-3">
					<button
						type="button"
						className={UGS_DESKTOP_BTN.danger}
						onClick={requestRoutesReplace}
					>
						{t('models.replaceRoutes')}
					</button>
					<button
						type="button"
						className={UGS_DESKTOP_BTN.secondary}
						onClick={() => {
							setReplaceRoutesRaw(jsonString(snapshot.model_routes));
							setReplaceRoutesErrors([]);
						}}
					>
						{t('models.resetRoutesEditor')}
					</button>
				</div>
			</div>

			<div className={ugsAdminV2SectionClass}>
				<h3 className="font-semibold">{t('models.discoveryTitle')}</h3>
				<p className="mt-1 text-sm text-(--desktop-text-muted)">
					{t('models.discoveryHint')}
				</p>
				<div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
					<select
						value={discoverProvider}
						onChange={(e) => setDiscoverProvider(e.target.value)}
						className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
					>
						{textProviders.map((provider) => (
							<option
								key={provider.provider_name}
								value={provider.provider_name}
							>
								{provider.provider_name}
							</option>
						))}
					</select>
					<button
						type="button"
						className={UGS_DESKTOP_BTN.secondary}
						onClick={() => void discoverLlamaModels()}
						disabled={discovering || !discoverProvider}
					>
						{discovering
							? t('bulkEditProviders.scanning')
							: t('models.discoverModels')}
					</button>
					<button
						type="button"
						className={UGS_DESKTOP_BTN.secondary}
						onClick={requestDiscoverProviderRefresh}
						disabled={!discoverProvider}
					>
						{t('models.scanModelsToDb')}
					</button>
				</div>
				{discoverError ? (
					<p className="mt-3 text-sm text-red-600 dark:text-red-300">
						{discoverError}
					</p>
				) : null}
				{discoveredModels.length ? (
					<p className="mt-3 text-sm text-(--desktop-text-muted)">
						{t('bulkEditProviders.modelsFound', {
							count: discoveredModels.length,
						})}
					</p>
				) : null}
			</div>

			{routeIssues.length ? (
				<div
					className={cn(
						ugsAdminV2SectionClass,
						'border-amber-500/35 bg-amber-500/10'
					)}
				>
					<h3 className="font-semibold text-amber-950 dark:text-amber-100">
						{t('models.routingWarnings')}
					</h3>
					<div className="mt-3 grid gap-2">
						{routeIssues.slice(0, 8).map((issue) => (
							<div
								key={`${issue.entity_id}:${issue.field}:${issue.message}`}
								className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/90 p-3 text-sm"
							>
								<div className="font-mono text-xs text-(--desktop-text-muted)">
									{issue.entity_id}
									{issue.field ? ` · ${issue.field}` : ''}
								</div>
								<div className="mt-1 text-(--desktop-text-secondary)">
									{issue.message}
								</div>
							</div>
						))}
					</div>
				</div>
			) : null}

			<div className={ugsAdminV2SectionClass}>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 className="font-semibold">
							{t('models.recommendationsTitle')}
						</h3>
						<p className="mt-1 text-sm text-(--desktop-text-muted)">
							{t('models.recommendationsHint')}
						</p>
					</div>
					<button
						type="button"
						className={cn(
							UGS_DESKTOP_BTN.primary,
							'disabled:cursor-not-allowed disabled:opacity-50'
						)}
						disabled={
							!snapshot.autofix_recommendations.some(
								(item) => selectedRecommendations[item.id]
							)
						}
						onClick={requestSelectedRecommendations}
					>
						{t('models.applySelected')}
					</button>
				</div>
				<div className="mt-4 grid gap-3">
					{snapshot.autofix_recommendations.length ? (
						snapshot.autofix_recommendations.map((item) => (
							<label
								key={item.id}
								className="flex gap-3 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 text-sm"
							>
								<input
									type="checkbox"
									checked={!!selectedRecommendations[item.id]}
									onChange={(e) =>
										toggleRecommendation(item.id, e.target.checked)
									}
									className="mt-1"
								/>
								<span className="min-w-0 flex-1">
									<span className="flex flex-wrap items-center gap-2">
										<span className="font-medium text-(--desktop-text-primary)">
											{item.title}
										</span>
										<span
											className={
												item.severity === 'error'
													? UGS_SEVERITY_BADGE.error
													: item.severity === 'warning'
														? UGS_SEVERITY_BADGE.warning
														: UGS_SEVERITY_BADGE.info
											}
										>
											{item.severity}
										</span>
										<span className="text-xs text-(--desktop-text-muted)">
											{t('models.operationsAffected', {
												operations: item.operations.length,
												affected: item.affected_count,
											})}
										</span>
									</span>
									<span className="mt-1 block text-(--desktop-text-muted)">
										{item.description}
									</span>
								</span>
							</label>
						))
					) : (
						<div className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 text-sm text-(--desktop-text-muted)">
							{t('models.noAutofixNeeded')}
						</div>
					)}
				</div>
			</div>

			<div className="grid gap-4 xl:grid-cols-2">
				<div className={ugsAdminV2SectionClass}>
					<h3 className="font-semibold">{t('models.providerDefaultTitle')}</h3>
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						<select
							value={providerName}
							onChange={(e) => setProviderName(e.target.value)}
							className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary)"
						>
							{snapshot.providers.map((p) => (
								<option key={p.provider_name} value={p.provider_name}>
									{p.provider_name}
								</option>
							))}
						</select>
						<input
							list="ugs-admin-v2-models"
							value={providerDefaultModel}
							onChange={(e) => setProviderDefaultModel(e.target.value)}
							placeholder="default_model"
							className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-(--desktop-text-primary) placeholder:opacity-55"
						/>
					</div>
					<button
						type="button"
						className={UGS_DESKTOP_BTN.secondary}
						onClick={requestProviderDefault}
					>
						{t('models.setDefaultModel')}
					</button>
					<button
						type="button"
						className={cn('mt-4 ml-2', UGS_DESKTOP_BTN.secondary)}
						onClick={requestProviderModelsRefresh}
					>
						{t('models.scanModelsToDb')}
					</button>
				</div>

				<div className={ugsAdminV2SectionClass}>
					<h3 className="font-semibold">
						{t('models.workflowMaterializationTitle')}
					</h3>
					<p className="mt-2 text-sm text-(--desktop-text-muted)">
						{t('models.workflowMaterializationHint')}
					</p>
					<label className="mt-4 inline-flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
						<input
							type="checkbox"
							checked={importOverwrite}
							onChange={(e) => setImportOverwrite(e.target.checked)}
						/>
						{t('workflows.overwriteExisting')}
					</label>
					<button
						type="button"
						className={cn('mt-4', UGS_DESKTOP_BTN.secondary)}
						onClick={requestWorkflowImport}
					>
						{t('models.materializeWorkflows')}
					</button>
				</div>
			</div>

			<div className={ugsAdminV2SectionClass}>
				<h3 className="font-semibold">{t('models.resolvedModelsTitle')}</h3>
				<div className={cn(ugsAdminV2TableWrapClass, 'mt-4 max-h-80')}>
					<div className="overflow-auto">
						<table className="min-w-[920px] w-full text-left text-sm">
							<thead className={ugsAdminV2TableHeadClass}>
								<tr>
									<th className="px-4 py-3">type_key</th>
									<th className="px-4 py-3">provider</th>
									<th className="px-4 py-3">domain</th>
									<th className="px-4 py-3">resolved_model</th>
									<th className="px-4 py-3">source</th>
								</tr>
							</thead>
							<tbody>
								{snapshot.resolved_models_by_type.map((r) => (
									<tr key={r.type_key} className={ugsAdminV2TableRowClass}>
										<td className="px-4 py-3 font-mono text-(--desktop-text-primary)">
											{r.type_key}
										</td>
										<td className="px-4 py-3 text-(--desktop-text-secondary)">
											{r.provider}
										</td>
										<td className="px-4 py-3 text-(--desktop-text-secondary)">
											{r.domain || t('common.emDash')}
										</td>
										<td className="px-4 py-3 font-mono text-(--desktop-text-secondary)">
											{r.resolved_model || t('common.emDash')}
										</td>
										<td className="px-4 py-3 text-(--desktop-text-muted)">
											{r.source}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div className={ugsAdminV2SectionClass}>
				<h3 className="font-semibold">{t('models.configSourceTitle')}</h3>
				<div className="mt-4 grid gap-2">
					{snapshot.config_source_audit.map((item) => (
						<div
							key={item.key}
							className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 text-sm"
						>
							<div className="flex flex-wrap gap-2">
								<span className={UGS_SEVERITY_BADGE.warning}>
									{item.source_type}
								</span>
								<span className="font-mono text-(--desktop-text-secondary)">
									{item.key}
								</span>
							</div>
							<p className="mt-1 text-(--desktop-text-secondary)">
								{item.message}
							</p>
							{item.recommendation ? (
								<p className="mt-1 text-(--desktop-text-muted)">
									{item.recommendation}
								</p>
							) : null}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
