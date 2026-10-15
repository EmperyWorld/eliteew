/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Hub tab strip for Admin New World sections.
 * Invariants: Controlled selection; tokens only; no Old World imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { type KeyboardEvent as ReactKeyboardEvent, useRef } from 'react';

import { cn } from '@/utils/cn';

import { adminUiFocusRing } from '../adminTokens';

export type AdminSectionTabItem = {
	id: string;
	label: string;
	disabled?: boolean;
};

export type AdminSectionTabsProps = {
	tabs: AdminSectionTabItem[];
	activeId: string;
	onChange: (id: string) => void;
	className?: string;
	'aria-label'?: string;
};

export function AdminSectionTabs({
	tabs,
	activeId,
	onChange,
	className,
	'aria-label': ariaLabel,
}: AdminSectionTabsProps) {
	const refs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});

	function focusAndSelect(id: string) {
		onChange(id);
		window.requestAnimationFrame(() => {
			refs.current[id]?.focus();
		});
	}

	function onKeyDown(
		event: ReactKeyboardEvent<HTMLButtonElement>,
		index: number
	) {
		const enabled = tabs.filter((tab) => !tab.disabled);
		if (!enabled.length) return;
		const enabledIds = enabled.map((tab) => tab.id);
		const currentId = tabs[index]?.id;
		const enabledIndex = enabledIds.indexOf(currentId);
		if (enabledIndex < 0) return;

		let nextIndex: number | null = null;
		if (event.key === 'ArrowRight') {
			nextIndex = (enabledIndex + 1) % enabledIds.length;
		} else if (event.key === 'ArrowLeft') {
			nextIndex = (enabledIndex - 1 + enabledIds.length) % enabledIds.length;
		} else if (event.key === 'Home') {
			nextIndex = 0;
		} else if (event.key === 'End') {
			nextIndex = enabledIds.length - 1;
		}
		if (nextIndex === null) return;
		event.preventDefault();
		focusAndSelect(enabledIds[nextIndex]);
	}

	return (
		<div
			role="tablist"
			aria-label={ariaLabel}
			className={cn(
				'flex flex-wrap gap-1 border-b border-[var(--admin-ui-border)] pb-2',
				className
			)}
		>
			{tabs.map((tab, index) => {
				const active = tab.id === activeId;
				return (
					<button
						key={tab.id}
						ref={(node) => {
							refs.current[tab.id] = node;
						}}
						type="button"
						role="tab"
						aria-selected={active}
						tabIndex={active ? 0 : -1}
						disabled={tab.disabled}
						className={cn(
							'rounded-[var(--admin-ui-radius-sm)] px-3 py-1.5 text-[length:var(--admin-ui-text-sm)]',
							'disabled:pointer-events-none disabled:opacity-50',
							adminUiFocusRing,
							active
								? 'bg-[var(--admin-ui-accent)] text-white'
								: 'bg-[var(--admin-ui-surface)] text-[var(--admin-ui-fg-muted)] hover:bg-[var(--admin-ui-accent-soft)]'
						)}
						onClick={() => onChange(tab.id)}
						onKeyDown={(event) => onKeyDown(event, index)}
					>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
