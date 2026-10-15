/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Execution trace (checkpoint log) for agentic sessions in companion operations.
 *
 * Invariants:
 * - Missing or malformed checkpoint arrays degrade to an empty panel, never a Desktop error-boundary crash.
 * - While sessionStatus is non-terminal, panel polls /trace so checkpoints appear without waiting for run_revision.
 * - Soft-filters empty think rows, compose-continue noise, observe ticks, and consecutive duplicate summaries.
 * - Act summaries stay laconic plain text — no raw checkpoint ``#seq`` and no research_plan methodology dumps.
 *
 * Related:
 * - src/features/ewa/agentic/agenticTraceApi.ts
 * - src/features/ewa/agentic/agenticObservabilityActive.ts
 * - src/features/ewa/EwaCompanionChatMarkdown.tsx
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	AGENTIC_OBSERVABILITY_POLL_MS,
	isAgenticObservabilitySessionActive,
} from '@/features/ewa/agentic/agenticObservabilityActive';
import { resolveAgenticObservabilityEmptyMessage } from '@/features/ewa/agentic/agenticObservabilityEmptyState';
import {
	agenticCheckpointSummaryLooksLikeMarkdown,
	filterAgenticTraceRows,
	formatAgenticCheckpointKind,
	humanizeAgenticCheckpointSummary,
} from '@/features/ewa/agentic/agenticObservabilityUi';
import {
	type AgenticCheckpointRow,
	fetchAgenticSessionTrace,
} from '@/features/ewa/agentic/agenticTraceApi';
import { EwaCompanionChatMarkdown } from '@/features/ewa/EwaCompanionChatMarkdown';
import { cn } from '@/utils/cn';

export type AgenticExecutionTraceProps = {
	sessionId: string;
	sessionStatus?: string;
	treeNodeCount?: number;
	refreshToken?: number;
	limit?: number;
};

function kindToneClass(kind: string): string {
	const key = (kind || '').trim().toLowerCase();
	if (key === 'act')
		return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100/90';
	if (key === 'gate')
		return 'border-amber-300/30 bg-amber-300/10 text-amber-100/90';
	if (key === 'think') return 'border-sky-300/25 bg-sky-300/10 text-sky-100/85';
	if (key === 'state_transition') {
		return 'border-white/15 bg-white/5 text-white/55';
	}
	return 'border-white/15 bg-white/5 text-white/65';
}

export function AgenticExecutionTrace({
	sessionId,
	sessionStatus = '',
	treeNodeCount = 0,
	refreshToken = 0,
	limit = 20,
}: AgenticExecutionTraceProps) {
	const { t } = useTranslation('marketing');
	const [rows, setRows] = useState<AgenticCheckpointRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const pollActive = isAgenticObservabilitySessionActive(sessionStatus);

	useEffect(() => {
		let cancelled = false;
		let intervalId: ReturnType<typeof setInterval> | undefined;

		const load = (opts?: { silent?: boolean }) => {
			if (!opts?.silent) {
				setLoading(true);
			}
			setError(null);
			fetchAgenticSessionTrace(sessionId, Math.max(limit, 40))
				.then((res) => {
					if (!cancelled) {
						const checkpoints = Array.isArray(res.checkpoints)
							? res.checkpoints
							: [];
						setRows(filterAgenticTraceRows(checkpoints.slice().reverse()));
					}
				})
				.catch((err: unknown) => {
					if (!cancelled) {
						setError(err instanceof Error ? err.message : 'load_failed');
					}
				})
				.finally(() => {
					if (!cancelled) setLoading(false);
				});
		};

		void refreshToken;
		load();
		if (pollActive) {
			intervalId = setInterval(
				() => load({ silent: true }),
				AGENTIC_OBSERVABILITY_POLL_MS
			);
		}
		return () => {
			cancelled = true;
			if (intervalId !== undefined) clearInterval(intervalId);
		};
	}, [sessionId, refreshToken, limit, pollActive]);

	const visibleRows = useMemo(() => rows.slice(0, limit), [rows, limit]);

	if (loading) {
		return (
			<p className="text-[11px] text-white/50">
				{t('ewaCompanion.agenticTraceLoading', 'Загружаю трассу…')}
			</p>
		);
	}
	if (error) {
		return (
			<p className="text-[11px] text-rose-300/90">
				{t('ewaCompanion.agenticTraceError', 'Не удалось загрузить трассу')}
			</p>
		);
	}
	if (visibleRows.length === 0) {
		return (
			<p className="text-[11px] text-white/45">
				{resolveAgenticObservabilityEmptyMessage(
					'trace',
					sessionStatus,
					{ hasSiblingData: treeNodeCount > 0 },
					t
				)}
			</p>
		);
	}

	return (
		<ol className="mt-1 max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
			{visibleRows.map((row) => {
				const kind = (row.kind || '').trim();
				const payload = row.payload_json;
				const rawSummary =
					typeof payload?.summary === 'string' && payload.summary.trim()
						? payload.summary
						: typeof payload?.reason === 'string' && payload.reason.trim()
							? payload.reason
							: typeof payload?.message === 'string' && payload.message.trim()
								? payload.message
								: '';
				const summary = humanizeAgenticCheckpointSummary(
					String(rawSummary),
					t,
					{
						maxChars: 220,
					}
				);
				const kindLabel = formatAgenticCheckpointKind(kind, t);
				const useMarkdown = agenticCheckpointSummaryLooksLikeMarkdown(summary);
				const isState = kind.toLowerCase() === 'state_transition';

				return (
					<li
						key={row.seq}
						className={cn(
							'rounded-md border px-2 py-1.5',
							isState
								? 'border-white/8 bg-black/15'
								: 'border-white/10 bg-black/25'
						)}
					>
						<div className="mb-1 flex flex-wrap items-center gap-1.5">
							<span
								className={cn(
									'rounded border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide',
									kindToneClass(kind)
								)}
							>
								{kindLabel}
							</span>
						</div>
						{summary ? (
							useMarkdown ? (
								<EwaCompanionChatMarkdown
									markdown={summary}
									className={cn(
										'!text-[11px] !leading-snug text-white/80',
										'prose-headings:!mt-1.5 prose-headings:!mb-1 prose-headings:!text-[12px]',
										'prose-p:!my-1 prose-ul:!my-1 prose-ol:!my-1'
									)}
								/>
							) : (
								<p className="whitespace-pre-wrap break-words text-[11px] leading-snug text-white/75">
									{summary}
								</p>
							)
						) : (
							<p className="text-[11px] text-white/40">
								{t('ewaCompanion.agenticCheckpointEmptySummary', '—')}
							</p>
						)}
					</li>
				);
			})}
		</ol>
	);
}
