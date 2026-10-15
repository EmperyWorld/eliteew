/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dedupe + session guard for companion operation image blob downloads (stale/missing unified_content IDs).
 *
 * Invariants:
 * - 404 on a content id is remembered for the session until auth teardown clears the guard.
 * - Concurrent previews for the same contentId share one in-flight download promise.
 *
 * Related:
 * - CompanionOperationImagePreview.tsx, authSessionCoordinator.ts
 */
import { APIError } from '@/services/api/client';
import { contentApi, type BlobDownloadResult } from '@/services/contentApi';

const missingContentIds = new Set<string>();
const inflightByContentId = new Map<string, Promise<BlobDownloadResult>>();

export function isCompanionOperationContentKnownMissing(
	contentId: string
): boolean {
	const cid = contentId.trim();
	return cid.length > 0 && missingContentIds.has(cid);
}

export function clearCompanionOperationContentPreviewDownloadGuard(): void {
	missingContentIds.clear();
	inflightByContentId.clear();
}

function isNotFoundError(error: unknown): boolean {
	return error instanceof APIError && error.statusCode === 404;
}

/** Shared download path for companion operation image previews. */
export async function downloadCompanionOperationImageBlob(
	contentId: string
): Promise<BlobDownloadResult> {
	const cid = contentId.trim();
	if (!cid) {
		throw new APIError('Not found', 404, 'NOT_FOUND');
	}
	if (missingContentIds.has(cid)) {
		throw new APIError('Not found', 404, 'NOT_FOUND');
	}

	const existing = inflightByContentId.get(cid);
	if (existing) {
		return existing;
	}

	const promise = contentApi
		.downloadContentBlob(cid)
		.catch((error: unknown) => {
			if (isNotFoundError(error)) {
				missingContentIds.add(cid);
			}
			throw error;
		})
		.finally(() => {
			if (inflightByContentId.get(cid) === promise) {
				inflightByContentId.delete(cid);
			}
		});

	inflightByContentId.set(cid, promise);
	return promise;
}

export function resetCompanionOperationContentPreviewDownloadGuardForTests(): void {
	clearCompanionOperationContentPreviewDownloadGuard();
}
