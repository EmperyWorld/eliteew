/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Motion-enhanced icon button for Ultimate Doc Editor toolbar commands with tooltip
 * and active/disabled visual states.
 *
 * Invariants:
 * - onMouseDown prevents default to preserve editor selection; command runs on mouse down.
 * - Hover scale only — no translate bounce (premium chrome).
 *
 * Related:
 * - EditorToolbar.tsx, docEditorToolbarChrome.ts, TooltipV2
 */
import { motion, useReducedMotion } from 'framer-motion';
import { forwardRef } from 'react';
import type * as React from 'react';
import { cn } from '@/utils/cn';
import { TooltipV2 } from '../../ui/TooltipV2';
import {
	DOC_EDITOR_TOOLBAR_ICON_BUTTON_ACTIVE_CLASS,
	DOC_EDITOR_TOOLBAR_ICON_BUTTON_CLASS,
} from './docEditorToolbarChrome';

export const EditorToolbarIconButton = forwardRef<
	HTMLButtonElement,
	{
		tooltip: string;
		disabledReason?: string;
		onCommand: () => void;
		isActive?: boolean;
		disabled?: boolean;
		icon: React.ReactNode;
	}
>(({ tooltip, disabledReason, onCommand, isActive, disabled, icon }, ref) => {
	const reduceMotion = useReducedMotion();
	const tip =
		disabled && disabledReason ? `${tooltip} — ${disabledReason}` : tooltip;
	return (
		<TooltipV2 content={tip} placement="bottom">
			<motion.button
				ref={ref as React.Ref<HTMLButtonElement>}
				onMouseDown={(event) => {
					event.preventDefault();
					if (disabled) {
						return;
					}
					onCommand();
				}}
				disabled={disabled}
				className={cn(
					DOC_EDITOR_TOOLBAR_ICON_BUTTON_CLASS,
					!disabled && 'cursor-pointer',
					isActive && DOC_EDITOR_TOOLBAR_ICON_BUTTON_ACTIVE_CLASS,
					disabled && 'cursor-not-allowed opacity-40'
				)}
				whileHover={
					!disabled && !isActive && !reduceMotion ? { scale: 1.03 } : {}
				}
				whileTap={!disabled && !reduceMotion ? { scale: 0.97 } : {}}
				transition={reduceMotion ? { duration: 0 } : { duration: 0.12 }}
				aria-label={tip}
				aria-pressed={isActive}
				type="button"
			>
				<span
					className="flex shrink-0 items-center justify-center [&_svg]:pointer-events-none"
					aria-hidden
				>
					{icon}
				</span>
			</motion.button>
		</TooltipV2>
	);
});

EditorToolbarIconButton.displayName = 'EditorToolbarIconButton';
