/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin-custom account badge (short label + optional hover hint).
 *
 * Invariants:
 * - Display is sentence-case when the stored label is ALL CAPS; no CSS `uppercase` shout.
 *
 * Related:
 * - UserAccountBadges.tsx
 * - features/friends/social-hub/profile-home/ProfileIdentityHero.tsx
 */

import { cn } from '@/utils/cn';

/** ALL-CAPS admin labels → sentence case for premium chrome; mixed case kept as stored. */
export function formatAdminBadgeLabel(label: string): string {
	const trimmed = label.trim();
	if (!trimmed) {
		return trimmed;
	}
	const letters = trimmed.replace(/[^A-Za-zА-Яа-яЁё]/gu, '');
	if (
		letters.length > 3 &&
		letters === letters.toUpperCase() &&
		letters !== letters.toLowerCase()
	) {
		return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
	}
	return trimmed;
}

/** Админский произвольный значок: короткий текст + подсказка при наведении. */
export function AdminCustomBadge({
	label,
	title,
	className,
}: {
	label: string;
	/** Подсказка / длиннее описание */
	title?: string;
	className?: string;
}) {
	const display = formatAdminBadgeLabel(label);
	const t = title?.trim();
	return (
		<span
			role="img"
			className={cn(
				'inline-flex max-w-40 shrink-0 items-center truncate rounded-md border border-violet-500/35 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium tracking-normal text-violet-200',
				className
			)}
			title={t || display}
			aria-label={t ? `${display}. ${t}` : display}
		>
			{display}
		</span>
	);
}
