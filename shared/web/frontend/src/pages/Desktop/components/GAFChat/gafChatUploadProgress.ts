/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quantize multipart upload progress for GAF Chat composer (local file attach)
 * so the UI updates in stable percent steps instead of every byte tick.
 *
 * Invariants:
 * - Displayed progress never decreases within one upload session.
 * - 100% is always reachable when the raw callback reports completion.
 *
 * Related:
 * - hooks/useGafChatSendOrchestration.ts
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md §4
 */

/** Default UI step for GAF local-file upload percent (operator: 5%). */
export const GAF_UPLOAD_PROGRESS_STEP = 5;

export function quantizeUploadProgressPercent(
	rawPercent: number,
	step: number = GAF_UPLOAD_PROGRESS_STEP
): number {
	if (!Number.isFinite(rawPercent) || step <= 0) {
		return 0;
	}
	const clamped = Math.min(100, Math.max(0, rawPercent));
	if (clamped >= 100) {
		return 100;
	}
	return Math.floor(clamped / step) * step;
}

/**
 * Monotonic stepped progress for a single upload session.
 * `previous` is the last value shown in the UI (0–100).
 */
export function nextSteppedUploadProgress(
	previous: number,
	rawPercent: number,
	step: number = GAF_UPLOAD_PROGRESS_STEP
): number {
	const prev = Number.isFinite(previous)
		? Math.min(100, Math.max(0, previous))
		: 0;
	return Math.max(prev, quantizeUploadProgressPercent(rawPercent, step));
}

/**
 * Overall percent across a sequential multi-file upload batch.
 * `fileIndex` is 0-based; `fileRawPercent` is 0–100 for the active file.
 */
export function batchUploadProgressPercent(
	fileIndex: number,
	fileCount: number,
	fileRawPercent: number
): number {
	if (!Number.isFinite(fileCount) || fileCount <= 0) {
		return 0;
	}
	const index = Math.min(Math.max(0, fileIndex), fileCount - 1);
	if (fileCount === 1) {
		return fileRawPercent;
	}
	return ((index + fileRawPercent / 100) / fileCount) * 100;
}
