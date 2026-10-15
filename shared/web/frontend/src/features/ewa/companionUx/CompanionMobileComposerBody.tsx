/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile embedded composer body: edge toolbar, draft stack, quick presets (U8.3 slice 17).
 *
 * Invariants:
 * - Only used inside CompanionComposerShell when mobile embedded layout is active.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionMobileComposerToolbar.tsx
 */

import {
	CompanionComposerDraftStack,
	type CompanionComposerDraftStackCoreProps,
} from '@/features/ewa/companionUx/CompanionComposerDraftStack';
import {
	CompanionMobileComposerToolbar,
	type CompanionMobileComposerToolbarProps,
} from '@/features/ewa/companionUx/CompanionMobileComposerToolbar';
import {
	EwaCompanionQuickPresetsStrip,
	type EwaCompanionQuickPresetsStripProps,
} from '@/features/ewa/EwaCompanionQuickPresetsStrip';

export type CompanionMobileComposerBodyProps = {
	toolbarProps: CompanionMobileComposerToolbarProps;
	draftStackProps: CompanionComposerDraftStackCoreProps;
	quickPresetsStripProps: EwaCompanionQuickPresetsStripProps;
};

export function CompanionMobileComposerBody({
	toolbarProps,
	draftStackProps,
	quickPresetsStripProps,
}: CompanionMobileComposerBodyProps) {
	return (
		<div className="flex min-h-0 flex-col gap-1.5">
			<CompanionMobileComposerToolbar {...toolbarProps} />
			<CompanionComposerDraftStack density="mobile" {...draftStackProps} />
			<EwaCompanionQuickPresetsStrip {...quickPresetsStripProps} />
		</div>
	);
}
