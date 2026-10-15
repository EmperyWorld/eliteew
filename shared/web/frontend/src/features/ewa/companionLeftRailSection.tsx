/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Accordion section shell for the EWA companion rail cards (memory, plan, server actions) in desktop and mobile chat layouts.
 *
 * Invariants:
 * - Only one section id may be expanded at a time — parent owns ``expandedSection`` state.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */
import { EwaIcon, type EwaIconTone } from '@/features/ewa/ewaIcons/EwaIcon';
import type { EwaIconId } from '@/features/ewa/ewaIcons/ewaIconCatalog';
import {
	CompanionGlassCard,
	CompanionPillBadge,
} from '@/features/ewa/companionPremiumPrimitives';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';

export type CompanionLeftRailSectionId = 'serverActions' | 'memory' | 'plan';

export function CompanionLeftRailSection({
	sectionId,
	expandedSection,
	onToggle,
	icon,
	iconTone = 'aura',
	title,
	badge,
	variant = 'default',
	children,
}: {
	sectionId: CompanionLeftRailSectionId;
	expandedSection: CompanionLeftRailSectionId | null;
	onToggle: (id: CompanionLeftRailSectionId) => void;
	icon: EwaIconId;
	iconTone?: EwaIconTone;
	title: string;
	badge?: string | number;
	variant?: 'default' | 'muted';
	children: ReactNode;
}) {
	const open = expandedSection === sectionId;

	return (
		<CompanionGlassCard
			tone={variant === 'muted' ? 'muted' : 'aura'}
			className={cn(
				'shrink-0 overflow-hidden transition-[border-color,box-shadow,background-color]',
				open &&
					'border-(--companion-divider) shadow-[0_12px_30px_var(--companion-glow)]'
			)}
		>
			<button
				type="button"
				className={cn(
					'flex w-full items-center gap-2 px-2.5 py-2 text-left',
					'text-[12px] font-semibold tracking-wide text-(--desktop-text-primary)',
					'hover:bg-white/6',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				aria-expanded={open}
				onClick={() => onToggle(sectionId)}
			>
				<ChevronDownIcon
					className={cn(
						'size-4 shrink-0 text-(--companion-text-soft) transition-transform duration-200',
						open && 'rotate-180'
					)}
					aria-hidden
				/>
				<EwaIcon
					name={icon}
					size="sm"
					tone={iconTone}
					className="shrink-0 opacity-95"
				/>
				<span className="min-w-0 flex-1 truncate">{title}</span>
				{badge != null ? (
					<CompanionPillBadge>{badge}</CompanionPillBadge>
				) : null}
			</button>
			{open ? (
				<div className="min-h-0 max-h-[min(42vh,18rem)] overflow-y-auto overscroll-y-contain border-t border-white/10 px-2.5 pb-2.5 pt-1.5">
					{children}
				</div>
			) : null}
		</CompanionGlassCard>
	);
}
