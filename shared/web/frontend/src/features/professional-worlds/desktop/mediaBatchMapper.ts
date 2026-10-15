/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapse Professional Worlds media-batch SSE envelopes into grid rows keyed by `batch_item_id` for UI summaries.
 *
 * Invariants:
 * - Unknown events append to `_other` buckets per item instead of crashing.
 *
 * Related:
 * - shared/web/frontend/src/features/professional-worlds/desktop/api.ts (`streamRealtorMediaBatchRun`)
 */

export interface ProfessionalBatchSseEnvelope {
	readonly event: string;
	readonly data: Record<string, unknown>;
}

export type ProfessionalBatchItemProgressRow = {
	batch_item_id?: string;
	item_index?: number;
	phases: string[];
	last_error?: string;
	last_result_preview?: string;
};

/**
 * Maintain a `{ [batchItemId]: row }` map from streaming batch events (`item_progress`, `result`, `error`, …).
 */
export function reduceProfessionalBatchSseMaps(
	prev: Record<string, ProfessionalBatchItemProgressRow>,
	envelope: ProfessionalBatchSseEnvelope
): Record<string, ProfessionalBatchItemProgressRow> {
	const batchItemIdRaw = envelope.data.batch_item_id;
	const idxRaw = envelope.data.item_index ?? envelope.data.index;
	const key =
		batchItemIdRaw != null
			? String(batchItemIdRaw)
			: idxRaw != null
				? `index:${String(idxRaw)}`
				: '_batch';
	const next = { ...prev };
	const prevRow =
		next[key] ??
		({
			batch_item_id:
				batchItemIdRaw != null ? String(batchItemIdRaw) : undefined,
			item_index: typeof idxRaw === 'number' ? idxRaw : undefined,
			phases: [],
		} as ProfessionalBatchItemProgressRow);
	const row: ProfessionalBatchItemProgressRow = {
		batch_item_id:
			prevRow.batch_item_id ??
			(batchItemIdRaw != null ? String(batchItemIdRaw) : undefined),
		item_index:
			prevRow.item_index ?? (typeof idxRaw === 'number' ? idxRaw : undefined),
		phases: [...prevRow.phases, envelope.event],
		last_error: prevRow.last_error,
		last_result_preview: prevRow.last_result_preview,
	};
	const phase = envelope.data.phase;
	if (
		typeof phase === 'string' &&
		phase &&
		!row.phases.includes(`phase:${phase}`)
	) {
		row.phases = [...row.phases, `phase:${phase}`];
	}
	if (envelope.event === 'error' || phase === 'error') {
		const err =
			String(
				envelope.data.error ??
					envelope.data.detail ??
					envelope.data.message ??
					''
			) || 'error';
		row.last_error = err;
	}
	if (envelope.event === 'result') {
		const job = envelope.data.job;
		if (job && typeof job === 'object' && job !== null) {
			row.last_result_preview = JSON.stringify(job).slice(0, 200);
		} else if (typeof envelope.data.ok !== 'undefined') {
			row.last_result_preview = 'ok';
		}
	}
	next[key] = row;
	return next;
}

/** True when enhancement produced an output and no final review choice was persisted yet. */
export function realtorBatchLineAwaitingDecision(
	item: {
		readonly enhancement_job_id?: string | null;
		readonly review_decision?: string | null;
	},
	job?: {
		readonly output_content_id?: string | null;
		readonly status?: string | null;
	} | null
): boolean {
	if (!item.enhancement_job_id || !job?.output_content_id) {
		return false;
	}
	if (job.status && job.status !== 'completed') {
		return false;
	}
	const decision = item.review_decision;
	return !decision || decision === 'pending';
}
