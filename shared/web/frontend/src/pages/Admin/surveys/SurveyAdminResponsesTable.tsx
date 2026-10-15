/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Paginated admin table of raw survey responses with readable answer cells.
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatSurveyAnswerDisplay } from '@/features/surveys/desktop/surveyAnswerFormat';
import {
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppSkeleton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';
import { adminSurveyResultsResponses } from '@/pages/Desktop/services/productDesktopSurveysApi';
import {
	resolveSurveyUserLabel,
	type SurveyUserLookup,
} from './surveyAdminUserLookup';

import type { SurveyResponseDateFilter } from './surveyAdminResultsFormat';

const PAGE_SIZE = 20;

type Props = {
	surveyId: string;
	questions: SurveyQuestion[];
	userLookup: SurveyUserLookup;
	listParams?: SurveyResponseDateFilter;
	submittedSort: 'asc' | 'desc';
	onSubmittedSortChange: (sort: 'asc' | 'desc') => void;
};

export function SurveyAdminResponsesTable({
	surveyId,
	questions,
	userLookup,
	listParams,
	submittedSort,
	onSubmittedSortChange,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const [page, setPage] = React.useState(0);
	const offset = page * PAGE_SIZE;

	const q = useQuery({
		queryKey: [
			'admin-surveys',
			'responses',
			surveyId,
			page,
			listParams?.submitted_from,
			listParams?.submitted_to,
			submittedSort,
		],
		queryFn: () =>
			adminSurveyResultsResponses(surveyId, {
				limit: PAGE_SIZE,
				offset,
				submitted_from: listParams?.submitted_from,
				submitted_to: listParams?.submitted_to,
				submitted_sort: submittedSort,
			}),
		enabled: Boolean(surveyId),
	});

	if (q.isLoading) {
		return (
			<div className="space-y-3">
				<DesktopAppSkeleton className="h-10 w-full" />
				<DesktopAppSkeleton className="h-32 w-full" />
			</div>
		);
	}

	if (q.isError || !q.data) {
		return (
			<DesktopAppPanel className="flex flex-col items-start gap-3 p-4">
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					{t('admin.responsesTableError')}
				</p>
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

	const { items, total } = q.data;
	if (!total) {
		return (
			<DesktopAppPanel className="p-4">
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('admin.resultsEmpty')}</p>
			</DesktopAppPanel>
		);
	}

	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	return (
		<div className="space-y-3">
			<div className="overflow-x-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle)">
				<table className="min-w-full text-left text-sm">
					<thead className="bg-(--desktop-surface-soft)">
						<tr>
							<th className="px-3 py-2 font-medium text-(--desktop-text-muted)">
								{t('admin.responsesTable.user')}
							</th>
							<th className="px-3 py-2 font-medium text-(--desktop-text-muted)">
								{t('admin.responsesTable.submitted')}
							</th>
							{questions.map((question) => (
								<th
									key={question.question_key}
									className="max-w-48 px-3 py-2 font-medium text-(--desktop-text-muted)"
								>
									<span className="line-clamp-2">{question.prompt}</span>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{items.map((row) => (
							<tr
								key={row.id}
								className="border-t border-(--desktop-border-subtle) align-top"
							>
								<td className="px-3 py-2">
									<p className="font-medium text-(--desktop-text-primary)">
										{resolveSurveyUserLabel(userLookup, row.user_id)}
									</p>
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.caption,
											'text-(--desktop-text-dim)'
										)}
									>
										{row.user_id}
									</p>
								</td>
								<td className="whitespace-nowrap px-3 py-2 text-(--desktop-text-secondary)">
									{new Date(row.submitted_at).toLocaleString()}
								</td>
								{questions.map((question) => (
									<td
										key={`${row.id}-${question.question_key}`}
										className="max-w-56 px-3 py-2 text-(--desktop-text-secondary)"
									>
										<span className="line-clamp-4">
											{formatSurveyAnswerDisplay(
												question,
												row.answers_json[question.question_key],
												t
											)}
										</span>
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className={DESKTOP_TYPOGRAPHY.caption}>
					{t('admin.responsesTable.page', {
						page: page + 1,
						pages: pageCount,
						total,
					})}
				</p>
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						onClick={() =>
							onSubmittedSortChange(submittedSort === 'desc' ? 'asc' : 'desc')
						}
					>
						{submittedSort === 'desc'
							? t('admin.responsesTable.sortNewest')
							: t('admin.responsesTable.sortOldest')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						disabled={page <= 0}
						onClick={() => setPage((p) => Math.max(0, p - 1))}
					>
						{t('admin.responsesTable.prev')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						disabled={page + 1 >= pageCount}
						onClick={() => setPage((p) => p + 1)}
					>
						{t('admin.responsesTable.next')}
					</DesktopAppButton>
				</div>
			</div>
		</div>
	);
}
