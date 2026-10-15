/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor-scoped media API adapter for ProfessionalMediaWorkbench (strategy 2A facade).
 *
 * Invariants:
 * - All calls require a realtor listing target id; consultant flows must not import this adapter.
 *
 * Related:
 * - ProfessionalMediaWorkbench.tsx
 * - desktop/api/media.ts
 */

export {
	createProfessionalMediaAlbum,
	createRealtorMediaBatch,
	deleteProfessionalMediaAlbum,
	deleteRealtorPropertyMedia,
	getBrandVisualKit,
	getRealtorMediaBatchDetail,
	listProfessionalMediaAlbums,
	listRealtorPropertyMedia,
	patchProfessionalMediaAlbum,
	putBrandVisualKit,
	reviewRealtorMediaBatchItem,
	streamRealtorMediaBatchRun,
} from '../api';
