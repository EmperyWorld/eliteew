/**
 * Рендер кнопки панели в sticky header (Tooltip + DesktopAppButton).
 */

import {
	useCallback,
	type ComponentType,
	type ReactNode,
	type SVGProps,
} from 'react';

import { TooltipV2 } from '@/components/ui/TooltipV2';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import type { OverlayKey } from './docEditorPanelKeys';

export type DocEditorHeaderPanelButtonRenderer = (
	panel: OverlayKey,
	label: string,
	Icon: ComponentType<SVGProps<SVGSVGElement>>,
	options?: {
		disabled?: boolean;
		disabledHint?: string;
		iconSize?: number;
		emphasis?: boolean;
	}
) => ReactNode;

export function useDocEditorHeaderPanelButton(
	getPanelOpenState: (panel: OverlayKey) => boolean,
	togglePanel: (panel: OverlayKey) => void
): DocEditorHeaderPanelButtonRenderer {
	return useCallback(
		(panel, label, Icon, options) => {
			const disabled = options?.disabled;
			const hint = options?.disabledHint;
			const iconSize = options?.iconSize ?? 15;
			const emphasis = options?.emphasis;
			const open = getPanelOpenState(panel);
			const tooltipContent =
				disabled && hint?.trim() ? `${label} — ${hint.trim()}` : label;
			return (
				<TooltipV2 key={panel} content={tooltipContent} placement="bottom">
					<DesktopAppButton
						type="button"
						onClick={() => togglePanel(panel)}
						variant={open ? 'accent' : 'ghost'}
						active={open}
						size="icon"
						className={cn(
							'h-9 w-9 shadow-[0_1px_4px_rgba(2,6,23,0.18)]',
							emphasis &&
								!open &&
								'border border-[rgb(var(--desktop-accent-rgb))]/35 bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_12%,var(--desktop-surface-soft))] hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_18%,var(--desktop-surface-soft-hover))]'
						)}
						aria-label={tooltipContent}
						disabled={disabled}
					>
						<Icon width={iconSize} height={iconSize} />
					</DesktopAppButton>
				</TooltipV2>
			);
		},
		[getPanelOpenState, togglePanel]
	);
}
