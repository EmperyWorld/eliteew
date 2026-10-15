/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWA companion admin — platform settings tab (Postgres-backed EWA_* parameters).
 *
 * Invariants:
 * - Writes require admin JWT; **not** gated by ``EWA_COMPANION_ADMIN_WRITE`` (bootstrap flags live here).
 * - Settings query is short-lived cache: refetch on mount/focus, bounded GC, no background polling.
 *
 * Related:
 * - src/features/ewa/admin/ewaCompanionAdminApi.ts
 * - documentation/product/ewa/EWA-PLATFORM-SETTINGS-DB.md
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { EwaCompanionSettingsAuditPanel } from './EwaCompanionSettingsAuditPanel';
import {
	EWA_SETTINGS_CATEGORY_ORDER,
	settingsCategoryHintI18nKey,
	settingsCategoryI18nKey,
} from './ewaCompanionAdminMeta';
import {
	groupSettingsBySubgroup,
	settingsSubgroupI18nKey,
} from './ewaCompanionSettingsSubgroups';
import { findPlatformSettingCategory } from './ewaCompanionAdminSettingsNav';
import {
	classifyEwaCompanionAdminError,
	fetchEwaCompanionPlatformSettings,
	updateEwaCompanionPlatformSetting,
	type EwaCompanionPlatformSetting,
} from './ewaCompanionAdminApi';

function SettingHelp({
	setting,
	locale,
}: {
	setting: EwaCompanionPlatformSetting;
	locale: string;
}) {
	const { t } = useTranslation('desktopUi');
	const isRu = locale.startsWith('ru');
	const title = isRu
		? setting.title_ru?.trim() || setting.setting_key
		: setting.title_en?.trim() || setting.setting_key;
	const description = isRu ? setting.description_ru : setting.description_en;
	const affects = isRu ? setting.affects_ru : setting.affects_en;
	return (
		<div
			className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-white/10 bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_95%,transparent)] p-3 text-xs text-(--desktop-text-primary) shadow-xl group-hover/help:block group-focus-within/help:block"
			role="tooltip"
		>
			<p className="mb-1 text-sm font-medium text-white">{title}</p>
			<p className="mb-2 whitespace-pre-wrap leading-relaxed text-(--desktop-text-secondary)">
				{description}
			</p>
			<p className="text-(--desktop-text-muted)">
				<strong className="text-(--desktop-text-secondary)">
					{t('ewaCompanionAdmin.settingsAllowed')}:
				</strong>{' '}
				{setting.allowed_values || '—'}
			</p>
			<p className="mt-2 text-(--desktop-text-dim)">
				<strong className="text-(--desktop-text-muted)">
					{t('ewaCompanionAdmin.settingsTechnical')}:
				</strong>{' '}
				{affects || '—'}
			</p>
			<p className="mt-1 font-mono text-[10px] text-(--desktop-text-dim)">
				{setting.setting_key}
			</p>
			<p className="mt-2 text-(--desktop-text-dim)">
				{t('ewaCompanionAdmin.settingsDefault')}:{' '}
				<code className="text-(--desktop-text-muted)">
					{setting.default_value || '—'}
				</code>
			</p>
		</div>
	);
}

function SettingRow({
	setting,
	writeEnabled,
	highlighted,
	onSaved,
}: {
	setting: EwaCompanionPlatformSetting;
	writeEnabled: boolean;
	highlighted?: boolean;
	onSaved: () => void;
}) {
	const { t, i18n } = useTranslation('desktopUi');
	const [value, setValue] = useState(setting.value_text);
	const [expanded, setExpanded] = useState(false);
	const isRu = i18n.language.startsWith('ru');
	const title = isRu
		? setting.title_ru?.trim() || setting.setting_key
		: setting.title_en?.trim() || setting.setting_key;
	const description = isRu ? setting.description_ru : setting.description_en;
	const affects = isRu ? setting.affects_ru : setting.affects_en;
	const boolHint =
		setting.value_type === 'bool'
			? t('ewaCompanionAdmin.settingsBoolHint')
			: null;

	const saveMutation = useMutation({
		mutationFn: (next: string) =>
			updateEwaCompanionPlatformSetting(setting.setting_key, next),
		onSuccess: () => onSaved(),
	});

	const dirty = value !== setting.value_text;
	const inputType =
		setting.is_secret && !setting.value_masked ? 'password' : 'text';

	return (
		<div
			id={`ewa-setting-row-${setting.setting_key}`}
			className={`${DESKTOP_SURFACE.radius} border p-4 transition-colors ${
				highlighted
					? 'border-[rgb(var(--desktop-accent-rgb)/0.5)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.4)]'
					: 'border-white/6 bg-white/2'
			}`}
		>
			<div className="flex flex-wrap items-start gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h4 className="text-base font-medium text-white">{title}</h4>
						<span className="rounded bg-white/6 px-2 py-0.5 text-[10px] uppercase tracking-wide text-(--desktop-text-muted)">
							{setting.value_type}
						</span>
						<span className="group/help relative inline-flex">
							<button
								type="button"
								className="flex h-5 w-5 items-center justify-center rounded-full bg-white/8 text-xs text-(--desktop-text-secondary) hover:bg-white/14"
								aria-label={t('ewaCompanionAdmin.settingsHelpAria')}
							>
								?
							</button>
							<SettingHelp setting={setting} locale={i18n.language} />
						</span>
					</div>
					<p
						className={`${DESKTOP_TYPOGRAPHY.meta} mt-1 font-mono text-[10px] text-(--desktop-text-dim)`}
					>
						{setting.setting_key}
					</p>
					<p
						className={`${DESKTOP_TYPOGRAPHY.meta} mt-2 max-w-3xl leading-relaxed text-(--desktop-text-secondary)`}
					>
						{description}
					</p>
					{boolHint ? (
						<p
							className={`${DESKTOP_TYPOGRAPHY.meta} mt-1 text-(--desktop-text-dim)`}
						>
							{boolHint}
						</p>
					) : null}
				</div>
				<div className="flex min-w-48 flex-1 flex-wrap items-center gap-2 sm:max-w-md">
					<input
						type={inputType}
						className={`${DESKTOP_INTERACTIVE.btnRounded} min-w-0 flex-1 bg-black/30 px-2 py-1.5 font-mono text-sm text-(--desktop-text-primary)`}
						value={value}
						disabled={!writeEnabled || saveMutation.isPending}
						placeholder={
							setting.value_masked
								? t('ewaCompanionAdmin.settingsSecretPlaceholder')
								: ''
						}
						onChange={(e) => setValue(e.target.value)}
					/>
					<button
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-sm ${
							dirty && writeEnabled
								? 'bg-[rgb(var(--desktop-accent-rgb)/0.4)] text-white hover:bg-[rgb(var(--desktop-accent-rgb)/0.55)]'
								: 'cursor-not-allowed bg-white/4 text-(--desktop-text-dim)'
						}`}
						disabled={!writeEnabled || !dirty || saveMutation.isPending}
						onClick={() => saveMutation.mutate(value)}
					>
						{t('ewaCompanionAdmin.settingsSave')}
					</button>
				</div>
			</div>
			<button
				type="button"
				className={`${DESKTOP_TYPOGRAPHY.meta} mt-2 text-left text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)`}
				onClick={() => setExpanded((v) => !v)}
			>
				{expanded
					? t('ewaCompanionAdmin.settingsHideDetails')
					: t('ewaCompanionAdmin.settingsShowDetails')}
			</button>
			{expanded ? (
				<div className="mt-2 space-y-2 border-t border-white/6 pt-2 text-sm text-(--desktop-text-secondary)">
					<p className="text-(--desktop-text-muted)">
						{t('ewaCompanionAdmin.settingsAllowed')}:{' '}
						{setting.allowed_values || '—'}
					</p>
					<p className="text-(--desktop-text-dim)">
						{t('ewaCompanionAdmin.settingsTechnical')}: {affects || '—'}
					</p>
					<p className="text-(--desktop-text-dim)">
						{t('ewaCompanionAdmin.settingsDefault')}:{' '}
						<code>{setting.default_value || '—'}</code>
					</p>
				</div>
			) : null}
			{saveMutation.isError ? (
				<p className="mt-2 text-sm text-red-300">
					{t('ewaCompanionAdmin.settingsSaveFailed')}
				</p>
			) : null}
			{saveMutation.isSuccess && !dirty ? (
				<p className="mt-2 text-sm text-emerald-300">
					{t('ewaCompanionAdmin.settingsSaved')}
				</p>
			) : null}
		</div>
	);
}

function SettingsList({
	settings,
	writeEnabled,
	highlightKey,
	onSaved,
}: {
	settings: EwaCompanionPlatformSetting[];
	writeEnabled: boolean;
	highlightKey?: string | null;
	onSaved: () => void;
}) {
	return (
		<div className="space-y-3">
			{settings.map((setting) => (
				<SettingRow
					key={setting.setting_key}
					setting={setting}
					writeEnabled={writeEnabled}
					highlighted={highlightKey === setting.setting_key}
					onSaved={onSaved}
				/>
			))}
		</div>
	);
}

export function EwaCompanionSettingsTab({
	writeEnabled = true,
	focusSettingKey = null,
	onFocusSettingKeyConsumed,
}: {
	writeEnabled?: boolean;
	focusSettingKey?: string | null;
	onFocusSettingKeyConsumed?: () => void;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const queryClient = useQueryClient();
	const [category, setCategory] = useState<string>('all');
	const [search, setSearch] = useState('');
	const [changedOnly, setChangedOnly] = useState(false);
	const [highlightKey, setHighlightKey] = useState<string | null>(null);

	const settingsQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'settings'],
		queryFn: () => fetchEwaCompanionPlatformSettings(),
		retry: false,
		refetchOnMount: 'always',
		refetchOnWindowFocus: true,
		staleTime: 15_000,
		gcTime: 5 * 60 * 1000,
	});

	const allSettings = settingsQuery.data?.settings ?? [];
	const settingsTotal =
		settingsQuery.data?.settings_total ?? allSettings.length;
	const settingsDbTotal = settingsQuery.data?.db_total;

	useEffect(() => {
		const key = focusSettingKey?.trim();
		if (!key) {
			return;
		}
		setSearch(key);
		setHighlightKey(key);
		const cat = findPlatformSettingCategory(allSettings, key);
		if (cat) {
			setCategory(cat);
		} else {
			setCategory('all');
		}
		const scrollTimer = window.setTimeout(() => {
			document
				.getElementById(`ewa-setting-row-${key}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}, 100);
		onFocusSettingKeyConsumed?.();
		return () => window.clearTimeout(scrollTimer);
	}, [focusSettingKey, allSettings, onFocusSettingKeyConsumed]);

	const auditFilterKey = useMemo(() => {
		const q = search.trim();
		if (!q) {
			return '';
		}
		if (allSettings.some((s) => s.setting_key === q)) {
			return q;
		}
		return '';
	}, [search, allSettings]);

	const countByCategory = useMemo(() => {
		const map = new Map<string, number>();
		for (const s of allSettings) {
			map.set(s.category, (map.get(s.category) ?? 0) + 1);
		}
		return map;
	}, [allSettings]);

	const categories = useMemo(() => {
		const set = new Set<string>();
		for (const s of allSettings) {
			set.add(s.category);
		}
		return [
			'all',
			...EWA_SETTINGS_CATEGORY_ORDER.filter((c) => set.has(c)),
			...[...set]
				.filter(
					(c) =>
						!EWA_SETTINGS_CATEGORY_ORDER.includes(
							c as (typeof EWA_SETTINGS_CATEGORY_ORDER)[number]
						)
				)
				.sort(),
		];
	}, [allSettings]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		let rows = allSettings;
		if (category !== 'all') {
			rows = rows.filter((s) => s.category === category);
		}
		if (changedOnly) {
			rows = rows.filter(
				(s) => (s.value_text ?? '').trim() !== (s.default_value ?? '').trim()
			);
		}
		if (q) {
			rows = rows.filter(
				(s) =>
					s.setting_key.toLowerCase().includes(q) ||
					(s.title_ru ?? '').toLowerCase().includes(q) ||
					(s.title_en ?? '').toLowerCase().includes(q) ||
					s.description_ru.toLowerCase().includes(q) ||
					s.description_en.toLowerCase().includes(q)
			);
		}
		return rows;
	}, [allSettings, category, search, changedOnly]);

	const grouped = useMemo(() => {
		if (category !== 'all') {
			return [];
		}
		const map = new Map<string, EwaCompanionPlatformSetting[]>();
		for (const s of filtered) {
			const list = map.get(s.category) ?? [];
			list.push(s);
			map.set(s.category, list);
		}
		const order = [
			...EWA_SETTINGS_CATEGORY_ORDER.filter((c) => map.has(c)),
			...[...map.keys()]
				.filter(
					(c) =>
						!EWA_SETTINGS_CATEGORY_ORDER.includes(
							c as (typeof EWA_SETTINGS_CATEGORY_ORDER)[number]
						)
				)
				.sort(),
		];
		return order.map((cat) => ({ cat, items: map.get(cat) ?? [] }));
	}, [filtered, category]);

	const categoryNavLabel = (cat: string) => {
		if (cat === 'all') {
			return t('ewaCompanionAdmin.settingsCategoryAll', {
				count: settingsTotal,
			});
		}
		const title = t(settingsCategoryI18nKey(cat), { defaultValue: cat });
		return `${title} (${countByCategory.get(cat) ?? 0})`;
	};

	const errorMessage = settingsQuery.error
		? t(
				{
					admin_disabled: 'ewaCompanionAdmin.errorAdminDisabled',
					write_disabled: 'ewaCompanionAdmin.errorWriteDisabled',
					forbidden: 'ewaCompanionAdmin.errorForbidden',
					load_failed: 'ewaCompanionAdmin.errorLoadFailed',
				}[classifyEwaCompanionAdminError(settingsQuery.error)] ??
					'ewaCompanionAdmin.errorLoadFailed'
			)
		: null;

	const onSaved = () => {
		void queryClient.invalidateQueries({
			queryKey: ['ewa', 'admin', 'companion', 'settings'],
		});
		void queryClient.invalidateQueries({
			queryKey: ['ewa', 'admin', 'companion', 'settings-audit'],
		});
		void queryClient.invalidateQueries({
			queryKey: ['ewa', 'admin', 'companion', 'status'],
		});
	};

	return (
		<div className="space-y-4">
			<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}>
				{t('ewaCompanionAdmin.settingsIntro')}
			</p>
			<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-dim)`}>
				{t('ewaCompanionAdmin.settingsWriteBootstrapNote')}
			</p>
			{settingsDbTotal != null && settingsDbTotal !== settingsTotal ? (
				<p className={`${DESKTOP_TYPOGRAPHY.meta} text-amber-200`}>
					{t('ewaCompanionAdmin.settingsCountMismatch', {
						dbTotal: settingsDbTotal,
						returnedTotal: settingsTotal,
					})}
				</p>
			) : null}
			{!writeEnabled ? (
				<div
					className={`${DESKTOP_SURFACE.radius} border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100`}
				>
					{t('ewaCompanionAdmin.settingsReadOnlyHint')}
				</div>
			) : null}
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
				<nav
					className="flex shrink-0 flex-row flex-wrap gap-2 lg:w-56 lg:flex-col lg:gap-1"
					aria-label={t('ewaCompanionAdmin.settingsCategoryNavAria')}
				>
					{categories.map((cat) => (
						<button
							key={cat}
							type="button"
							className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-2 text-left text-sm ${
								category === cat
									? 'bg-[rgb(var(--desktop-accent-rgb)/0.35)] text-white ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.4)]'
									: 'bg-white/5 text-(--desktop-text-secondary) hover:bg-white/8'
							}`}
							onClick={() => setCategory(cat)}
						>
							{categoryNavLabel(cat)}
						</button>
					))}
				</nav>
				<div className="min-w-0 flex-1 space-y-4">
					{category !== 'all' ? (
						<header className="border-b border-white/10 pb-3">
							<h3 className="text-base font-medium text-white">
								{t(settingsCategoryI18nKey(category), {
									defaultValue: category,
								})}
							</h3>
							<p
								className={`${DESKTOP_TYPOGRAPHY.meta} mt-1 text-(--desktop-text-dim)`}
							>
								{t(settingsCategoryHintI18nKey(category), { defaultValue: '' })}
							</p>
						</header>
					) : null}
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
						<label className="flex min-w-56 flex-1 flex-col gap-1 text-sm text-(--desktop-text-muted)">
							{t('ewaCompanionAdmin.settingsSearch')}
							<input
								className={`${DESKTOP_INTERACTIVE.btnRounded} bg-black/30 px-2 py-1.5 text-sm text-(--desktop-text-primary)`}
								value={search}
								placeholder={t('ewaCompanionAdmin.settingsSearchPlaceholder')}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</label>
						<label className="flex cursor-pointer items-center gap-2 pb-1.5 text-sm text-(--desktop-text-secondary)">
							<input
								type="checkbox"
								className="rounded border-white/20 bg-black/40"
								checked={changedOnly}
								onChange={(e) => setChangedOnly(e.target.checked)}
							/>
							{t('ewaCompanionAdmin.settingsChangedOnly', {
								defaultValue: 'Changed from default',
							})}
						</label>
					</div>
					<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-dim)`}>
						{t('ewaCompanionAdmin.settingsFilteredCount', {
							defaultValue: '{{shown}} of {{total}} settings',
							shown: filtered.length,
							total: settingsTotal,
						})}
					</p>
					{settingsQuery.isLoading ? (
						<p className="text-sm text-(--desktop-text-muted)">
							{t('ewaCompanionAdmin.loadingSettings')}
						</p>
					) : null}
					{errorMessage ? (
						<div
							className={`${DESKTOP_SURFACE.radius} border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200`}
						>
							{errorMessage}
						</div>
					) : null}
					{!settingsQuery.isLoading &&
					!errorMessage &&
					filtered.length === 0 ? (
						<p className="text-sm text-(--desktop-text-muted)">
							{t('ewaCompanionAdmin.emptySettings')}
						</p>
					) : null}
					{category === 'all' ? (
						<div className="space-y-8">
							{grouped.map(({ cat, items }) => (
								<section key={cat}>
									<header className="mb-3 border-b border-white/10 pb-2">
										<h3 className="text-base font-medium text-white">
											{t(settingsCategoryI18nKey(cat), { defaultValue: cat })}
										</h3>
										<p
											className={`${DESKTOP_TYPOGRAPHY.meta} mt-1 text-(--desktop-text-dim)`}
										>
											{t(settingsCategoryHintI18nKey(cat), {
												defaultValue: '',
											})}
										</p>
									</header>
									<div className="space-y-5">
										{groupSettingsBySubgroup(items).map(
											({ subgroup, items: subItems }) => (
												<div key={`${cat}-${subgroup}`}>
													<h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--desktop-text-muted)">
														{t(settingsSubgroupI18nKey(subgroup), {
															defaultValue: subgroup,
														})}
													</h4>
													<SettingsList
														settings={subItems}
														writeEnabled={writeEnabled}
														highlightKey={highlightKey}
														onSaved={onSaved}
													/>
												</div>
											)
										)}
									</div>
								</section>
							))}
						</div>
					) : (
						<div className="space-y-5">
							{groupSettingsBySubgroup(filtered).map(
								({ subgroup, items: subItems }) => (
									<section key={subgroup}>
										<h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--desktop-text-muted)">
											{t(settingsSubgroupI18nKey(subgroup), {
												defaultValue: subgroup,
											})}
										</h4>
										<SettingsList
											settings={subItems}
											writeEnabled={writeEnabled}
											highlightKey={highlightKey}
											onSaved={onSaved}
										/>
									</section>
								)
							)}
						</div>
					)}
					<EwaCompanionSettingsAuditPanel filterKey={auditFilterKey} />
				</div>
			</div>
		</div>
	);
}
