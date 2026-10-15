/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lightweight strip with successful server tools executed in the current companion turn.
 *
 * Invariants:
 * - Shows only success-like statuses and never replaces assistant reply text.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/services/ewa/ewaCompanionChatApi.ts
 */

import { useTranslation } from 'react-i18next';

import { companionToolIdLabel } from '@/features/ewa/companionOperations/companionOperationsUi';
import type { CompanionToolTraceEntry } from '@/services/ewa/ewaCompanionChatApi';

type Props = {
	trace: CompanionToolTraceEntry[];
};

const SUCCESS_STATUSES = new Set([
	'ok',
	'accepted',
	'memory_append',
	'completed',
]);
const MAX_VISIBLE = 3;

export function CompanionToolTraceStrip({ trace }: Props) {
	const { t } = useTranslation<'marketing'>();
	const visible = trace.filter((row) => {
		const st = (row.status || 'ok').trim().toLowerCase();
		return SUCCESS_STATUSES.has(st);
	});
	if (visible.length === 0) return null;
	const shown = visible.slice(0, MAX_VISIBLE);
	const hiddenCount = Math.max(0, visible.length - shown.length);
	return (
		<div className="mb-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
			<p className="font-medium">
				{t('ewaCompanion.toolTraceTitle', 'Выполненные инструменты')}
			</p>
			<ul className="mt-1 list-disc pl-4 text-xs opacity-90">
				{shown.map((row) => (
					<li key={`${row.tool}:${row.branch || ''}:${row.status || ''}`}>
						{companionToolIdLabel(t, row.tool)}
					</li>
				))}
			</ul>
			{hiddenCount > 0 ? (
				<p className="mt-1 text-xs opacity-75">
					{t('ewaCompanion.toolTraceMore', '+{{count}} ещё', {
						count: hiddenCount,
					})}
				</p>
			) : null}
		</div>
	);
}
