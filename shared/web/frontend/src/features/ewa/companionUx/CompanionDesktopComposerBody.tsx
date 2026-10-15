/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop composer body: draft stack + footer actions (launchers live in left guide rail).
 *
 * Invariants:
 * - Used inside CompanionComposerShell for non-mobile-embedded layout.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionLeftRailComposerToolsSection.tsx
 * - src/features/ewa/companionUx/CompanionDesktopComposerFooter.tsx
 */

import {
	CompanionComposerDraftStack,
	type CompanionComposerDraftStackCoreProps,
} from '@/features/ewa/companionUx/CompanionComposerDraftStack';
import {
	CompanionDesktopComposerFooter,
	type CompanionDesktopComposerFooterProps,
} from '@/features/ewa/companionUx/CompanionDesktopComposerFooter';

export type CompanionDesktopComposerBodyProps = {
	draftStackProps: CompanionComposerDraftStackCoreProps;
	footerProps: CompanionDesktopComposerFooterProps;
};

export function CompanionDesktopComposerBody({
	draftStackProps,
	footerProps,
}: CompanionDesktopComposerBodyProps) {
	return (
		<div className="flex w-full min-w-0 flex-col gap-2">
			<CompanionComposerDraftStack density="desktop" {...draftStackProps} />
			<CompanionDesktopComposerFooter {...footerProps} />
		</div>
	);
}
