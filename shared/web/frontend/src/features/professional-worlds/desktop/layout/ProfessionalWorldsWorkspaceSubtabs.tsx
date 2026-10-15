/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Workspace sub-navigation tabs with keyboard support for Professional Worlds.
 *
 * Invariants:
 * - Uses `role="tablist"` / `role="tab"`; Arrow keys move focus and selection.
 *
 * Related:
 * - SocialHubApp tab patterns (desktop a11y)
 */

import { useCallback, useRef } from 'react';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export function ProfessionalWorldsWorkspaceSubtabs({
	active,
	items,
	onSelect,
	ariaLabel,
	className,
}: {
	active: string;
	items: readonly { id: string; label: string }[];
	onSelect: (id: string) => void;
	ariaLabel: string;
	className?: string;
}) {
	const tablistRef = useRef<HTMLDivElement>(null);

	const focusTab = useCallback(
		(index: number) => {
			const buttons =
				tablistRef.current?.querySelectorAll<HTMLButtonElement>(
					'button[role="tab"]'
				);
			if (!buttons?.length) return;
			const next = buttons[Math.max(0, Math.min(index, buttons.length - 1))];
			next?.focus();
			const id = items[Math.max(0, Math.min(index, items.length - 1))]?.id;
			if (id) onSelect(id);
		},
		[items, onSelect]
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			const currentIndex = items.findIndex((item) => item.id === active);
			if (currentIndex < 0) return;
			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
				event.preventDefault();
				focusTab(currentIndex + 1);
			} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				event.preventDefault();
				focusTab(currentIndex - 1);
			} else if (event.key === 'Home') {
				event.preventDefault();
				focusTab(0);
			} else if (event.key === 'End') {
				event.preventDefault();
				focusTab(items.length - 1);
			}
		},
		[active, focusTab, items]
	);

	return (
		<div
			ref={tablistRef}
			aria-label={ariaLabel}
			className={cn(
				'flex flex-wrap gap-1.5 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 p-1',
				className
			)}
			role="tablist"
			onKeyDown={handleKeyDown}
		>
			{items.map((item) => (
				<DesktopAppButton
					key={item.id}
					aria-selected={active === item.id}
					role="tab"
					size="sm"
					variant={active === item.id ? 'accent' : 'ghost'}
					onClick={() => onSelect(item.id)}
				>
					{item.label}
				</DesktopAppButton>
			))}
		</div>
	);
}
