/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operator job monitor for barrel ingest: active/completed rows + trace_id copy.
 *
 * Related:
 * - `pages/Admin/kbsew/KbsewBarrelsTab.tsx`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import type { KbsewBarrelStatus } from '../kbsewAdminApi';
import {
	collectKbsewJobMonitorRows,
	formatJobProgress,
	jobTraceId,
} from './kbsewJobFormat';

type Props = {
	status: KbsewBarrelStatus | null;
	onCopyFeedback?: (ok: boolean) => void;
};

async function copyText(text: string): Promise<void> {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
	}
}

export function KbsewJobMonitor({
	status,
	onCopyFeedback,
}: Props): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const rows = collectKbsewJobMonitorRows(status);

	const onCopyTrace = async (trace: string) => {
		try {
			await copyText(trace);
			onCopyFeedback?.(true);
		} catch {
			onCopyFeedback?.(false);
		}
	};

	if (rows.length === 0) {
		return (
			<div className="rounded-lg border border-white/10 bg-black/30 p-3">
				<h4
					className={`${DESKTOP_TYPOGRAPHY.caption} mb-1 uppercase tracking-wide text-white/55`}
				>
					{t('adminKbsew.jobs.title')}
				</h4>
				<p className="text-xs text-white/55">{t('adminKbsew.jobs.empty')}</p>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-white/10 bg-black/30 p-3">
			<h4
				className={`${DESKTOP_TYPOGRAPHY.caption} mb-2 uppercase tracking-wide text-white/55`}
			>
				{t('adminKbsew.jobs.title')}
			</h4>
			<div className="max-h-56 overflow-auto">
				<table className="w-full border-collapse text-left text-xs text-white/80">
					<thead>
						<tr className="border-b border-white/10 text-white/50">
							<th className="py-1 pr-2 font-medium">
								{t('adminKbsew.jobs.colStatus')}
							</th>
							<th className="py-1 pr-2 font-medium">
								{t('adminKbsew.jobs.colProgress')}
							</th>
							<th className="py-1 pr-2 font-medium">
								{t('adminKbsew.jobs.colTrace')}
							</th>
							<th className="py-1 font-medium">
								{t('adminKbsew.jobs.colMessage')}
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((job) => {
							const trace = jobTraceId(job);
							return (
								<tr
									key={`${job.phase}:${job.id}`}
									className="border-b border-white/5 align-top"
								>
									<td className="py-1.5 pr-2">
										<span
											className={
												job.phase === 'active'
													? 'text-amber-200'
													: 'text-white/70'
											}
										>
											{job.status}
										</span>
									</td>
									<td className="py-1.5 pr-2 font-mono">
										{formatJobProgress(job)}
									</td>
									<td className="py-1.5 pr-2">
										{trace ? (
											<span className="inline-flex max-w-44 items-center gap-1">
												<span
													className="truncate font-mono text-[11px] text-white/60"
													title={trace}
												>
													{trace}
												</span>
												<button
													type="button"
													className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center px-1.5 py-0.5`}
													title={t('adminKbsew.jobs.copyTrace')}
													onClick={() => void onCopyTrace(trace)}
												>
													<ClipboardDocumentIcon className="h-3.5 w-3.5" />
													<span className="sr-only">
														{t('adminKbsew.jobs.copyTrace')}
													</span>
												</button>
											</span>
										) : (
											<span className="text-white/40">n/a</span>
										)}
									</td>
									<td className="py-1.5 text-white/65">
										{job.message?.trim() || '—'}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
