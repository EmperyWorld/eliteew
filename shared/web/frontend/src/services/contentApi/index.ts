/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Barrel assembly and public re-exports for Unified Content client API modules.
 *
 * Invariants:
 * - `contentApi` object shape matches pre-split monolith for zero behavior change.
 *
 * Related:
 * - src/services/contentApi.ts
 */
import { crudApi } from './crud';
import { downloadApi } from './downloads';
import { listApi } from './list';
import { sharesApi } from './shares';
import { versionsApi } from './versions';

export const contentApi = {
	...listApi,
	...crudApi,
	...downloadApi,
	...versionsApi,
	...sharesApi,
};

export { CONTENT_API_V1_BASE } from './constants';
export * from './types';
export {
	buildContentBlobCacheRevision,
	buildContentDownloadUrl,
	getContentCollectionStatus,
	getContentErrorMessage,
	parseContentDispositionFilename,
	toContentError,
} from './utils';
export {
	extractContentComments,
	normalizeContentComments,
	normalizeContentItem,
	normalizeContentListResponse,
	normalizeFolderViewResponse,
	normalizeShareItem,
	normalizeShareResponseItem,
	normalizeVersionItem,
	withContentDownloadUrl,
} from './normalizers';
