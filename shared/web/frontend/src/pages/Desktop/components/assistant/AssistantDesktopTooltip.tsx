/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline tooltip wrapper for Assistant app chrome controls.
 *
 * Invariants:
 * - Children must be a single React element (DesktopChromeTooltip contract).
 *
 * Related:
 * - pages/Desktop/components/DesktopChromeTooltip.tsx
 * - pages/Desktop/components/AssistantApp.tsx
 */
import { cn } from '@/utils/cn';
import type { ReactElement, ReactNode } from 'react';
import type { TooltipPlacement } from '@/components/ui/TooltipV2';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';

export function AssistantDesktopTooltip({
	content,
	children,
	placement = 'top',
	offsetExtra = 4,
	disabled,
	inlineClassName,
}: {
	content: ReactNode;
	children: ReactElement;
	placement?: TooltipPlacement;
	offsetExtra?: number;
	disabled?: boolean;
	inlineClassName?: string;
}) {
	return (
		<DesktopChromeTooltip
			content={content}
			placement={placement}
			offsetExtra={offsetExtra}
			disabled={disabled}
		>
			<span className={cn('inline-flex shrink-0', inlineClassName)}>
				{children}
			</span>
		</DesktopChromeTooltip>
	);
}
