/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Admin queue for Social Hub user reports (`social_user_reports`).
 *
 * Invariants:
 * - Status transitions match backend: open → in_review → resolved|dismissed.
 * - List/detail show summary fields only (reason/details/usernames).
 *
 * Related:
 * - adminSocialReportsApi.ts
 * - documentation/product/SOCIAL-HUB.md
 */

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DesktopProductStatusBanner } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	adminListSocialReports,
	adminPatchSocialReport,
	type SocialReportAdminItem,
} from './adminSocialReportsApi';
import {
	parseAdminSocialReportsUrl,
	readReportIdFromUrl,
	replaceAdminSocialReportsUrl,
	type AdminSocialReportsUrlState,
} from './adminSocialReportsUrlFilters';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 40;

const STATUS_OPTIONS = [
	'',
	'open',
	'in_review',
	'resolved',
	'dismissed',
] as const;

const PATCH_OPTIONS = ['open', 'in_review', 'resolved', 'dismissed'] as const;

function statusLabel(t: (key: string) => string, status: string): string {
	const key = `adminSocialReports.status.${status || 'all'}`;
	const translated = t(key);
	return translated === key
		? status || t('adminSocialReports.status.all')
		: translated;
}

export function SocialReportsAdminSection(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const qc = useQueryClient();
	const [status, setStatus] = React.useState('');
	const [searchInput, setSearchInput] = React.useState('');
	const [debouncedQ, setDebouncedQ] = React.useState('');
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const urlHydratedRef = React.useRef(false);

	React.useEffect(() => {
		if (urlHydratedRef.current || typeof window === 'undefined') return;
		const parsed = parseAdminSocialReportsUrl(
			new URLSearchParams(window.location.search)
		);
		if (parsed) {
			setStatus(parsed.status);
			setSearchInput(parsed.q);
			setDebouncedQ(parsed.q);
			setSelectedId(parsed.reportId);
		} else {
			setSelectedId(readReportIdFromUrl());
		}
		urlHydratedRef.current = true;
	}, []);

	React.useEffect(() => {
		const timer = window.setTimeout(() => {
			setDebouncedQ(searchInput.trim());
		}, SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [searchInput]);

	const urlState = React.useMemo(
		(): AdminSocialReportsUrlState => ({
			reportId: selectedId,
			status,
			q: debouncedQ,
		}),
		[selectedId, status, debouncedQ]
	);

	React.useEffect(() => {
		if (!urlHydratedRef.current || typeof window === 'undefined') return;
		const timer = window.setTimeout(() => {
			replaceAdminSocialReportsUrl(urlState);
		}, SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [urlState]);

	const listQuery = useQuery({
		queryKey: ['admin', 'socialReports', status, debouncedQ, 'v1'],
		queryFn: () =>
			adminListSocialReports({
				status: status || undefined,
				q: debouncedQ || undefined,
				limit: PAGE_SIZE,
				offset: 0,
			}),
		staleTime: 30_000,
	});

	const patchMut = useMutation({
		mutationFn: (p: { id: string; status: string }) =>
			adminPatchSocialReport(p.id, { status: p.status }),
		onSuccess: async (item) => {
			toast.success(t('adminSocialReports.updated'));
			setSelectedId(item.id);
			await qc.invalidateQueries({ queryKey: ['admin', 'socialReports'] });
			await qc.invalidateQueries({
				queryKey: ['admin', 'shell-badge', 'social-reports-open'],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const items = listQuery.data?.items ?? [];
	const total = listQuery.data?.total ?? 0;
	const selected =
		items.find((row) => row.id === selectedId) ??
		(selectedId ? null : (items[0] ?? null));

	React.useEffect(() => {
		if (!selectedId && items[0]) {
			setSelectedId(items[0].id);
		}
	}, [items, selectedId]);

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 p-4">
			<header className="space-y-1">
				<h2
					id="admin-social-reports-title"
					className={DESKTOP_TYPOGRAPHY.subtitle}
				>
					{t('adminSocialReports.title')}
				</h2>
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					{t('adminSocialReports.subtitle')}
				</p>
			</header>

			{listQuery.isError ? (
				<DesktopProductStatusBanner
					tone="danger"
					role="alert"
					aria-live="assertive"
					title={t('adminSocialReports.loadFailed')}
					actions={
						<button
							type="button"
							className="rounded-md border border-(--desktop-border) px-3 py-1.5 text-sm"
							onClick={() => void listQuery.refetch()}
						>
							{t('adminSocialReports.retry')}
						</button>
					}
				/>
			) : null}

			<div className="flex flex-wrap items-end gap-3">
				<label className="flex min-w-40 flex-col gap-1 text-sm">
					<span className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminSocialReports.filterStatus')}
					</span>
					<select
						className="rounded-md border border-(--desktop-border) bg-(--desktop-surface) px-2 py-1.5"
						value={status}
						onChange={(e) => setStatus(e.target.value)}
					>
						{STATUS_OPTIONS.map((value) => (
							<option key={value || 'all'} value={value}>
								{statusLabel(t, value)}
							</option>
						))}
					</select>
				</label>
				<label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
					<span className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminSocialReports.search')}
					</span>
					<input
						className="rounded-md border border-(--desktop-border) bg-(--desktop-surface) px-2 py-1.5"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder={t('adminSocialReports.searchPlaceholder')}
					/>
				</label>
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					{t('adminSocialReports.total', { count: total })}
				</p>
			</div>

			<div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
				<ul className="min-h-0 space-y-2 overflow-auto rounded-lg border border-(--desktop-border) p-2">
					{listQuery.isLoading ? (
						<li className={DESKTOP_TYPOGRAPHY.meta} role="status">
							{t('adminSocialReports.loading')}
						</li>
					) : null}
					{!listQuery.isLoading && items.length === 0 ? (
						<li className={DESKTOP_TYPOGRAPHY.meta}>
							{t('adminSocialReports.empty')}
						</li>
					) : null}
					{items.map((row) => (
						<li key={row.id}>
							<button
								type="button"
								id={`admin-social-report-${row.id}`}
								className={`w-full rounded-md border px-3 py-2 text-left transition ${
									selected?.id === row.id
										? 'border-(--desktop-accent) bg-(--desktop-surface-elevated)'
										: 'border-transparent hover:bg-(--desktop-surface-elevated)'
								}`}
								onClick={() => setSelectedId(row.id)}
							>
								<div className="flex items-center justify-between gap-2">
									<span className="font-medium">
										{row.reported_display_name}
									</span>
									<span className={DESKTOP_TYPOGRAPHY.meta}>
										{statusLabel(t, row.status)}
									</span>
								</div>
								<p className={DESKTOP_TYPOGRAPHY.meta}>
									{row.reason} · {row.reporter_display_name}
								</p>
							</button>
						</li>
					))}
				</ul>

				<section
					className="min-h-0 overflow-auto rounded-lg border border-(--desktop-border) p-4"
					aria-label={t('adminSocialReports.detailAria')}
				>
					{selected ? (
						<ReportDetail
							report={selected}
							busy={patchMut.isPending}
							onStatus={(next) =>
								patchMut.mutate({ id: selected.id, status: next })
							}
							t={t}
						/>
					) : (
						<p className={DESKTOP_TYPOGRAPHY.meta}>
							{t('adminSocialReports.selectHint')}
						</p>
					)}
				</section>
			</div>
		</div>
	);
}

function ReportDetail({
	report,
	busy,
	onStatus,
	t,
}: {
	report: SocialReportAdminItem;
	busy: boolean;
	onStatus: (status: string) => void;
	t: (key: string, opts?: Record<string, unknown>) => string;
}): React.ReactElement {
	return (
		<div className="space-y-4">
			<div>
				<h3 className={DESKTOP_TYPOGRAPHY.subtitle}>
					{report.reported_display_name}
				</h3>
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					@{report.reported_username ?? '—'} · {report.reported_user_id}
				</p>
			</div>
			<dl className="grid gap-2 text-sm sm:grid-cols-2">
				<div>
					<dt className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminSocialReports.reporter')}
					</dt>
					<dd>
						{report.reporter_display_name} (@
						{report.reporter_username ?? '—'})
					</dd>
				</div>
				<div>
					<dt className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminSocialReports.createdAt')}
					</dt>
					<dd>{report.created_at ?? '—'}</dd>
				</div>
				<div>
					<dt className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminSocialReports.reason')}
					</dt>
					<dd>{report.reason}</dd>
				</div>
				<div>
					<dt className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminSocialReports.reviewer')}
					</dt>
					<dd>{report.reviewer_username ?? '—'}</dd>
				</div>
			</dl>
			{report.details ? (
				<div>
					<p className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminSocialReports.details')}
					</p>
					<p className="mt-1 whitespace-pre-wrap text-sm">{report.details}</p>
				</div>
			) : null}
			<label className="flex max-w-xs flex-col gap-1 text-sm">
				<span className={DESKTOP_TYPOGRAPHY.meta}>
					{t('adminSocialReports.setStatus')}
				</span>
				<select
					className="rounded-md border border-(--desktop-border) bg-(--desktop-surface) px-2 py-1.5"
					value={report.status}
					disabled={busy}
					onChange={(e) => onStatus(e.target.value)}
				>
					{PATCH_OPTIONS.map((value) => (
						<option key={value} value={value}>
							{statusLabel(t, value)}
						</option>
					))}
				</select>
			</label>
		</div>
	);
}
