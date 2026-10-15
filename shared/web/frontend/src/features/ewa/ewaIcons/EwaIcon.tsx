/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render a symbol from the **EWA icon sprite** (EWASolution / fallup port) with size, tone, and optional motion.
 *
 * Invariants:
 * - Requires ``EwaIconSprites`` mounted in the same document; ``name`` must be a known ``EwaIconId``.
 *
 * Related:
 * - src/features/ewa/ewaIcons/ewaIconCatalog.ts
 * - src/features/ewa/ewaIcons/EwaIconSprites.tsx
 */
import type { EwaIconId } from '@/features/ewa/ewaIcons/ewaIconCatalog';
import { cn } from '@/utils/cn';
import './ewa-icons.css';

export type EwaIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type EwaIconTone =
	| 'inherit'
	| 'brand'
	| 'success'
	| 'warning'
	| 'danger'
	| 'muted'
	| 'aura';

export type EwaIconProps = {
	name: EwaIconId;
	size?: EwaIconSize;
	tone?: EwaIconTone;
	spin?: boolean;
	pulse?: boolean;
	title?: string;
	className?: string;
};

export function EwaIcon({
	name,
	size = 'sm',
	tone = 'inherit',
	spin = false,
	pulse = false,
	title,
	className,
}: EwaIconProps) {
	return (
		<svg
			className={cn(
				'ewa-icon',
				`ewa-icon--${size}`,
				tone !== 'inherit' && `ewa-icon--${tone}`,
				spin && 'ewa-icon--spinning',
				pulse && 'ewa-icon--pulsing',
				className
			)}
			aria-hidden={title ? undefined : true}
			role={title ? 'img' : undefined}
			aria-label={title}
		>
			<use href={`#${name}`} xlinkHref={`#${name}`} />
		</svg>
	);
}
