/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build CSV export for admin survey responses (paginated fetch + download).
 *
 * Related:
 * - SurveysAdminResultsPanel.tsx
 */
import type { SurveyQuestion } from '@/pages/Desktop/services/productDesktopSurveysApi';
import { adminSurveyResultsResponses } from '@/pages/Desktop/services/productDesktopSurveysApi';
import type { SurveyResponseDateFilter } from './surveyAdminResultsFormat';
import type { SurveyUserLookup } from './surveyAdminUserLookup';

export type SurveyResponseExportRow = {
	user_id: string;
	submitted_at: string;
	answers_json: Record<string, unknown>;
};

export function escapeCsvCell(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function formatAnswerCell(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (Array.isArray(value)) return value.map(String).join('; ');
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	return String(value);
}

export function buildSurveyResponsesCsv(
	questions: SurveyQuestion[],
	rows: SurveyResponseExportRow[],
	userLookup?: SurveyUserLookup
): string {
	const headers = [
		'submitted_at',
		'user_id',
		'username',
		'email',
		...questions.map((q) => q.question_key),
	];
	const lines = [headers.map(escapeCsvCell).join(',')];
	for (const row of rows) {
		const profile = userLookup?.get(row.user_id);
		const cells = [
			row.submitted_at,
			row.user_id,
			profile?.username ?? '',
			profile?.email ?? '',
			...questions.map((q) =>
				formatAnswerCell(row.answers_json[q.question_key])
			),
		];
		lines.push(cells.map(escapeCsvCell).join(','));
	}
	return `${lines.join('\n')}\n`;
}

export async function fetchAllSurveyResponsesForExport(
	surveyId: string,
	listParams?: SurveyResponseDateFilter
): Promise<SurveyResponseExportRow[]> {
	const pageSize = 200;
	const items: SurveyResponseExportRow[] = [];
	let offset = 0;
	let total = Number.POSITIVE_INFINITY;

	while (offset < total) {
		const page = await adminSurveyResultsResponses(surveyId, {
			limit: pageSize,
			offset,
			submitted_from: listParams?.submitted_from,
			submitted_to: listParams?.submitted_to,
			submitted_sort: listParams?.submitted_sort,
		});
		total = page.total;
		for (const item of page.items) {
			items.push({
				user_id: item.user_id,
				submitted_at: item.submitted_at,
				answers_json: item.answers_json,
			});
		}
		offset += page.items.length;
		if (!page.items.length) break;
	}

	return items;
}

export function downloadTextFile(
	filename: string,
	content: string,
	mime = 'text/csv;charset=utf-8'
): void {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
