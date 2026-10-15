/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Prominent return button for full-screen pages that brings the user back to the EliteEW Безраздельный мир.
 *
 * Invariants:
 * - The route id remains `desktop`; only the visible product terminology changes.
 *
 * Related:
 * - `src/config/pageNavigation.ts`
 */

import * as React from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import type { NavigationHandler } from '../../types/navigation';

interface BackToDesktopButtonProps {
	onNavigate: NavigationHandler;
	className?: string;
	label?: string;
}

export const BackToDesktopButton: React.FC<BackToDesktopButtonProps> = ({
	onNavigate,
	className = '',
	label = 'В Безраздельный мир',
}) => {
	return (
		<button
			type="button"
			onClick={() => onNavigate('desktop')}
			className={
				className
					? `inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/10 transition-colors ${className}`
					: 'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/10 transition-colors'
			}
			aria-label={label}
		>
			<Squares2X2Icon className="w-4 h-4" aria-hidden />
			<span>{label}</span>
		</button>
	);
};
