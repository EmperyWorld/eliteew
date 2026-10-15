/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * State, validation, and bulk-operation preview builder for UGS Admin v2 provider bulk edit modal.
 *
 * Invariants:
 * - Does not apply changes; only builds ops for validate/apply confirmation flow.
 * - config_json merge/replace modes produce per-provider ops when merging into existing config.
 *
 * Related:
 * - src/features/ugs/admin-v2/components/ProvidersBulkEditModal.tsx
 * - src/features/ugs/admin-v2/components/providersBulkEditUtils.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';
import { getLlamaModels } from '@/services/api/ugsAdmin';
import type {
	UgsAdminV2BulkOperation,
	UgsAdminV2ModelRoutesDTO,
	UgsAdminV2SnapshotDTO,
} from '@/services/api/ugsAdminV2';

import {
	type Baseline,
	type ProviderRole,
	TEXT_MODEL_PROVIDER_TYPES,
	type TriBool,
	cleanNonTextProviderConfig,
	commonValue,
	mergeConfigJson,
	normalizeListCSV,
	parseTriBool,
	providerSupportsTextModelFields,
	safeJsonParseObject,
	toTriBool,
} from '../components/providersBulkEditUtils';

export type UseProvidersBulkEditStateParams = {
	open: boolean;
	snapshot: UgsAdminV2SnapshotDTO;
	targetProviderNames: string[];
	autoScanModels?: boolean;
	onAutoScanModelsConsumed?: () => void;
	onConfirm: (ops: UgsAdminV2BulkOperation[]) => void;
};

export function useProvidersBulkEditState({
	open,
	snapshot,
	targetProviderNames,
	autoScanModels = false,
	onAutoScanModelsConsumed,
	onConfirm,
}: UseProvidersBulkEditStateParams) {
	const { t } = useTranslation(UGS_ADMIN_V2_NS);

	const [displayLabel, setDisplayLabel] = useState('');
	const [baseUrl, setBaseUrl] = useState('');
	const [healthEndpoint, setHealthEndpoint] = useState('');
	const [apiKeyRequired, setApiKeyRequired] = useState<TriBool>('');
	const [enabled, setEnabled] = useState<TriBool>('');
	const [timeoutSeconds, setTimeoutSeconds] = useState('');
	const [maxConcurrent, setMaxConcurrent] = useState('');
	const [costPerRequest, setCostPerRequest] = useState('');
	const [fallbackPriority, setFallbackPriority] = useState('');
	const [fallbackForCSV, setFallbackForCSV] = useState('');

	const [defaultModel, setDefaultModel] = useState('');
	const [modelsCSV, setModelsCSV] = useState('');
	const [providerRole, setProviderRole] = useState<ProviderRole>('');

	const [configMode, setConfigMode] = useState<'none' | 'merge' | 'replace'>(
		'none'
	);
	const [configJsonRaw, setConfigJsonRaw] = useState('');
	const [baseline, setBaseline] = useState<Baseline | null>(null);
	const [scanLoading, setScanLoading] = useState(false);
	const [scanError, setScanError] = useState<string | null>(null);
	const [scannedModels, setScannedModels] = useState<string[]>([]);

	const providersByName = useMemo(() => {
		const map = new Map<string, (typeof snapshot.providers)[number]>();
		for (const p of snapshot.providers) map.set(p.provider_name, p);
		return map;
	}, [snapshot.providers]);

	const targetProviders = useMemo(
		() =>
			targetProviderNames
				.map((name) => providersByName.get(name))
				.filter(Boolean) as (typeof snapshot.providers)[number][],
		[providersByName, targetProviderNames]
	);

	const typesForSingleProvider = useMemo(() => {
		if (targetProviders.length !== 1) return [];
		const providerName = targetProviders[0]?.provider_name;
		return snapshot.types.filter((t) => t.provider === providerName);
	}, [snapshot.types, targetProviders]);

	const knownProviderNames = useMemo(
		() => snapshot.providers.map((p) => p.provider_name).sort(),
		[snapshot.providers]
	);

	const configJsonParsed = useMemo(
		() => safeJsonParseObject(configJsonRaw),
		[configJsonRaw]
	);

	const targetSupportsTextModelFields = useMemo(
		() =>
			targetProviders.length > 0 &&
			targetProviders.every(providerSupportsTextModelFields),
		[targetProviders]
	);

	const clientErrors = useMemo(() => {
		const errors: string[] = [];
		if (baseUrl.trim() && !/^https?:\/\//i.test(baseUrl.trim())) {
			errors.push(t('validation.baseUrlMustStartWithHttp'));
		}
		if (healthEndpoint.trim() && !healthEndpoint.trim().startsWith('/')) {
			errors.push(t('validation.healthEndpointMustStartWithSlash'));
		}
		if (configMode !== 'none' && configJsonParsed.errorKey) {
			errors.push(
				t('validation.configJsonError', {
					error: t(`validation.${configJsonParsed.errorKey}`),
				})
			);
		}
		if (!targetSupportsTextModelFields) {
			if (providerRole === 'text') {
				errors.push(t('validation.providerRoleTextOnlyForTextTypes'));
			}
			if (defaultModel.trim() || modelsCSV.trim()) {
				errors.push(t('validation.defaultModelModelsOnlyForTextTypes'));
			}
			const parsedConfig = configJsonParsed.value;
			if (
				configMode !== 'none' &&
				parsedConfig &&
				('default_model' in parsedConfig ||
					'models' in parsedConfig ||
					parsedConfig.provider_role === 'text')
			) {
				errors.push(t('validation.configJsonNoModelFieldsForNonText'));
			}
		}
		return errors;
	}, [
		baseUrl,
		configJsonParsed.errorKey,
		configJsonParsed.value,
		configMode,
		defaultModel,
		healthEndpoint,
		modelsCSV,
		providerRole,
		t,
		targetSupportsTextModelFields,
	]);

	useEffect(() => {
		if (!open) return;

		const base: Baseline = {
			display_label: commonValue(
				targetProviders.map((p) => p.display_label ?? null)
			),
			base_url: commonValue(targetProviders.map((p) => p.base_url ?? null)),
			health_endpoint: commonValue(
				targetProviders.map((p) => p.health_endpoint ?? null)
			),
			api_key_required: commonValue(
				targetProviders.map((p) => p.api_key_required ?? null)
			),
			enabled: commonValue(targetProviders.map((p) => p.enabled ?? null)),
			timeout_seconds: commonValue(
				targetProviders.map((p) => p.timeout_seconds ?? null)
			),
			max_concurrent: commonValue(
				targetProviders.map((p) => p.max_concurrent ?? null)
			),
			cost_per_request: commonValue(
				targetProviders.map((p) => p.cost_per_request ?? null)
			),
			fallback_priority: commonValue(
				targetProviders.map((p) => p.fallback_priority ?? null)
			),
			fallback_for: commonValue(
				targetProviders.map((p) => p.fallback_for ?? null)
			),
			default_model: commonValue(
				targetProviders.map((p) =>
					typeof p.config_json?.default_model === 'string'
						? (p.config_json.default_model as string)
						: null
				)
			),
			models: commonValue(
				targetProviders.map((p) => {
					const raw = p.config_json?.models;
					if (!Array.isArray(raw)) return null;
					return raw.filter((x) => typeof x === 'string') as string[];
				})
			),
			config_json:
				targetProviders.length === 1
					? ((targetProviders[0].config_json ?? {}) as Record<string, unknown>)
					: null,
		};

		setBaseline(base);

		setDisplayLabel(base.display_label ?? '');
		setBaseUrl(base.base_url ?? '');
		setHealthEndpoint(base.health_endpoint ?? '');
		setApiKeyRequired(toTriBool(base.api_key_required));
		setEnabled(toTriBool(base.enabled));
		setTimeoutSeconds(
			base.timeout_seconds != null ? String(base.timeout_seconds) : ''
		);
		setMaxConcurrent(
			base.max_concurrent != null ? String(base.max_concurrent) : ''
		);
		setCostPerRequest(
			base.cost_per_request != null ? String(base.cost_per_request) : ''
		);
		setFallbackPriority(
			base.fallback_priority != null ? String(base.fallback_priority) : ''
		);
		setFallbackForCSV(base.fallback_for ? base.fallback_for.join(', ') : '');

		setDefaultModel(base.default_model ?? '');
		setModelsCSV(base.models ? base.models.join(', ') : '');
		setProviderRole(
			targetProviders.length === 1 &&
				typeof targetProviders[0]?.config_json?.provider_role === 'string' &&
				['text', 'image', 'audio', 'other'].includes(
					targetProviders[0]?.config_json?.provider_role as string
				)
				? (targetProviders[0]?.config_json?.provider_role as ProviderRole)
				: ''
		);

		setConfigMode('none');
		setConfigJsonRaw(
			base.config_json && Object.keys(base.config_json).length
				? JSON.stringify(base.config_json, null, 2)
				: ''
		);
	}, [open, targetProviders]);

	const singleProviderName =
		targetProviders.length === 1 ? targetProviders[0]?.provider_name : null;
	const singleProviderType =
		targetProviders.length === 1 ? targetProviders[0]?.provider_type : null;

	const effectiveRole: Exclude<ProviderRole, ''> = useMemo(() => {
		const pt = (singleProviderType ?? '').trim().toLowerCase();
		if (singleProviderType && !TEXT_MODEL_PROVIDER_TYPES.has(pt))
			return 'other';
		if (providerRole) return providerRole;
		if (TEXT_MODEL_PROVIDER_TYPES.has(pt)) return 'text';
		return 'other';
	}, [providerRole, singleProviderType]);

	const scanModelsNow = useCallback(async (): Promise<void> => {
		const url = (baseUrl || '').trim().replace(/\/$/, '');
		if (!url) {
			setScanError(t('validation.baseUrlRequiredBeforeScan'));
			return;
		}
		if (effectiveRole !== 'text') {
			setScanError(t('validation.scanOnlyForTextRole'));
			return;
		}
		setScanLoading(true);
		setScanError(null);
		try {
			const models = await getLlamaModels(url);
			setScannedModels(models);
			if (models.length) {
				setModelsCSV(models.join(', '));
			}
		} catch (err) {
			setScannedModels([]);
			setScanError(
				err instanceof Error ? err.message : t('validation.modelsFetchFailed')
			);
		} finally {
			setScanLoading(false);
		}
	}, [baseUrl, effectiveRole, t]);

	useEffect(() => {
		if (!open) return;
		if (!autoScanModels) return;
		if (targetProviders.length !== 1) return;
		void scanModelsNow().finally(() => onAutoScanModelsConsumed?.());
	}, [
		open,
		autoScanModels,
		targetProviders.length,
		scanModelsNow,
		onAutoScanModelsConsumed,
	]);

	const previewOps = useMemo((): UgsAdminV2BulkOperation[] => {
		const base = baseline;
		const patch: Record<string, unknown> = {};

		const nextDisplayLabel = displayLabel.trim();
		if (nextDisplayLabel && nextDisplayLabel !== (base?.display_label ?? '')) {
			patch.display_label = nextDisplayLabel;
		}
		const nextBaseUrl = baseUrl.trim();
		if (nextBaseUrl && nextBaseUrl !== (base?.base_url ?? '')) {
			patch.base_url = nextBaseUrl;
		}
		const nextHealth = healthEndpoint.trim();
		if (nextHealth && nextHealth !== (base?.health_endpoint ?? '')) {
			patch.health_endpoint = nextHealth;
		}

		const apiKey = parseTriBool(apiKeyRequired);
		if (apiKey !== null && apiKey !== (base?.api_key_required ?? null)) {
			patch.api_key_required = apiKey;
		}

		if (timeoutSeconds.trim()) {
			const n = Number(timeoutSeconds);
			if (Number.isFinite(n) && n !== (base?.timeout_seconds ?? null)) {
				patch.timeout_seconds = n;
			}
		}
		if (maxConcurrent.trim()) {
			const n = Number(maxConcurrent);
			if (Number.isFinite(n) && n !== (base?.max_concurrent ?? null)) {
				patch.max_concurrent = n;
			}
		}
		if (costPerRequest.trim()) {
			const n = Number(costPerRequest);
			if (Number.isFinite(n) && n !== (base?.cost_per_request ?? null)) {
				patch.cost_per_request = n;
			}
		}
		if (fallbackPriority.trim()) {
			const n = Number(fallbackPriority);
			if (Number.isFinite(n) && n !== (base?.fallback_priority ?? null)) {
				patch.fallback_priority = n;
			}
		}

		const fallbackFor = normalizeListCSV(fallbackForCSV);
		if (
			fallbackFor &&
			JSON.stringify(fallbackFor) !== JSON.stringify(base?.fallback_for ?? null)
		) {
			patch.fallback_for = fallbackFor;
		}

		const configPatch: Record<string, unknown> = {};
		if (providerRole) {
			configPatch.provider_role = providerRole;
		}
		if (
			effectiveRole === 'text' &&
			defaultModel.trim() &&
			defaultModel.trim() !== (base?.default_model ?? '')
		) {
			configPatch.default_model = defaultModel.trim();
		}
		const models = normalizeListCSV(modelsCSV);
		if (
			effectiveRole === 'text' &&
			models &&
			JSON.stringify(models) !== JSON.stringify(base?.models ?? null)
		) {
			configPatch.models = models;
		}
		if (configMode !== 'none' && configJsonParsed.value) {
			for (const [k, v] of Object.entries(configJsonParsed.value))
				configPatch[k] = v;
		}

		const hasAnyConfigPatch = Object.keys(configPatch).length > 0;
		const ops: UgsAdminV2BulkOperation[] = [];

		const enabledValue = parseTriBool(enabled);
		if (enabledValue !== null && enabledValue !== (base?.enabled ?? null)) {
			ops.push({
				kind: 'provider.set_enabled',
				provider_names: targetProviderNames,
				enabled: enabledValue,
			});
		}

		if (
			Object.keys(patch).length === 0 &&
			configMode === 'none' &&
			!hasAnyConfigPatch
		) {
			return ops;
		}

		if (configMode === 'none') {
			if (hasAnyConfigPatch) {
				for (const name of targetProviderNames) {
					const prov = providersByName.get(name);
					const cfgBase = (prov?.config_json ?? {}) as Record<string, unknown>;
					ops.push({
						kind: 'provider.patch',
						provider_names: [name],
						patch: {
							...patch,
							config_json: mergeConfigJson(cfgBase, configPatch),
						},
					});
				}
				return ops;
			}
			if (Object.keys(patch).length > 0) {
				ops.push({
					kind: 'provider.patch',
					provider_names: targetProviderNames,
					patch,
				});
			}
			return ops;
		}

		if (!hasAnyConfigPatch) {
			ops.push({
				kind: 'provider.patch',
				provider_names: targetProviderNames,
				patch,
			});
			return ops;
		}

		if (configMode === 'replace') {
			ops.push({
				kind: 'provider.patch',
				provider_names: targetProviderNames,
				patch: { ...patch, config_json: configPatch },
			});
			return ops;
		}

		for (const name of targetProviderNames) {
			const p = providersByName.get(name);
			const cfgBase = (p?.config_json ?? {}) as Record<string, unknown>;
			ops.push({
				kind: 'provider.patch',
				provider_names: [name],
				patch: { ...patch, config_json: mergeConfigJson(cfgBase, configPatch) },
			});
		}
		return ops;
	}, [
		apiKeyRequired,
		baseUrl,
		costPerRequest,
		defaultModel,
		displayLabel,
		enabled,
		fallbackForCSV,
		fallbackPriority,
		healthEndpoint,
		maxConcurrent,
		modelsCSV,
		providerRole,
		effectiveRole,
		providersByName,
		targetProviderNames,
		timeoutSeconds,
		configJsonParsed.value,
		configMode,
		baseline,
	]);

	const hasChanges = previewOps.length > 0;

	const nonTextConfigCleanupOps = useMemo((): UgsAdminV2BulkOperation[] => {
		const ops: UgsAdminV2BulkOperation[] = [];
		for (const provider of targetProviders) {
			if (providerSupportsTextModelFields(provider)) continue;
			const current = (provider.config_json ?? {}) as Record<string, unknown>;
			const cleaned = cleanNonTextProviderConfig(provider);
			if (JSON.stringify(current) === JSON.stringify(cleaned)) continue;
			ops.push({
				kind: 'provider.patch',
				provider_names: [provider.provider_name],
				patch: { config_json: cleaned },
			});
		}
		return ops;
	}, [targetProviders]);

	const modelRoutesForProviderOps = useMemo(() => {
		if (targetProviders.length !== 1) return null;
		if (effectiveRole !== 'text') return null;
		const providerName = targetProviders[0]?.provider_name;
		const model = defaultModel.trim();
		if (!providerName || !model) return null;
		const next: UgsAdminV2ModelRoutesDTO = {
			global_default_model: null,
			provider_defaults: { [providerName]: model },
			category_defaults: {},
			domain_defaults: {},
			type_overrides: {},
			request_model_override_allowlist: [],
		};
		const typeKeys = new Set(typesForSingleProvider.map((t) => t.type_key));
		for (const typeKey of typeKeys) {
			next.type_overrides[typeKey] = model;
		}
		return {
			providerName,
			affectedTypeKeys: Array.from(typeKeys),
			op: { kind: 'model_routes.patch', routes: next } as const,
		};
	}, [defaultModel, effectiveRole, targetProviders, typesForSingleProvider]);

	const submit = useCallback(() => {
		if (clientErrors.length) return;
		onConfirm(previewOps);
	}, [clientErrors.length, onConfirm, previewOps]);

	const submitApplyModelToProviderTypes = useCallback(() => {
		if (!modelRoutesForProviderOps) return;
		onConfirm([modelRoutesForProviderOps.op]);
	}, [modelRoutesForProviderOps, onConfirm]);

	const submitCleanupNonTextConfig = useCallback(() => {
		if (!nonTextConfigCleanupOps.length) return;
		onConfirm(nonTextConfigCleanupOps);
	}, [nonTextConfigCleanupOps, onConfirm]);

	const selectScannedModel = useCallback((model: string) => {
		setDefaultModel(model);
		setModelsCSV((prev) => {
			const current = normalizeListCSV(prev) ?? [];
			if (current.includes(model)) return prev;
			return [...current, model].join(', ');
		});
	}, []);

	return {
		t,
		displayLabel,
		setDisplayLabel,
		baseUrl,
		setBaseUrl,
		healthEndpoint,
		setHealthEndpoint,
		apiKeyRequired,
		setApiKeyRequired,
		enabled,
		setEnabled,
		timeoutSeconds,
		setTimeoutSeconds,
		maxConcurrent,
		setMaxConcurrent,
		costPerRequest,
		setCostPerRequest,
		fallbackPriority,
		setFallbackPriority,
		fallbackForCSV,
		setFallbackForCSV,
		defaultModel,
		setDefaultModel,
		modelsCSV,
		setModelsCSV,
		providerRole,
		setProviderRole,
		configMode,
		setConfigMode,
		configJsonRaw,
		setConfigJsonRaw,
		scanLoading,
		scanError,
		scannedModels,
		knownProviderNames,
		singleProviderName,
		effectiveRole,
		clientErrors,
		previewOps,
		hasChanges,
		nonTextConfigCleanupOps,
		modelRoutesForProviderOps,
		scanModelsNow,
		selectScannedModel,
		submit,
		submitApplyModelToProviderTypes,
		submitCleanupNonTextConfig,
	};
}

export type ProvidersBulkEditFormState = ReturnType<
	typeof useProvidersBulkEditState
>;
