/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline icon/control wrapper for Desktop AI Chat chrome (styled vs native title).
 *
 * Invariants:
 * - Child must be a single React element (button, label, span, img).
 *
 * Related:
 * - DesktopAiChatApp.tsx · DesktopChromeTooltip.tsx
 */

import type { TooltipPlacement } from '@/components/ui/TooltipV2';
import type { ReactElement, ReactNode } from 'react';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';

export function DesktopAiChatIconTooltip({
	content,
	children,
	placement = 'top',
	offsetExtra = 4,
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
			{children}
		</DesktopChromeTooltip>
	);
}
