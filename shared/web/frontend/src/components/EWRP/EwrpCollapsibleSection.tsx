/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable collapsible panel for EWRP presentations tab (job details, editor tips).
 *
 * Invariants:
 * - Supports controlled and uncontrolled open state; chevron reflects expansion.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `EwrpGeneratorChunks.tsx`
 */

import * as Collapsible from '@radix-ui/react-collapsible';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { sw } from './EwrpGeneratorChunks';

export type EwrpCollapsibleSectionProps = {
	title: string;
	summary?: string;
	/** Uncontrolled initial open (ignored when `open` is set). */
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: React.ReactNode;
	className?: string;
};

export function EwrpCollapsibleSection({
	title,
	summary,
	defaultOpen = false,
	open: openProp,
	onOpenChange,
	children,
	className,
}: EwrpCollapsibleSectionProps) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const controlled = openProp !== undefined && onOpenChange !== undefined;
	const open = controlled ? openProp : internalOpen;
	const handleOpenChange = useCallback(
		(next: boolean) => {
			if (controlled) onOpenChange(next);
			else setInternalOpen(next);
		},
		[controlled, onOpenChange]
	);

	return (
		<Collapsible.Root open={open} onOpenChange={handleOpenChange}>
			<div
				className={cn(
					'rounded-xl border border-(--desktop-border-subtle)/55 bg-(--desktop-surface-soft)/25',
					className
				)}
			>
				<Collapsible.Trigger asChild>
					<button
						type="button"
						className={cn(
							'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-(--desktop-text-primary) outline-none',
							'hover:bg-(--desktop-surface-soft-hover)/60 focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)]',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-expanded={open}
					>
						<motion.span
							className="flex h-5 w-5 shrink-0 items-center justify-center text-(--desktop-text-muted)"
							animate={{ rotate: open ? 0 : -90 }}
							transition={{ duration: 0.2, ease: 'easeInOut' }}
						>
							<ChevronDownIcon
								className="h-4 w-4"
								strokeWidth={sw}
								aria-hidden
							/>
						</motion.span>
						<span className="min-w-0 flex-1">
							<span className="block text-[11px] font-semibold text-(--desktop-text-secondary)">
								{title}
							</span>
							{summary && !open ? (
								<span
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'mt-0.5 block truncate text-(--desktop-text-dim)'
									)}
								>
									{summary}
								</span>
							) : null}
						</span>
					</button>
				</Collapsible.Trigger>
				<Collapsible.Content
					className={cn(
						'overflow-hidden transition-all duration-200 ease-out',
						'data-[state=closed]:max-h-0 data-[state=closed]:opacity-0',
						'data-[state=open]:max-h-[4000px] data-[state=open]:opacity-100'
					)}
				>
					<div className="space-y-3 border-t border-(--desktop-border-subtle)/40 px-3 py-3">
						{children}
					</div>
				</Collapsible.Content>
			</div>
		</Collapsible.Root>
	);
}
