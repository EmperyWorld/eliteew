import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import {
	customerCabinetCustomerSummaryQueryKey,
	customerCabinetCustomerSummaryQueryOptions,
} from './customerCabinetQueryOptions';

import { parseCustomerFacingSummaryRecord } from './customerFacingSummaryDisplay';
import { ArrowPathIcon, Squares2X2Icon } from '@heroicons/react/24/outline';

function buildBulletRowKeys(bullets: string[]) {
	const counts = new Map<string, number>();
	return bullets.map((text) => {
		const n = (counts.get(text) ?? 0) + 1;
		counts.set(text, n);
		return { key: `b:${text}#${n}`, text };
	});
}

function buildMetricRowKeys(metrics: Array<{ label: string; value: string }>) {
	const counts = new Map<string, number>();
	return metrics.map((m) => {
		const core = `${m.label}\u0000${m.value}`;
		const n = (counts.get(core) ?? 0) + 1;
		counts.set(core, n);
		return { key: `m:${core}#${n}`, label: m.label, value: m.value };
	});
}

export interface CustomerFacingSummaryReadProps {
	projectId: string;
	className?: string;
}

export function CustomerFacingSummaryRead({
	projectId,
	className,
}: CustomerFacingSummaryReadProps) {
	const { t } = useTranslation('customerCabinet');
	const qc = useQueryClient();
	const summaryKey = customerCabinetCustomerSummaryQueryKey(projectId);

	const refetchSummary = (): void => {
		void qc.invalidateQueries({ queryKey: summaryKey });
	};

	const q = useQuery({
		...customerCabinetCustomerSummaryQueryOptions(projectId),
		enabled: Boolean(projectId),
	});

	if (q.isLoading) {
		return (
			<div
				className={cn(
					'flex min-h-[160px] items-center justify-center gap-2 text-sm text-(--desktop-text-muted) antialiased',
					className
				)}
			>
				<ArrowPathIcon className="h-5 w-5 animate-spin" aria-hidden />
				{t('summary.loading')}
			</div>
		);
	}

	if (q.isError) {
		return (
			<div
				className={cn(
					'flex flex-col items-start gap-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 p-4',
					className
				)}
			>
				<p className="text-sm text-(--desktop-text-dim)">
					{t('summary.loadError')}
				</p>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					disabled={q.isFetching}
					onClick={refetchSummary}
				>
					{q.isFetching ? (
						<>
							<ArrowPathIcon
								className="mr-1.5 h-3.5 w-3.5 animate-spin"
								aria-hidden
							/>
							{t('summary.retrying')}
						</>
					) : (
						t('summary.retry')
					)}
				</DesktopAppButton>
			</div>
		);
	}

	const rec = q.data?.summary;
	const { headline, intro, bullets, metrics, hasBody } =
		parseCustomerFacingSummaryRecord(rec);

	const bulletRows = buildBulletRowKeys(bullets);
	const metricRows = buildMetricRowKeys(metrics);

	if (!hasBody) {
		return (
			<DesktopAppEmptyState
				icon={<Squares2X2Icon className="h-10 w-10 opacity-50" aria-hidden />}
				title={t('summary.emptyTitle')}
				description={t('summary.emptyDescription')}
				className={cn('max-w-lg py-8', className)}
			/>
		);
	}

	return (
		<div className={cn('space-y-4', className)}>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 space-y-1">
					<DesktopAppSectionLabel className="mb-0">
						{t('workspace.tabs.summary')}
					</DesktopAppSectionLabel>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'text-(--desktop-text-secondary)'
						)}
					>
						{t('summary.leadPublishedHint')}
					</p>
				</div>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="ghost"
					className="h-7 shrink-0 text-[11px] text-(--desktop-text-muted)"
					disabled={q.isFetching}
					onClick={refetchSummary}
				>
					{q.isFetching ? (
						<>
							<ArrowPathIcon
								className="mr-1 h-3 w-3 animate-spin"
								aria-hidden
							/>
							{t('summary.refreshing')}
						</>
					) : (
						t('summary.refresh')
					)}
				</DesktopAppButton>
			</div>
			<DesktopAppSurface
				variant="panel"
				className="space-y-4 border border-(--desktop-border-subtle) p-4"
			>
				{headline ? (
					<h2 className="text-base font-semibold text-(--desktop-text-primary)">
						{headline}
					</h2>
				) : null}
				{intro ? (
					<p className="whitespace-pre-wrap text-sm leading-relaxed text-(--desktop-text-secondary)">
						{intro}
					</p>
				) : null}
				{bullets.length > 0 ? (
					<ul className="list-inside list-disc space-y-1.5 text-sm text-(--desktop-text-secondary)">
						{bulletRows.map((row) => (
							<li key={row.key}>{row.text}</li>
						))}
					</ul>
				) : null}
				{metrics.length > 0 ? (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{metricRows.map((row) => (
							<div
								key={row.key}
								className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5"
							>
								<div className="text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-muted)">
									{row.label || '—'}
								</div>
								<div className="mt-1 text-sm font-semibold text-(--desktop-text-primary)">
									{row.value || '—'}
								</div>
							</div>
						))}
					</div>
				) : null}
			</DesktopAppSurface>
			{rec?.updated_at ? (
				<p className="text-center text-[11px] text-(--desktop-text-muted)">
					{t('summary.updatedHint', {
						time: new Date(rec.updated_at).toLocaleString(),
					})}
				</p>
			) : null}
		</div>
	);
}
