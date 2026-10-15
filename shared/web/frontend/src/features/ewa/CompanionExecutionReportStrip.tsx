/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders structured execution reports from companion protocol v1 (failed / partial / not_started).
 *
 * Invariants:
 * - Only non-success outcomes are shown; does not replace assistant reply bubble.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/services/ewa/ewaCompanionChatApi.ts
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CompanionExecutionReport } from '@/services/ewa/ewaCompanionChatApi';

type Props = {
	reports: CompanionExecutionReport[];
	orchestrationOutcome?: string | null;
};

const VISIBLE_OUTCOMES = new Set([
	'failed',
	'partial',
	'not_started',
	'unavailable',
]);

export function CompanionExecutionReportStrip({
	reports,
	orchestrationOutcome,
}: Props) {
	const { i18n, t } = useTranslation();
	const [open, setOpen] = useState(false);
	const ru = i18n.language.startsWith('ru');
	const visible = reports.filter((r) => VISIBLE_OUTCOMES.has(r.outcome));
	if (visible.length === 0 && orchestrationOutcome !== 'fell_through') {
		return null;
	}
	const primary = visible[0];
	const message = ru
		? primary?.reason_message_ru || primary?.reason_message_en
		: primary?.reason_message_en || primary?.reason_message_ru;
	return (
		<div
			className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
			data-testid="ewa-companion-execution-report-strip"
		>
			<p className="font-medium">
				{t('ewaCompanion.executionReportTitle', 'Статус выполнения')}
			</p>
			{message ? <p className="mt-1 opacity-90">{message}</p> : null}
			{orchestrationOutcome === 'fell_through' ? (
				<p className="mt-1 text-xs opacity-75">
					{t(
						'ewaCompanion.executionReportFellThrough',
						'Ответ сформирован в режиме диалога без инструмента.'
					)}
				</p>
			) : null}
			{primary?.resume_conditions?.length ? (
				<button
					type="button"
					className="mt-2 text-xs underline opacity-80"
					onClick={() => setOpen((v) => !v)}
				>
					{t('ewaCompanion.executionReportDetails', 'Подробности')}
				</button>
			) : null}
			{open && primary?.resume_conditions?.length ? (
				<ul className="mt-1 list-disc pl-4 text-xs opacity-90">
					{primary.resume_conditions.map((line) => (
						<li key={line}>{line}</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
