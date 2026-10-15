/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve Site Studio product image URLs without bundling demo webp binaries into SPA chunks.
 *
 * Invariants:
 * - Prefer runtime/upload paths via proxy rewrite; never static-import product-* webp modules.
 * - Missing image → single public placeholder (not a catalog of demo SKUs in the module graph).
 *
 * Related:
 * - features/site-studio/shared/utils/imageUrl.ts
 * - documentation/product/SITE-STUDIO.md
 */

import {
	getUploadedImageUrl,
	normalizeUploadsPath,
} from '@/features/site-studio/shared/utils/imageUrl';
import { isSiteStudioProxyActive } from '@/services/api/siteStudioProxy';

/** Public static placeholder (not Rollup-imported). */
export const PRODUCT_IMAGE_PLACEHOLDER =
	'/site-studio-template-assets/product-placeholder.webp';

/**
 * Resolve display URL for a product image path from the site runtime / CMS.
 */
export const getProductImage = (
	imagePath: string | null | undefined,
	_productName?: string
): string => {
	if (!imagePath) {
		return PRODUCT_IMAGE_PLACEHOLDER;
	}

	const trimmed = String(imagePath).trim();
	if (!trimmed) {
		return PRODUCT_IMAGE_PLACEHOLDER;
	}

	// Legacy SPA import paths must not pull binaries; show placeholder.
	if (
		trimmed.includes('features/site-studio/assets/products/') ||
		trimmed.includes('@/features/site-studio/assets/products/')
	) {
		return PRODUCT_IMAGE_PLACEHOLDER;
	}

	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}

	const normalized = normalizeUploadsPath(trimmed);
	if (normalized.startsWith('/uploads')) {
		return isSiteStudioProxyActive()
			? getUploadedImageUrl(normalized)
			: normalized;
	}

	if (normalized.startsWith('/')) {
		return normalized;
	}

	return PRODUCT_IMAGE_PLACEHOLDER;
};

/** @deprecated Catalog map removed — kept empty for rare legacy imports. */
export const productImages: Record<string, { main: string; detail: string }> =
	{};
