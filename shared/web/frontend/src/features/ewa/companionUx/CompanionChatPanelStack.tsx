/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Floating overlay stack: tools catalog/OCR, mobile sheets, dialog/transform/guide portals (U8.3 slice 25).
 *
 * Invariants:
 * - Parent owns all prop bundles; stack only wires presentational overlays after main row.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionToolsInstrumentsOverlay.tsx
 * - src/features/ewa/companionUx/CompanionChatMobileSheets.tsx
 * - src/features/ewa/companionUx/CompanionChatPanelOverlays.tsx
 */

import { CompanionChatMobileSheets } from '@/features/ewa/companionUx/CompanionChatMobileSheets';
import type { CompanionChatMobileSheetsProps } from '@/features/ewa/companionUx/CompanionChatMobileSheets';
import {
	CompanionChatPanelOverlays,
	type CompanionChatPanelOverlaysProps,
} from '@/features/ewa/companionUx/CompanionChatPanelOverlays';
import {
	CompanionToolsInstrumentsOverlay,
	type CompanionToolsInstrumentsOverlayProps,
} from '@/features/ewa/companionUx/CompanionToolsInstrumentsOverlay';

export type CompanionChatPanelStackProps = {
	toolsInstrumentsProps: CompanionToolsInstrumentsOverlayProps;
	mobileSheetsProps: CompanionChatMobileSheetsProps;
	panelOverlaysProps: CompanionChatPanelOverlaysProps;
};

export function CompanionChatPanelStack({
	toolsInstrumentsProps,
	mobileSheetsProps,
	panelOverlaysProps,
}: CompanionChatPanelStackProps) {
	return (
		<>
			<CompanionToolsInstrumentsOverlay {...toolsInstrumentsProps} />
			<CompanionChatMobileSheets {...mobileSheetsProps} />
			<CompanionChatPanelOverlays {...panelOverlaysProps} />
		</>
	);
}
