/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for KBSEW ingest job monitor rows (trace_id, revision display).
 *
 * Invariants:
 * - Optional API fields must never throw; missing → null / "n/a".
 *
 * Related:
 * - `pages/Admin/kbsew/KbsewJobMonitor.tsx`
 */

import type { KbsewBarrelStatus, KbsewIngestJob } from '../kbsewAdminApi';

export type KbsewJobMonitorRow = KbsewIngestJob & {
	phase: 'active' | 'completed';
};

export function formatKbsewRevision(revision: unknown): string | null {
	if (typeof revision === 'number' && Number.isFinite(revision)) {
		return String(revision);
	}
	if (typeof revision === 'string') {
		const trimmed = revision.trim();
		return trimmed || null;
	}
	return null;
}

export function revisionLabelOrNa(revision: unknown): string {
	return formatKbsewRevision(revision) ?? 'n/a';
}

export function jobTraceId(job: KbsewIngestJob): string | null {
	const raw = job.trace_id;
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	return trimmed || null;
}

export function collectKbsewJobMonitorRows(
	status: KbsewBarrelStatus | null
): KbsewJobMonitorRow[] {
	if (!status) return [];
	const active = Array.isArray(status.active_jobs) ? status.active_jobs : [];
	const completed = Array.isArray(status.completed_jobs)
		? status.completed_jobs
		: [];
	const rows: KbsewJobMonitorRow[] = [
		...active.map((job) => ({ ...job, phase: 'active' as const })),
		...completed.map((job) => ({ ...job, phase: 'completed' as const })),
	];
	return rows;
}

export function formatJobProgress(job: KbsewIngestJob): string {
	const pct =
		typeof job.progress_pct === 'number' && Number.isFinite(job.progress_pct)
			? Math.max(0, Math.min(100, Math.trunc(job.progress_pct)))
			: 0;
	return `${pct}%`;
}
