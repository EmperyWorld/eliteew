/**
 * Tailwind z-index classes for EWRP stacking contexts (modals, Radix portals, PDF viewer).
 * Keep in one place so overlays stay ordered relative to each other.
 */
export const ewrpZIndexClass = {
	/** History / doc-picker / generic fullscreen overlays */
	overlayModal: 'z-30',
	/** Radix dropdown / popover surfaces (must sit above local panels) */
	radixPortal: 'z-[220]',
	/** UGS slide editor modal backdrop (above overlayModal, below PDF viewer) */
	ugsModalBackdrop: 'z-35',
	/** Fullscreen embedded PDF presentation viewer */
	pdfViewer: 'z-[12020]',
} as const;
