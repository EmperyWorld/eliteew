/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Customer-facing summary editor inside client-interaction (save + dashboard autofill).
 *
 * Invariants:
 * - `project-dashboard` for autofill loads only after hover/focus on the autofill panel.
 *
 * Related:
 * - ClientInteractionView.tsx, marketingCabinetApi.getProjectDashboard
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import { customerCabinetCustomerSummaryQueryKey } from '@/pages/CustomerCabinet/customerCabinetQueryOptions';

import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import { marketingCabinetApi } from '../marketingCabinetApi';
import {
	marketingCabinetCustomerFacingSummaryQueryKey,
	marketingCabinetCustomerFacingSummaryQueryOptions,
} from '../marketingCabinetClientInteractionQueryOptions';
import { marketingCabinetCustomerSummaryAutofillDashboardQueryOptions } from '../marketingCabinetQueryOptions';

import {
	buildCustomerSummaryAutofillAll,
	buildCustomerSummaryAutofillBasics,
	buildCustomerSummaryAutofillBullets,
	buildCustomerSummaryAutofillMetrics,
} from './customerFacingSummaryAutofill';

function newSummaryRowId(): string {
	return (
		globalThis.crypto?.randomUUID?.() ??
		`sf-${Math.random().toString(36).slice(2, 12)}`
	);
}

type SummaryBulletRow = { id: string; value: string };
type SummaryMetricRow = { id: string; label: string; value: string };

export interface CustomerFacingSummaryEditorProps {
	projectId: string;
	className?: string;
}

export function CustomerFacingSummaryEditor({
	projectId,
	className,
}: CustomerFacingSummaryEditorProps) {
	const { t } = useTranslation('marketing');
	const { contentPanel: mcPanel, formSelect: mcForm } =
		useMarketingShellClasses();
	const qc = useQueryClient();
	const initialized = useRef(false);
	const [dashboardAutofillEngaged, setDashboardAutofillEngaged] =
		useState(false);
	const engageDashboardAutofill = useCallback(() => {
		setDashboardAutofillEngaged(true);
	}, []);

	const summaryQuery = useQuery({
		...marketingCabinetCustomerFacingSummaryQueryOptions(projectId),
		enabled: Boolean(projectId),
	});

	const dashboardQuery = useQuery({
		...marketingCabinetCustomerSummaryAutofillDashboardQueryOptions(projectId),
		enabled: Boolean(projectId) && dashboardAutofillEngaged,
	});

	const [headline, setHeadline] = useState('');
	const [intro, setIntro] = useState('');
	const [bullets, setBullets] = useState<SummaryBulletRow[]>(() => [
		{ id: newSummaryRowId(), value: '' },
	]);
	const [metrics, setMetrics] = useState<SummaryMetricRow[]>(() => [
		{ id: newSummaryRowId(), label: '', value: '' },
	]);

	const summaryProjectRef = useRef(projectId);
	useEffect(() => {
		if (summaryProjectRef.current !== projectId) {
			summaryProjectRef.current = projectId;
			initialized.current = false;
		}
	}, [projectId]);

	useEffect(() => {
		if (!summaryQuery.isSuccess || initialized.current) return;
		const pl = summaryQuery.data?.summary?.payload ?? {};
		setHeadline(typeof pl.headline === 'string' ? pl.headline : '');
		setIntro(typeof pl.intro === 'string' ? pl.intro : '');
		const b = Array.isArray(pl.bullets) ? pl.bullets.map(String) : [];
		setBullets(
			b.length > 0
				? b.map((value) => ({ id: newSummaryRowId(), value }))
				: [{ id: newSummaryRowId(), value: '' }]
		);
		const m = Array.isArray(pl.metrics)
			? pl.metrics
					.filter(
						(x): x is { label: string; value: string } =>
							Boolean(x) &&
							typeof (x as { label?: string }).label === 'string' &&
							typeof (x as { value?: string }).value === 'string'
					)
					.map((x) => ({
						id: newSummaryRowId(),
						label: x.label,
						value: x.value,
					}))
			: [];
		setMetrics(
			m.length > 0 ? m : [{ id: newSummaryRowId(), label: '', value: '' }]
		);
		initialized.current = true;
	}, [summaryQuery.isSuccess, summaryQuery.data]);

	const saveMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.putCustomerFacingSummary(projectId, {
				headline: headline.trim() || null,
				intro: intro.trim() || null,
				bullets: bullets.map((row) => row.value.trim()).filter(Boolean),
				metrics: metrics
					.map((row) => ({
						label: row.label.trim(),
						value: row.value.trim(),
					}))
					.filter((row) => row.label && row.value),
			}),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: marketingCabinetCustomerFacingSummaryQueryKey(projectId),
			});
			void qc.invalidateQueries({
				queryKey: customerCabinetCustomerSummaryQueryKey(projectId),
			});
		},
	});

	const setBullet = (i: number, v: string) => {
		setBullets((prev) => {
			const next = [...prev];
			const cur = next[i];
			if (cur) next[i] = { ...cur, value: v };
			return next;
		});
	};

	const addBullet = () => {
		setBullets((prev) =>
			prev.length >= 24 ? prev : [...prev, { id: newSummaryRowId(), value: '' }]
		);
	};

	const removeBullet = (i: number) => {
		setBullets((prev) =>
			prev.length <= 1
				? [{ id: newSummaryRowId(), value: '' }]
				: prev.filter((_, j) => j !== i)
		);
	};

	const setMetric = (i: number, key: 'label' | 'value', v: string) => {
		setMetrics((prev) => {
			const next = [...prev];
			const cur = next[i];
			if (cur) next[i] = { ...cur, [key]: v };
			return next;
		});
	};

	const addMetric = () => {
		setMetrics((prev) =>
			prev.length >= 12
				? prev
				: [...prev, { id: newSummaryRowId(), label: '', value: '' }]
		);
	};

	const removeMetric = (i: number) => {
		setMetrics((prev) =>
			prev.length <= 1
				? [{ id: newSummaryRowId(), label: '', value: '' }]
				: prev.filter((_, j) => j !== i)
		);
	};

	const fallbackProjectTitle = t(
		'customerSummaryEditor.autofill.defaultProjectTitle'
	);

	const metricLabel = useCallback(
		(key: string) =>
			t(`customerSummaryEditor.autofill.metrics.${key}`, {
				defaultValue: key,
			}),
		[t]
	);

	const bulletsTouched = useCallback(
		() => bullets.some((b) => b.value.trim().length > 0),
		[bullets]
	);

	const metricsTouched = useCallback(
		() => metrics.some((m) => m.label.trim() || m.value.trim()),
		[metrics]
	);

	const confirmReplace = useCallback(
		(kind: 'basics' | 'bullets' | 'metrics' | 'all') => {
			if (kind === 'basics') {
				return (
					!(headline.trim() || intro.trim()) ||
					window.confirm(t('customerSummaryEditor.autofill.confirmOverwrite'))
				);
			}
			if (kind === 'bullets') {
				return (
					!bulletsTouched() ||
					window.confirm(t('customerSummaryEditor.autofill.confirmOverwrite'))
				);
			}
			if (kind === 'metrics') {
				return (
					!metricsTouched() ||
					window.confirm(t('customerSummaryEditor.autofill.confirmOverwrite'))
				);
			}
			const any =
				headline.trim() || intro.trim() || bulletsTouched() || metricsTouched();
			return (
				!any ||
				window.confirm(t('customerSummaryEditor.autofill.confirmOverwrite'))
			);
		},
		[bulletsTouched, headline, intro, metricsTouched, t]
	);

	const applyBasics = useCallback(() => {
		const d = dashboardQuery.data;
		if (!d) return;
		if (!confirmReplace('basics')) return;
		const next = buildCustomerSummaryAutofillBasics(d, fallbackProjectTitle);
		setHeadline(next.headline);
		setIntro(next.intro);
	}, [confirmReplace, dashboardQuery.data, fallbackProjectTitle]);

	const applyBullets = useCallback(() => {
		const d = dashboardQuery.data;
		if (!d) return;
		if (!confirmReplace('bullets')) return;
		const list = buildCustomerSummaryAutofillBullets(d);
		setBullets(
			list.length > 0
				? list.map((value) => ({ id: newSummaryRowId(), value }))
				: [{ id: newSummaryRowId(), value: '' }]
		);
	}, [confirmReplace, dashboardQuery.data]);

	const applyMetrics = useCallback(() => {
		const d = dashboardQuery.data;
		if (!d) return;
		if (!confirmReplace('metrics')) return;
		const raw = buildCustomerSummaryAutofillMetrics(d);
		const rows: SummaryMetricRow[] = raw.map((m) => ({
			id: newSummaryRowId(),
			label: metricLabel(m.metricKey),
			value: m.value,
		}));
		setMetrics(
			rows.length > 0 ? rows : [{ id: newSummaryRowId(), label: '', value: '' }]
		);
	}, [confirmReplace, dashboardQuery.data, metricLabel]);

	const applyAll = useCallback(() => {
		const d = dashboardQuery.data;
		if (!d) return;
		if (!confirmReplace('all')) return;
		const draft = buildCustomerSummaryAutofillAll(d, fallbackProjectTitle);
		setHeadline(draft.headline);
		setIntro(draft.intro);
		setBullets(
			draft.bullets.length > 0
				? draft.bullets.map((value) => ({ id: newSummaryRowId(), value }))
				: [{ id: newSummaryRowId(), value: '' }]
		);
		const mrows: SummaryMetricRow[] = draft.metrics.map((m) => ({
			id: newSummaryRowId(),
			label: metricLabel(m.metricKey),
			value: m.value,
		}));
		setMetrics(
			mrows.length > 0
				? mrows
				: [{ id: newSummaryRowId(), label: '', value: '' }]
		);
	}, [confirmReplace, dashboardQuery.data, fallbackProjectTitle, metricLabel]);

	const autofillDisabled =
		!dashboardAutofillEngaged ||
		!dashboardQuery.data ||
		dashboardQuery.isLoading ||
		dashboardQuery.isFetching;

	return (
		<div className={cn('space-y-0 overflow-hidden p-0', mcPanel, className)}>
			<div className="border-b border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/50 px-4 py-3 sm:px-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0 flex-1 space-y-1">
						<DesktopAppSectionLabel className="mb-0">
							{t('customerSummaryEditor.title')}
						</DesktopAppSectionLabel>
						<p className="line-clamp-3 text-xs leading-relaxed text-(--desktop-text-secondary)">
							{t('customerSummaryEditor.hint')}
						</p>
					</div>
					{summaryQuery.isSuccess && !summaryQuery.isLoading ? (
						<div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
							<DesktopAppButton
								type="button"
								size="sm"
								variant="accent"
								className="w-full min-w-34 sm:w-auto"
								disabled={saveMutation.isPending}
								onClick={() => saveMutation.mutate()}
							>
								{saveMutation.isPending ? (
									<>
										<ArrowPathIcon
											className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('customerSummaryEditor.saving')}
									</>
								) : (
									t('customerSummaryEditor.save')
								)}
							</DesktopAppButton>
							{summaryQuery.data?.summary?.updated_at ? (
								<span
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'text-center sm:text-right'
									)}
								>
									{t('customerSummaryEditor.lastSaved', {
										time: new Date(
											summaryQuery.data.summary.updated_at
										).toLocaleString(),
									})}
								</span>
							) : null}
						</div>
					) : null}
				</div>
			</div>

			<div className="space-y-4 px-4 py-4 sm:px-5">
				{summaryQuery.isSuccess && !summaryQuery.isLoading ? (
					<fieldset
						className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-muted)/40 p-3"
						onMouseEnter={engageDashboardAutofill}
					>
						<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mb-2 font-medium')}>
							{t('customerSummaryEditor.autofill.groupTitle')}
						</p>
						<p className="mb-3 text-xs leading-relaxed text-(--desktop-text-secondary)">
							{t('customerSummaryEditor.autofill.hint')}
						</p>
						{!dashboardAutofillEngaged ? (
							<p className="text-xs text-(--desktop-text-muted)">
								{t('customerSummaryEditor.autofill.hoverToLoadDashboard')}
							</p>
						) : dashboardQuery.isLoading || dashboardQuery.isFetching ? (
							<div className="flex items-center gap-2 text-xs text-(--desktop-text-muted)">
								<ArrowPathIcon
									className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								{t('customerSummaryEditor.autofill.loadingDashboard')}
							</div>
						) : dashboardQuery.isError ? (
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-xs text-amber-600">
									{t('customerSummaryEditor.autofill.dashboardError')}
								</p>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="ghost"
									className="h-7"
									onClick={() => void dashboardQuery.refetch()}
								>
									{t('customerSummaryEditor.autofill.retry')}
								</DesktopAppButton>
							</div>
						) : (
							<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
								<DesktopAppButton
									type="button"
									size="sm"
									variant="neutral"
									className="h-8"
									disabled={autofillDisabled}
									onFocus={engageDashboardAutofill}
									onClick={applyBasics}
								>
									{t('customerSummaryEditor.autofill.fromBasics')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="neutral"
									className="h-8"
									disabled={autofillDisabled}
									onClick={applyBullets}
								>
									{t('customerSummaryEditor.autofill.fromBullets')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="neutral"
									className="h-8"
									disabled={autofillDisabled}
									onClick={applyMetrics}
								>
									{t('customerSummaryEditor.autofill.fromMetrics')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="accent"
									className="h-8"
									disabled={autofillDisabled}
									onClick={applyAll}
								>
									{t('customerSummaryEditor.autofill.all')}
								</DesktopAppButton>
							</div>
						)}
					</fieldset>
				) : null}

				{summaryQuery.isLoading ? (
					<div className="flex items-center gap-2 text-sm text-(--desktop-text-muted) antialiased">
						<ArrowPathIcon
							className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('customerSummaryEditor.loading')}
					</div>
				) : summaryQuery.isError ? (
					<p className="text-sm text-(--desktop-text-dim)">
						{t('customerSummaryEditor.loadError')}
					</p>
				) : (
					<>
						<label className="block space-y-1">
							<span className={cn(DESKTOP_TYPOGRAPHY.meta, 'font-medium')}>
								{t('customerSummaryEditor.headline')}
							</span>
							<input
								className={cn(mcForm, 'w-full rounded-md px-2 py-1.5 text-sm')}
								maxLength={200}
								value={headline}
								onChange={(e) => setHeadline(e.target.value)}
							/>
						</label>
						<label className="block space-y-1">
							<span className={cn(DESKTOP_TYPOGRAPHY.meta, 'font-medium')}>
								{t('customerSummaryEditor.intro')}
							</span>
							<textarea
								className={cn(
									mcForm,
									'min-h-[88px] w-full rounded-md px-2 py-1.5 text-sm'
								)}
								maxLength={4000}
								value={intro}
								onChange={(e) => setIntro(e.target.value)}
							/>
						</label>

						<div className="space-y-2">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className={cn(DESKTOP_TYPOGRAPHY.meta, 'font-medium')}>
									{t('customerSummaryEditor.bullets')}
								</span>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="ghost"
									className={cn(DESKTOP_TYPOGRAPHY.caption, 'h-7')}
									onClick={addBullet}
									disabled={bullets.length >= 24}
								>
									{t('customerSummaryEditor.addBullet')}
								</DesktopAppButton>
							</div>
							<ul className="space-y-2">
								{bullets.map((row, i) => (
									<li key={row.id} className="flex gap-2">
										<input
											className={cn(
												mcForm,
												'min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm'
											)}
											maxLength={500}
											value={row.value}
											onChange={(e) => setBullet(i, e.target.value)}
											placeholder={t('customerSummaryEditor.bulletPlaceholder')}
										/>
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											className="shrink-0"
											onClick={() => removeBullet(i)}
											disabled={bullets.length <= 1 && !row.value}
											aria-label={t('customerSummaryEditor.removeRowAria')}
										>
											×
										</DesktopAppButton>
									</li>
								))}
							</ul>
						</div>

						<div className="space-y-2">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className={cn(DESKTOP_TYPOGRAPHY.meta, 'font-medium')}>
									{t('customerSummaryEditor.metrics')}
								</span>
								<DesktopAppButton
									type="button"
									size="sm"
									variant="ghost"
									className={cn(DESKTOP_TYPOGRAPHY.caption, 'h-7')}
									onClick={addMetric}
									disabled={metrics.length >= 12}
								>
									{t('customerSummaryEditor.addMetric')}
								</DesktopAppButton>
							</div>
							<ul className="space-y-2">
								{metrics.map((row, i) => (
									<li
										key={row.id}
										className="flex flex-wrap gap-2 sm:flex-nowrap"
									>
										<input
											className={cn(
												mcForm,
												'min-w-[120px] flex-1 rounded-md px-2 py-1.5 text-sm'
											)}
											maxLength={120}
											value={row.label}
											onChange={(e) => setMetric(i, 'label', e.target.value)}
											placeholder={t('customerSummaryEditor.metricLabelPh')}
										/>
										<input
											className={cn(
												mcForm,
												'min-w-[120px] flex-1 rounded-md px-2 py-1.5 text-sm'
											)}
											maxLength={500}
											value={row.value}
											onChange={(e) => setMetric(i, 'value', e.target.value)}
											placeholder={t('customerSummaryEditor.metricValuePh')}
										/>
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											className="shrink-0"
											onClick={() => removeMetric(i)}
											aria-label={t('customerSummaryEditor.removeRowAria')}
										>
											×
										</DesktopAppButton>
									</li>
								))}
							</ul>
						</div>

						{saveMutation.isError ? (
							<p className="text-xs text-amber-600">
								{t('customerSummaryEditor.saveError')}
							</p>
						) : null}
					</>
				)}
			</div>
		</div>
	);
}
