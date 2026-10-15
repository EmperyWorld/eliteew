/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared launch button for spotlight guided tours (violet/lime accent, sparkles icon).
 *
 * Related:
 * - GuideTourLaunchSlot.tsx, SpotlightGuideModal.tsx
 */

import { cn } from '@/utils/cn';
import * as React from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';

export type GuideTourLaunchButtonProps = {
	onClick: () => void;
	ariaLabel: string;
	title?: string;
	/** Подпись рядом с иконкой (если `showLabel`) */
	label?: string;
	showLabel?: boolean;
	/** Уменьшенные отступы и иконка */
	compact?: boolean;
	className?: string;
};

/**
 * Единая кнопка запуска пошаговых туров (violet / lime accent, slate glass).
 */
export function GuideTourLaunchButton(
	props: GuideTourLaunchButtonProps
): React.ReactElement {
	const {
		onClick,
		ariaLabel,
		title,
		label,
		showLabel = false,
		compact = false,
		className,
	} = props;

	const row = showLabel
		? compact
			? 'gap-1 rounded-lg px-2 py-1.5 text-xs'
			: 'gap-2 rounded-xl px-3 py-2 text-sm'
		: compact
			? 'rounded-lg p-1.5'
			: 'rounded-xl p-2';

	const ic = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={ariaLabel}
			title={title ?? ariaLabel}
			className={cn(
				'group inline-flex items-center font-medium text-slate-300 transition-all duration-150',
				'border border-white/12 bg-white/5 hover:border-violet-400/40 hover:bg-[linear-gradient(135deg,rgba(139,92,246,0.14)_0%,rgba(157,255,0,0.08)_100%)] hover:text-white',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
				'active:scale-[0.98]',
				row,
				className
			)}
		>
			<SparklesIcon
				className={cn(
					ic,
					'shrink-0 text-violet-300/90 transition-colors group-hover:text-lime-200/90'
				)}
				aria-hidden
			/>
			{showLabel && label ? <span>{label}</span> : null}
		</button>
	);
}
