/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Theme-aware empty state for UGS Hub task lists (light/dark desktop shell).
 *
 * Invariants:
 * - Render inside `UgsHubShellThemeProvider`; does not use global EmptyState white tokens.
 * - Honors `prefers-reduced-motion` (static div, no framer enter animation).
 *
 * Related:
 * - UgsHubTaskList.tsx, ugsHubSharedUi.tsx
 */

import { motion, useReducedMotion } from 'framer-motion';
import type { ComponentType, FC, SVGProps } from 'react';

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../../pages/Desktop/components/DesktopAppChrome';
import { cn } from '../../../utils/cn';
import { useUgsHubShellTheme } from './ugsHubShellThemeContext';
import {
	ugsHubEmptyStatePanelClasses,
	ugsHubHeaderBtnAccentClasses,
	ugsHubIconTileClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from './ugsHubSharedUi';

export interface UgsHubEmptyStateProps {
	icon?: ComponentType<SVGProps<SVGSVGElement>>;
	title: string;
	description: string;
	actionLabel?: string;
	onAction?: () => void;
	className?: string;
}

export const UgsHubEmptyState: FC<UgsHubEmptyStateProps> = ({
	icon: Icon,
	title,
	description,
	actionLabel,
	onAction,
	className,
}) => {
	const theme = useUgsHubShellTheme();
	const reduceMotion = useReducedMotion();

	const body = (
		<>
			{Icon ? (
				<div className={cn('mx-auto mb-4 w-fit', ugsHubIconTileClasses(theme))}>
					<Icon
						className={cn('h-10 w-10', ugsHubTextMuted(theme))}
						aria-hidden
					/>
				</div>
			) : null}
			<h3
				className={cn('mb-2 text-lg font-semibold', ugsHubTextPrimary(theme))}
			>
				{title}
			</h3>
			<p className={cn('mx-auto max-w-md text-sm', ugsHubTextSecondary(theme))}>
				{description}
			</p>
			{actionLabel && onAction ? (
				<button
					type="button"
					onClick={onAction}
					className={cn(
						ugsHubHeaderBtnAccentClasses(theme),
						'mt-6',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
				>
					{actionLabel}
				</button>
			) : null}
		</>
	);

	if (reduceMotion) {
		return (
			<div
				className={ugsHubEmptyStatePanelClasses(theme, className)}
				role="status"
				data-testid="ugs-hub-empty-state"
				data-reduced-motion="true"
			>
				{body}
			</div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 12 }}
			transition={{ duration: 0.2 }}
			className={ugsHubEmptyStatePanelClasses(theme, className)}
			role="status"
			data-testid="ugs-hub-empty-state"
		>
			{body}
		</motion.div>
	);
};
