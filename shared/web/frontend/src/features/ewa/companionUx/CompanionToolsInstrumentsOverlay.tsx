/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tools catalog backdrop/panel (anchored vs sheet) and OCR source dialog (U8.3 slice 19).
 *
 * Invariants:
 * - Desktop catalog portals via ``CompanionToolsCatalogPortal`` + opaque panel surface.
 * - Mobile embedded uses sheet variant only.
 *
 * Related:
 * - src/features/ewa/companionTools/CompanionToolsCatalogPanel.tsx
 * - src/features/ewa/companionTools/CompanionOcrSourceDialog.tsx
 */

import type { RefObject } from 'react';

import {
	CompanionToolsCatalogBackdropLayer,
	CompanionToolsCatalogPanel,
	type CompanionToolsCatalogPanelProps,
} from '@/features/ewa/companionTools/CompanionToolsCatalogPanel';
import { CompanionToolsCatalogPortal } from '@/features/ewa/companionTools/CompanionToolsCatalogPortal';
import {
	CompanionOcrSourceDialog,
	type CompanionOcrSourceDialogProps,
} from '@/features/ewa/companionTools/CompanionOcrSourceDialog';

export type CompanionToolsInstrumentsOverlayProps = {
	mobileEmbeddedComposerLayout: boolean;
	showDesktopCatalogBackdrop: boolean;
	catalogProps: Omit<
		CompanionToolsCatalogPanelProps,
		'variant' | 'anchorRef' | 'embeddedMobile' | 'portalHost'
	>;
	composerRef: RefObject<HTMLDivElement | null>;
	ocrDialogProps: CompanionOcrSourceDialogProps;
};

export function CompanionToolsInstrumentsOverlay({
	mobileEmbeddedComposerLayout,
	showDesktopCatalogBackdrop,
	catalogProps,
	composerRef,
	ocrDialogProps,
}: CompanionToolsInstrumentsOverlayProps) {
	const sharedCatalogProps: Omit<
		CompanionToolsCatalogPanelProps,
		'variant' | 'anchorRef' | 'portalHost'
	> = {
		...catalogProps,
		embeddedMobile: mobileEmbeddedComposerLayout,
	};

	const desktopPortalOpen =
		!mobileEmbeddedComposerLayout &&
		(showDesktopCatalogBackdrop || catalogProps.open);

	return (
		<>
			{desktopPortalOpen ? (
				<CompanionToolsCatalogPortal open={desktopPortalOpen}>
					{showDesktopCatalogBackdrop ? (
						<CompanionToolsCatalogBackdropLayer
							onClose={catalogProps.onClose}
						/>
					) : null}
					<CompanionToolsCatalogPanel
						{...sharedCatalogProps}
						variant="anchored"
						anchorRef={composerRef}
						portalHost="inline"
					/>
				</CompanionToolsCatalogPortal>
			) : null}
			{mobileEmbeddedComposerLayout ? (
				<CompanionToolsCatalogPanel {...sharedCatalogProps} variant="sheet" />
			) : null}
			<CompanionOcrSourceDialog {...ocrDialogProps} />
		</>
	);
}
