/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline icon-button wrapper for GAF Chat chrome actions (styled vs native title).
 *
 * Invariants:
 * - Child must be a single focusable element (DesktopAppButton).
 *
 * Related:
 * - GAFChatApp.tsx · DesktopChromeTooltip.tsx
 */

import type { TooltipPlacement } from '@/components/ui/TooltipV2';
import type { ReactElement, ReactNode } from 'react';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';

export function GafChatDesktopIconTooltip({
	content,
	children,
	placement = 'bottom',
	offsetExtra = 6,
	disabled,
}: {
	content: ReactNode;
	children: ReactElement;
	placement?: TooltipPlacement;
	offsetExtra?: number;
	disabled?: boolean;
}) {
	return (
		<DesktopChromeTooltip
			content={content}
			placement={placement}
			offsetExtra={offsetExtra}
			disabled={disabled}
		>
			<span className="inline-flex shrink-0">{children}</span>
		</DesktopChromeTooltip>
	);
}
