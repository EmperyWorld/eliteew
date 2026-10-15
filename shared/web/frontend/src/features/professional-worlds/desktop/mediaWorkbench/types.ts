/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public props and local draft types for ProfessionalMediaWorkbench modules.
 *
 * Invariants:
 * - `propertyId` remains a deprecated alias for `targetId` at call sites.
 * - Brand draft watermark corners stay within the closed set used by PUT kit.
 *
 * Related:
 * - ProfessionalMediaWorkbench.tsx
 * - brandVisualKitForm.ts
 */

export type ProfessionalMediaContextType = 'realtor' | 'consultant';

export type MediaWorkbenchWatermarkCorner = 'none' | 'tr' | 'tl' | 'br' | 'bl';

export type MediaWorkbenchBrandDraft = {
	primary_hex: string;
	accent_hex: string;
	typography_note: string;
	logo_asset_hint: string;
	watermark_corner: MediaWorkbenchWatermarkCorner;
	watermark_padding_px: '' | number;
};

export type ProfessionalMediaWorkbenchProps = {
	readonly targetId?: string;
	/** @deprecated Use `targetId`; kept for backward-compatible call sites. */
	readonly propertyId?: string;
	readonly contextType?: ProfessionalMediaContextType;
	readonly listingTitle?: string | null;
	readonly runtimePresetOptions: { preset_key: string; display_name: string }[];
	readonly onNotice: (message: string) => void;
	/** Passed from the desktop vertical picker so `/me/brand-visual-kit` matches activation. */
	readonly brandVerticalSlug?: string;
	/** When set/changed from parent (e.g. timestamp), reload listing-attached media rows. */
	readonly listingMediaRefreshAt?: number;
	/** Notify parent to refresh listing cover/thumbnails outside this panel. */
	readonly onListingMediaChanged?: () => void;
	/** Mobile field mode: brand kit lives on Brand tab, not in photo flow. */
	readonly hideBrandKit?: boolean;
};
