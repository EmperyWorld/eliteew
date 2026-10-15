/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composer column: actions tray + shell with mobile or desktop body (U8.3 slice 18).
 *
 * Invariants:
 * - Parent owns all handler/state bundles passed as prop objects.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionComposerShell.tsx
 */

import { MOBILE_EMBEDDED_EWA_LANDSCAPE_COMPOSER_STACK_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import {
	CompanionActionsTray,
	type CompanionActionsTrayProps,
} from '@/features/ewa/companionUx/CompanionActionsTray';
import {
	CompanionComposerShell,
	type CompanionComposerShellProps,
} from '@/features/ewa/companionUx/CompanionComposerShell';
import {
	CompanionDesktopComposerBody,
	type CompanionDesktopComposerBodyProps,
} from '@/features/ewa/companionUx/CompanionDesktopComposerBody';
import {
	CompanionMobileComposerBody,
	type CompanionMobileComposerBodyProps,
} from '@/features/ewa/companionUx/CompanionMobileComposerBody';
import { cn } from '@/utils/cn';

export type CompanionComposerSectionProps = {
	composerVisible: boolean;
	mobileEmbeddedLandscape: boolean;
	mobileEmbeddedComposerLayout: boolean;
	actionsTrayProps: CompanionActionsTrayProps;
	shellProps: Omit<CompanionComposerShellProps, 'children'>;
	mobileBodyProps: CompanionMobileComposerBodyProps;
	desktopBodyProps: CompanionDesktopComposerBodyProps;
};

export function CompanionComposerSection({
	composerVisible,
	mobileEmbeddedLandscape,
	mobileEmbeddedComposerLayout,
	actionsTrayProps,
	shellProps,
	mobileBodyProps,
	desktopBodyProps,
}: CompanionComposerSectionProps) {
	return (
		<div
			className={cn(
				mobileEmbeddedLandscape
					? MOBILE_EMBEDDED_EWA_LANDSCAPE_COMPOSER_STACK_CLASS
					: 'contents'
			)}
		>
			{composerVisible ? <CompanionActionsTray {...actionsTrayProps} /> : null}
			{composerVisible ? (
				<CompanionComposerShell {...shellProps}>
					{mobileEmbeddedComposerLayout ? (
						<CompanionMobileComposerBody {...mobileBodyProps} />
					) : (
						<CompanionDesktopComposerBody {...desktopBodyProps} />
					)}
				</CompanionComposerShell>
			) : null}
		</div>
	);
}
