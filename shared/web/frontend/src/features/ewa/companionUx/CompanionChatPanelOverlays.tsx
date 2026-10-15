/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal/portal overlay cluster: quick-preset/memory dialogs, transform video portal, desktop guide tour (U8.3 slice 20).
 *
 * Invariants:
 * - Parent owns dialog/transform/guide state and side effects; cluster only wires presentational overlays.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionChatDialogCluster.tsx
 * - src/features/ewa/companionUx/CompanionTransformVideoPortal.tsx
 * - src/features/ewa/EwaDesktopGuideModal.tsx
 */

import type { EwaDesktopGuideModalProps } from '@/features/ewa/EwaDesktopGuideModal';
import { EwaDesktopGuideModal } from '@/features/ewa/EwaDesktopGuideModal';
import {
	CompanionChatDialogCluster,
	type CompanionChatDialogClusterProps,
} from '@/features/ewa/companionUx/CompanionChatDialogCluster';
import {
	CompanionTransformVideoPortal,
	type CompanionTransformVideoPortalProps,
} from '@/features/ewa/companionUx/CompanionTransformVideoPortal';

export type CompanionChatPanelOverlaysProps = {
	dialogClusterProps: CompanionChatDialogClusterProps;
	transformVideoProps: CompanionTransformVideoPortalProps;
	guideModalProps: EwaDesktopGuideModalProps;
};

export function CompanionChatPanelOverlays({
	dialogClusterProps,
	transformVideoProps,
	guideModalProps,
}: CompanionChatPanelOverlaysProps) {
	return (
		<>
			<CompanionChatDialogCluster {...dialogClusterProps} />
			<CompanionTransformVideoPortal {...transformVideoProps} />
			<EwaDesktopGuideModal {...guideModalProps} />
		</>
	);
}
