/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Flat hex icon for Music Player favorites affordance.
 *
 * Invariants:
 * - Decorative SVG (`aria-hidden`); accessible name comes from parent button.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerTrackList.tsx
 */

import { cn } from '@/lib/utils';

/** Плоский шестиугольник (вид сверху), для кнопки «в любимые». */
export function FavoriteHexIcon({
	className,
	filled,
}: {
	className?: string;
	/** Заливка акцентом (в любимых). */
	filled?: boolean;
}) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={cn(className)}
			aria-hidden
			focusable="false"
		>
			<path
				d="M12 2.5l7.794 4.5v9L12 21l-7.794-5v-9L12 2.5z"
				fill={filled ? 'currentColor' : 'none'}
				stroke="currentColor"
				strokeWidth="1.35"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
