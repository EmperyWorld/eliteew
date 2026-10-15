/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared composer attachment queue types for GAF Chat shell and composer cluster UI.
 *
 * Invariants:
 * - contentId must reference unified content already uploaded or library-picked.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/components/GafChatComposerCluster.tsx
 */

export type GafPendingComposerAttachment = {
	contentId: string;
	fileName: string;
	size: number | null;
	mimeType?: string | null;
	kind?: 'file';
};
