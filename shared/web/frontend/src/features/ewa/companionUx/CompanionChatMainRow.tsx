/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Three-column desktop chat row (left rail, main, right rail). Mobile/narrow header above columns; desktop lg+ presence lives in left rail.
 *
 * Invariants:
 * - Parent owns column content; shell only provides flex layout.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionPresenceHeader.tsx
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import type { ReactNode } from 'react';

import {
	CompanionPresenceHeader,
	type CompanionPresenceHeaderProps,
} from '@/features/ewa/companionUx/CompanionPresenceHeader';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export type CompanionChatMainRowProps = {
	presenceHeaderProps: CompanionPresenceHeaderProps;
	leftRail: ReactNode;
	mainColumn: ReactNode;
	rightRail: ReactNode;
};

export function CompanionChatMainRow({
	presenceHeaderProps,
	leftRail,
	mainColumn,
	rightRail,
}: CompanionChatMainRowProps) {
	const desktopWide = useMediaQuery('(min-width: 1024px)');
	const showPresenceHeader =
		presenceHeaderProps.mobileEmbeddedLayout || !desktopWide;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2">
			{showPresenceHeader ? (
				<CompanionPresenceHeader {...presenceHeaderProps} />
			) : null}
			<div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-3">
				{leftRail}
				{mainColumn}
				{rightRail}
			</div>
		</div>
	);
}
