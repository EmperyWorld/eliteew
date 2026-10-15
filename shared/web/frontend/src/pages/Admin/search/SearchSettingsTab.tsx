/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Search Admin settings tab: global web-search config form, secrets, bootstrap wizard.
 *
 * Invariants:
 * - Secret inputs are write-only; backend never returns plaintext values.
 *
 * Related:
 * - `pages/Admin/adminSearchApi.ts`
 * - `api/routers/desktop_admin_search_config.py`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { log } from '../../../utils/logger';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	type SearchEffectiveResponse,
	type SearchSurfaceKey,
	type SearchConfigResponse,
	type SearchSettingsState,
	type SearchSecretDraftState,
	bootstrapAdminSearchConfig,
	buildSearchConfigPatchBody,
	getAdminSearchEffective,
	getAdminSearchConfig,
	patchAdminSearchConfig,
} from '../adminSearchApi';

const EMPTY_SECRET_DRAFT: SearchSecretDraftState = {
	yandexApiKeyInput: '',
	yandexFolderIdInput: '',
	clearYandexApiKey: false,
	clearYandexFolderId: false,
};

const SEARCH_SURFACES: SearchSurfaceKey[] = [
	'desktop',
	'ewa',
	'marketing',
	'imperorg',
	'ugs',
];

function cloneSearchSettings(
	settings: SearchSettingsState
): SearchSettingsState {
	return {
		...settings,
		surfaces: { ...settings.surfaces },
	};
}

function parseBoundedInt(
	raw: string,
	{
		fallback,
		min,
		max,
	}: {
		fallback: number;
		min: number;
		max: number;
	}
): number {
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(max, Math.max(min, parsed));
}

export interface SearchSettingsTabProps {
	onSaved?: () => void;
	onOpenDiagnostics?: () => void;
}

export function SearchSettingsTab({
	onSaved,
	onOpenDiagnostics,
}: SearchSettingsTabProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [config, setConfig] = React.useState<SearchConfigResponse | null>(null);
	const [baseSettings, setBaseSettings] =
		React.useState<SearchSettingsState | null>(null);
	const [draftSettings, setDraftSettings] =
		React.useState<SearchSettingsState | null>(null);
	const [secretDraft, setSecretDraft] =
		React.useState<SearchSecretDraftState>(EMPTY_SECRET_DRAFT);
	const [auditNote, setAuditNote] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [saving, setSaving] = React.useState(false);
	const [bootstrapping, setBootstrapping] = React.useState(false);
	const [msg, setMsg] = React.useState<string | null>(null);
	const [effectiveBySurface, setEffectiveBySurface] = React.useState<
		Record<SearchSurfaceKey, SearchEffectiveResponse | null>
	>({
		desktop: null,
		ewa: null,
		marketing: null,
		imperorg: null,
		ugs: null,
	});

	const loadEffective = React.useCallback(async () => {
		try {
			const rows = await Promise.all(
				SEARCH_SURFACES.map(async (surface) => {
					const payload = await getAdminSearchEffective(surface);
					return [surface, payload] as const;
				})
			);
			setEffectiveBySurface(
				rows.reduce(
					(acc, [surface, payload]) => {
						acc[surface] = payload;
						return acc;
					},
					{
						desktop: null,
						ewa: null,
						marketing: null,
						imperorg: null,
						ugs: null,
					} as Record<SearchSurfaceKey, SearchEffectiveResponse | null>
				)
			);
		} catch (error) {
			log.error(
				'SearchSettingsTab',
				'effective load failed',
				error instanceof Error ? error : undefined
			);
		}
	}, []);

	const load = React.useCallback(async () => {
		setLoading(true);
		setMsg(null);
		try {
			const data = await getAdminSearchConfig();
			setConfig(data);
			setBaseSettings(cloneSearchSettings(data.settings));
			setDraftSettings(cloneSearchSettings(data.settings));
			setSecretDraft(EMPTY_SECRET_DRAFT);
			setAuditNote('');
			await loadEffective();
		} catch (error) {
			log.error(
				'SearchSettingsTab',
				'load failed',
				error instanceof Error ? error : undefined
			);
			setMsg(t('adminSearchConfig.loadError'));
		} finally {
			setLoading(false);
		}
	}, [loadEffective, t]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const canSave = Boolean(baseSettings && draftSettings) && !saving;

	const save = React.useCallback(async () => {
		if (!baseSettings || !draftSettings) {
			return;
		}
		const payload = buildSearchConfigPatchBody({
			base: baseSettings,
			draft: draftSettings,
			secrets: secretDraft,
			note: auditNote,
		});
		if (!payload) {
			setMsg(t('adminSearchConfig.noChanges'));
			return;
		}
		setSaving(true);
		setMsg(null);
		try {
			const data = await patchAdminSearchConfig(payload);
			setConfig(data);
			setBaseSettings(cloneSearchSettings(data.settings));
			setDraftSettings(cloneSearchSettings(data.settings));
			setSecretDraft(EMPTY_SECRET_DRAFT);
			setAuditNote('');
			await loadEffective();
			setMsg(t('adminSearchConfig.saved'));
			onSaved?.();
		} catch (error) {
			log.error(
				'SearchSettingsTab',
				'save failed',
				error instanceof Error ? error : undefined
			);
			setMsg(t('adminSearchConfig.saveError'));
		} finally {
			setSaving(false);
		}
	}, [
		auditNote,
		baseSettings,
		draftSettings,
		loadEffective,
		onSaved,
		secretDraft,
		t,
	]);

	const bootstrapFromEnv = React.useCallback(async () => {
		setBootstrapping(true);
		setMsg(null);
		try {
			const data = await bootstrapAdminSearchConfig({
				force: false,
				note: 'bootstrap_from_admin_ui',
			});
			setConfig(data);
			setBaseSettings(cloneSearchSettings(data.settings));
			setDraftSettings(cloneSearchSettings(data.settings));
			setSecretDraft(EMPTY_SECRET_DRAFT);
			setAuditNote('');
			await loadEffective();
			setMsg(t('adminSearchConfig.bootstrapDone'));
			onSaved?.();
		} catch (error) {
			log.error(
				'SearchSettingsTab',
				'bootstrap failed',
				error instanceof Error ? error : undefined
			);
			setMsg(t('adminSearchConfig.bootstrapError'));
		} finally {
			setBootstrapping(false);
		}
	}, [loadEffective, onSaved, t]);

	const setSettingsField = <K extends keyof SearchSettingsState>(
		key: K,
		value: SearchSettingsState[K]
	) => {
		setDraftSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
	};

	const setSurfaceField = (
		key: keyof SearchSettingsState['surfaces'],
		value: boolean
	) => {
		setDraftSettings((prev) =>
			prev
				? {
						...prev,
						surfaces: {
							...prev.surfaces,
							[key]: value,
						},
					}
				: prev
		);
	};

	const showSetupWizard =
		config?.source === 'env' ||
		!config?.secrets.yandex_api_key.configured_in_db ||
		!config?.secrets.yandex_folder_id.configured_in_db;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-end gap-2">
				<button
					type="button"
					onClick={() => void load()}
					disabled={loading || saving || bootstrapping}
					className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/90 hover:bg-white/5 disabled:opacity-50"
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminSearchConfig.refresh')}
				</button>
				<button
					type="button"
					onClick={() => void bootstrapFromEnv()}
					disabled={loading || saving || bootstrapping}
					className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
				>
					{bootstrapping
						? t('adminSearchConfig.bootstrapInProgress')
						: t('adminSearchConfig.bootstrapFromEnv')}
				</button>
				<button
					type="button"
					onClick={() => void save()}
					disabled={!canSave || bootstrapping}
					className="inline-flex items-center gap-1 rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm text-white hover:bg-violet-600 disabled:opacity-50"
				>
					<ArrowDownTrayIcon className="h-4 w-4" />
					{saving ? t('adminSearchConfig.saving') : t('adminSearchConfig.save')}
				</button>
			</div>

			{showSetupWizard ? (
				<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
					<p className="font-medium">{t('adminSearch.wizardTitle')}</p>
					<ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-100/90">
						<li>{t('adminSearch.wizardStepBootstrap')}</li>
						<li>{t('adminSearch.wizardStepSecrets')}</li>
						<li>{t('adminSearch.wizardStepProbe')}</li>
					</ol>
					{onOpenDiagnostics ? (
						<button
							type="button"
							className={`${DESKTOP_INTERACTIVE.btnRounded} mt-3 bg-amber-500/20 px-3 py-1 text-xs text-amber-50 hover:bg-amber-500/30`}
							onClick={onOpenDiagnostics}
						>
							{t('adminSearch.wizardOpenDiagnostics')}
						</button>
					) : null}
				</div>
			) : null}

			<div role="status" aria-live="polite" className="min-h-[1.25rem]">
				{msg ? (
					<p className={`${DESKTOP_TYPOGRAPHY.body} text-amber-200/90`}>
						{msg}
					</p>
				) : null}
			</div>

			{draftSettings ? (
				<div className="space-y-4">
					<div className="grid gap-3 md:grid-cols-3">
						<label className="flex flex-col gap-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminSearchConfig.yandexSearchType')}
							</span>
							<input
								type="text"
								className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
								value={draftSettings.yandex_search_type}
								onChange={(event) =>
									setSettingsField('yandex_search_type', event.target.value)
								}
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminSearchConfig.yandexL10n')}
							</span>
							<input
								type="text"
								className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
								value={draftSettings.yandex_search_l10n}
								onChange={(event) =>
									setSettingsField('yandex_search_l10n', event.target.value)
								}
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminSearchConfig.yandexRegion')}
							</span>
							<input
								type="text"
								className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
								value={draftSettings.yandex_search_region}
								onChange={(event) =>
									setSettingsField('yandex_search_region', event.target.value)
								}
							/>
						</label>
					</div>

					<div className="grid gap-3 md:grid-cols-3">
						<label className="flex flex-col gap-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminSearchConfig.yandexGroupsOnPage')}
							</span>
							<input
								type="number"
								min={1}
								max={20}
								className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
								value={draftSettings.yandex_groups_on_page}
								onChange={(event) =>
									setSettingsField(
										'yandex_groups_on_page',
										parseBoundedInt(event.target.value, {
											fallback: draftSettings.yandex_groups_on_page,
											min: 1,
											max: 20,
										})
									)
								}
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminSearchConfig.monthlyFreeDefault')}
							</span>
							<input
								type="number"
								min={0}
								max={10000}
								className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
								value={draftSettings.monthly_free_default}
								onChange={(event) =>
									setSettingsField(
										'monthly_free_default',
										parseBoundedInt(event.target.value, {
											fallback: draftSettings.monthly_free_default,
											min: 0,
											max: 10000,
										})
									)
								}
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('adminSearchConfig.defaultLimit')}
							</span>
							<input
								type="number"
								min={1}
								max={20}
								className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
								value={draftSettings.default_limit}
								onChange={(event) =>
									setSettingsField(
										'default_limit',
										parseBoundedInt(event.target.value, {
											fallback: draftSettings.default_limit,
											min: 1,
											max: 20,
										})
									)
								}
							/>
						</label>
					</div>

					<label className="inline-flex items-center gap-2 text-sm text-white/90">
						<input
							type="checkbox"
							checked={draftSettings.quota_enforced}
							onChange={(event) =>
								setSettingsField('quota_enforced', event.target.checked)
							}
						/>
						{t('adminSearchConfig.quotaEnforced')}
					</label>

					<div className="rounded-lg border border-white/10 bg-black/20 p-3">
						<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-2`}>
							{t('adminSearchConfig.cacheTitle')}
						</p>
						<label className="mb-3 inline-flex items-center gap-2 text-sm text-white/90">
							<input
								type="checkbox"
								checked={draftSettings.cache_enabled}
								onChange={(event) =>
									setSettingsField('cache_enabled', event.target.checked)
								}
							/>
							{t('adminSearchConfig.cacheEnabled')}
						</label>
						<div className="grid gap-3 md:grid-cols-2">
							<label className="flex flex-col gap-1">
								<span className={DESKTOP_TYPOGRAPHY.caption}>
									{t('adminSearchConfig.cacheTtlSec')}
								</span>
								<input
									type="number"
									min={0}
									max={3600}
									className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
									value={draftSettings.cache_ttl_sec}
									onChange={(event) =>
										setSettingsField(
											'cache_ttl_sec',
											parseBoundedInt(event.target.value, {
												fallback: draftSettings.cache_ttl_sec,
												min: 0,
												max: 3600,
											})
										)
									}
								/>
							</label>
							<label className="flex flex-col gap-1">
								<span className={DESKTOP_TYPOGRAPHY.caption}>
									{t('adminSearchConfig.cacheEmptyTtlSec')}
								</span>
								<input
									type="number"
									min={0}
									max={3600}
									className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
									value={draftSettings.cache_empty_ttl_sec}
									onChange={(event) =>
										setSettingsField(
											'cache_empty_ttl_sec',
											parseBoundedInt(event.target.value, {
												fallback: draftSettings.cache_empty_ttl_sec,
												min: 0,
												max: 3600,
											})
										)
									}
								/>
							</label>
						</div>
					</div>

					<div>
						<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-2`}>
							{t('adminSearchConfig.surfaceToggles')}
						</p>
						<div className="grid gap-2 sm:grid-cols-2 md:grid-cols-5">
							{(
								Object.keys(draftSettings.surfaces) as Array<
									keyof SearchSettingsState['surfaces']
								>
							).map((surfaceKey) => (
								<label
									key={surfaceKey}
									className="inline-flex items-center gap-2 rounded border border-white/10 px-2 py-1 text-xs text-white/90"
								>
									<input
										type="checkbox"
										checked={draftSettings.surfaces[surfaceKey]}
										onChange={(event) =>
											setSurfaceField(surfaceKey, event.target.checked)
										}
									/>
									{surfaceKey}
								</label>
							))}
						</div>
					</div>

					<div className="rounded-lg border border-white/10 bg-black/20 p-3">
						<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-2`}>
							{t('adminSearchConfig.secretsTitle')}
						</p>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="space-y-2">
								<p className={DESKTOP_TYPOGRAPHY.meta}>
									{t('adminSearchConfig.yandexApiKey')}
									{' · '}
									{config?.secrets.yandex_api_key.configured_in_db
										? t('adminSearchConfig.secretInDb')
										: t('adminSearchConfig.secretViaFallback')}
								</p>
								<input
									type="password"
									className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
									value={secretDraft.yandexApiKeyInput}
									onChange={(event) =>
										setSecretDraft((prev) => ({
											...prev,
											yandexApiKeyInput: event.target.value,
										}))
									}
									placeholder={t('adminSearchConfig.secretPlaceholder')}
								/>
								<label className="inline-flex items-center gap-2 text-xs text-white/80">
									<input
										type="checkbox"
										checked={secretDraft.clearYandexApiKey}
										onChange={(event) =>
											setSecretDraft((prev) => ({
												...prev,
												clearYandexApiKey: event.target.checked,
											}))
										}
									/>
									{t('adminSearchConfig.clearSecret')}
								</label>
							</div>
							<div className="space-y-2">
								<p className={DESKTOP_TYPOGRAPHY.meta}>
									{t('adminSearchConfig.yandexFolderId')}
									{' · '}
									{config?.secrets.yandex_folder_id.configured_in_db
										? t('adminSearchConfig.secretInDb')
										: t('adminSearchConfig.secretViaFallback')}
								</p>
								<input
									type="password"
									className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
									value={secretDraft.yandexFolderIdInput}
									onChange={(event) =>
										setSecretDraft((prev) => ({
											...prev,
											yandexFolderIdInput: event.target.value,
										}))
									}
									placeholder={t('adminSearchConfig.secretPlaceholder')}
								/>
								<label className="inline-flex items-center gap-2 text-xs text-white/80">
									<input
										type="checkbox"
										checked={secretDraft.clearYandexFolderId}
										onChange={(event) =>
											setSecretDraft((prev) => ({
												...prev,
												clearYandexFolderId: event.target.checked,
											}))
										}
									/>
									{t('adminSearchConfig.clearSecret')}
								</label>
							</div>
						</div>
						<p className={`mt-2 ${DESKTOP_TYPOGRAPHY.meta}`}>
							{t('adminSearchConfig.secretHint')}
						</p>
					</div>

					<label className="flex flex-col gap-1">
						<span className={DESKTOP_TYPOGRAPHY.caption}>
							{t('adminSearchConfig.auditNote')}
						</span>
						<input
							type="text"
							className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
							value={auditNote}
							maxLength={400}
							onChange={(event) => setAuditNote(event.target.value)}
							placeholder={t('adminSearchConfig.auditPlaceholder')}
						/>
					</label>

					<div className="rounded-lg border border-white/10 bg-black/20 p-3">
						<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-2`}>
							{t('adminSearchConfig.runtimeSnapshot')}
						</p>
						<div className={`${DESKTOP_TYPOGRAPHY.meta} mb-2 text-slate-300`}>
							{t('adminSearchConfig.snapshotMeta', {
								source: config?.source ?? 'unknown',
								updatedAt: config?.updated_at ?? '—',
							})}
						</div>
						<div className="grid gap-2 md:grid-cols-5">
							{SEARCH_SURFACES.map((surface) => {
								const row = effectiveBySurface[surface];
								return (
									<div
										key={surface}
										className="rounded border border-white/10 bg-black/30 px-2 py-2 text-xs text-white/90"
									>
										<p className="font-semibold">{surface}</p>
										<p>
											{t('adminSearchConfig.surfaceEnabled')}:{' '}
											{row?.surface_enabled
												? t('adminSearchConfig.yes')
												: t('adminSearchConfig.no')}
										</p>
										<p>
											{t('adminSearchConfig.providerLabel')}:{' '}
											{row?.provider ?? '—'}
										</p>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			) : (
				<p className={`${DESKTOP_TYPOGRAPHY.body} text-white/70`}>
					{loading
						? t('adminSearchConfig.loading')
						: t('adminSearchConfig.loadError')}
				</p>
			)}
		</div>
	);
}
