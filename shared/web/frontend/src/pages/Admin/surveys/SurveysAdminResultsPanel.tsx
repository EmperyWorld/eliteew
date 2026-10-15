/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin results: charts, raw responses table, and CSV export.
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import {
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppSkeleton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';
import { adminSurveyResultsSummary } from '@/pages/Desktop/services/productDesktopSurveysApi';
import { toast } from 'sonner';
import { SurveyAdminResponsesTable } from './SurveyAdminResponsesTable';
import {
	SurveyAdminResponsesDateFilter,
	type SurveyResponsesDateFilterValue,
} from './SurveyAdminResponsesDateFilter';
import { SurveyAdminResultsKpiHero } from './SurveyAdminResultsKpiHero';
import type { SurveyResponseDateFilter } from './surveyAdminResultsFormat';
import {
	buildSurveyResponsesCsv,
	downloadTextFile,
	fetchAllSurveyResponsesForExport,
} from './surveyAdminCsvExport';
import type { SurveyUserLookup } from './surveyAdminUserLookup';

type ResultsView = 'charts' | 'responses';

type Props = {
	surveyId: string;
	surveyTitle: string;
	questions: SurveyQuestion[];
	userLookup: SurveyUserLookup;
};

export function SurveysAdminResultsPanel({
	surveyId,
	surveyTitle,
	questions,
	userLookup,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const [exporting, setExporting] = React.useState(false);
	const [view, setView] = React.useState<ResultsView>('charts');
	const [dateDraft, setDateDraft] =
		React.useState<SurveyResponsesDateFilterValue>({
			from: '',
			to: '',
		});
	const [dateFilter, setDateFilter] = React.useState<SurveyResponseDateFilter>(
		{}
	);
	const [submittedSort, setSubmittedSort] = React.useState<'asc' | 'desc'>(
		'desc'
	);
	const responseListParams = React.useMemo(
		(): SurveyResponseDateFilter => ({
			...dateFilter,
			submitted_sort: submittedSort,
		}),
		[dateFilter, submittedSort]
	);
	const q = useQuery({
		queryKey: ['admin-surveys', 'results', surveyId],
		queryFn: () => adminSurveyResultsSummary(surveyId),
		enabled: Boolean(surveyId),
	});

	const handleExportCsv = async () => {
		if (!questions.length) return;
		setExporting(true);
		try {
			const rows = await fetchAllSurveyResponsesForExport(
				surveyId,
				responseListParams
			);
			const csv = buildSurveyResponsesCsv(questions, rows, userLookup);
			const slug = (surveyTitle.trim() || 'survey')
				.replace(/[^\w.-]+/g, '_')
				.slice(0, 48);
			downloadTextFile(`${slug}-responses.csv`, csv);
			toast.success(t('admin.exportDone', { count: rows.length }));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : String(e));
		} finally {
			setExporting(false);
		}
	};

	if (q.isLoading) {
		return (
			<div className="space-y-4">
				<DesktopAppSkeleton className="h-5 w-48" />
				<DesktopAppSkeleton className="h-64 w-full rounded-(--desktop-radius-lg)" />
			</div>
		);
	}
	if (q.isError || !q.data) {
		return (
			<DesktopAppPanel className="flex flex-col items-start gap-3 p-4">
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('admin.resultsError')}</p>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					onClick={() => void q.refetch()}
				>
					{t('errors.retry')}
				</DesktopAppButton>
			</DesktopAppPanel>
		);
	}

	const chartQuestions = q.data.questions ?? [];
	const completedCount = q.data.completed_count ?? 0;
	const eligibleUsers = q.data.eligible_users ?? 0;
	const completionRate = q.data.completion_rate ?? 0;

	const kpiHero = (
		<SurveyAdminResultsKpiHero
			eligibleUsers={eligibleUsers}
			completedCount={completedCount}
			completionRate={completionRate}
		/>
	);

	const toolbar = (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					className={cn(
						DESKTOP_INTERACTIVE.btnRounded,
						'px-3 py-1.5 text-sm',
						view === 'charts'
							? 'bg-[rgb(var(--desktop-accent-rgb)/0.2)] text-(--desktop-text-primary) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.35)]'
							: 'bg-(--desktop-surface-soft) text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover)'
					)}
					onClick={() => setView('charts')}
				>
					{t('admin.resultsViews.charts')}
				</button>
				<button
					type="button"
					className={cn(
						DESKTOP_INTERACTIVE.btnRounded,
						'px-3 py-1.5 text-sm',
						view === 'responses'
							? 'bg-[rgb(var(--desktop-accent-rgb)/0.2)] text-(--desktop-text-primary) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.35)]'
							: 'bg-(--desktop-surface-soft) text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover)'
					)}
					onClick={() => setView('responses')}
				>
					{t('admin.resultsViews.responses')}
				</button>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					{t('admin.responseCount', { count: completedCount })}
				</p>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					disabled={exporting || completedCount === 0 || !questions.length}
					onClick={() => void handleExportCsv()}
				>
					{exporting ? t('admin.exporting') : t('admin.exportCsv')}
				</DesktopAppButton>
			</div>
		</div>
	);

	if (view === 'responses') {
		return (
			<div className="space-y-4">
				{kpiHero}
				{toolbar}
				<SurveyAdminResponsesDateFilter
					value={dateDraft}
					onChange={setDateDraft}
					onApply={() =>
						setDateFilter({
							submitted_from: dateDraft.from || undefined,
							submitted_to: dateDraft.to || undefined,
						})
					}
					onClear={() => {
						setDateDraft({ from: '', to: '' });
						setDateFilter({});
					}}
				/>
				<SurveyAdminResponsesTable
					key={`${surveyId}-${responseListParams.submitted_from ?? ''}-${responseListParams.submitted_to ?? ''}-${submittedSort}`}
					surveyId={surveyId}
					questions={questions}
					userLookup={userLookup}
					listParams={responseListParams}
					submittedSort={submittedSort}
					onSubmittedSortChange={setSubmittedSort}
				/>
			</div>
		);
	}

	if (!chartQuestions.length && completedCount === 0) {
		return (
			<div className="space-y-4">
				{kpiHero}
				{toolbar}
				<DesktopAppPanel className="p-4">
					<p className={DESKTOP_TYPOGRAPHY.meta}>{t('admin.resultsEmpty')}</p>
				</DesktopAppPanel>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{kpiHero}
			{toolbar}
			{chartQuestions.map((raw, idx) => {
				const qrow = raw as Record<string, unknown>;
				const prompt = String(qrow.prompt ?? qrow.question_key ?? idx);
				const distribution = qrow.distribution as
					| Record<string, number>
					| undefined;
				const buckets = distribution
					? Object.entries(distribution).map(([label, count]) => ({
							label,
							count,
						}))
					: [];
				if (!buckets.length) {
					return (
						<DesktopAppPanel
							key={String(qrow.question_key ?? idx)}
							className="p-4"
						>
							<h3 className={DESKTOP_TYPOGRAPHY.subtitle}>{prompt}</h3>
							<p
								className={cn(
									'mt-2',
									DESKTOP_TYPOGRAPHY.caption,
									'text-(--desktop-text-muted)'
								)}
							>
								{t('admin.noChart')}
							</p>
						</DesktopAppPanel>
					);
				}
				return (
					<DesktopAppPanel
						key={String(qrow.question_key ?? idx)}
						className="p-4"
					>
						<h3 className={cn('mb-3', DESKTOP_TYPOGRAPHY.subtitle)}>
							{prompt}
						</h3>
						<div className="h-64">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={buckets}>
									<CartesianGrid strokeDasharray="3 3" opacity={0.2} />
									<XAxis dataKey="label" tick={{ fontSize: 11 }} />
									<YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
									<Tooltip />
									<Bar
										dataKey="count"
										fill="rgb(var(--desktop-accent-rgb))"
										radius={4}
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</DesktopAppPanel>
				);
			})}
		</div>
	);
}
