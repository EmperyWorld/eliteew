/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared guard for EWRP slide preview fetches.
 *
 * Invariants:
 * - The UI fetches authenticated slide PNG blobs only when status says the image file is ready.
 *
 * Related:
 * - src/services/ewrpApi.ts
 * - src/components/EWRP/EwrpGeneratorChunks.tsx
 */

import type { EwrpSlide } from '@/services/ewrpApi';

export function ewrpShouldFetchSlideImage(
	jobId: string | null | undefined,
	slide: Pick<EwrpSlide, 'image_filename' | 'image_ready'>
): jobId is string {
	return Boolean(
		jobId?.trim() && slide.image_filename?.trim() && slide.image_ready !== false
	);
}
