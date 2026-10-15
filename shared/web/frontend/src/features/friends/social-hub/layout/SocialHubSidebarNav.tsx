/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Primary sidebar navigation for Social Hub desktop shell.
 *
 * Invariants:
 * - Incoming request badge appears only on the People section.
 * - Active item uses `aria-current="page"`.
 * - Sidebar section label is sentence-case (`SH_SIDEBAR_SECTION_LABEL_CLASS`), not chrome uppercase.
 *
 * Related:
 * - SocialHubShell.tsx
 * - socialHubNavigation.ts
 * - socialHubLayoutTokens.ts
 */

import { useCallback, useRef } from 'react';
import {
	DevicePhoneMobileIcon,
	HomeIcon,
	ShieldCheckIcon,
	UserGroupIcon,
} from '@heroicons/react/24/outline';

import {
	DesktopAppListRow,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import type { SocialHubSection } from '../socialHubNavigation';
import {
	SH_SIDEBAR_NAV_COMPACT_CLASS,
	SH_SIDEBAR_SECTION_LABEL_CLASS,
	shSidebarNavIconClass,
	shSidebarNavItemClass,
	SH_NAV_BADGE_CLASS,
} from './socialHubLayoutTokens';

export type SocialHubSidebarNavItem = {
	id: SocialHubSection;
	label: string;
	badgeCount?: number;
};

function sectionIcon(section: SocialHubSection) {
	switch (section) {
		case 'home':
			return HomeIcon;
		case 'people':
			return UserGroupIcon;
		case 'privacy':
			return ShieldCheckIcon;
		case 'phone':
			return DevicePhoneMobileIcon;
	}
}

export function SocialHubSidebarNav({
	activeSection,
	navItems,
	navLabel,
	onSelectSection,
	compact = false,
}: {
	activeSection: SocialHubSection;
	navItems: SocialHubSidebarNavItem[];
	navLabel: string;
	onSelectSection: (section: SocialHubSection) => void;
	/** Horizontal segment rail on narrow surfaces. */
	compact?: boolean;
}) {
	const listRef = useRef<HTMLElement>(null);

	const focusItem = useCallback(
		(index: number) => {
			const rows = listRef.current?.querySelectorAll<HTMLButtonElement>(
				'button[data-sh-nav-item]'
			);
			if (!rows?.length) return;
			const row = rows[Math.max(0, Math.min(index, rows.length - 1))];
			row?.focus();
			const id =
				navItems[Math.max(0, Math.min(index, navItems.length - 1))]?.id;
			if (id) {
				onSelectSection(id);
			}
		},
		[navItems, onSelectSection]
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLElement>) => {
			const currentIndex = navItems.findIndex(
				(item) => item.id === activeSection
			);
			if (currentIndex < 0) return;
			if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
				event.preventDefault();
				focusItem(currentIndex + 1);
			} else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
				event.preventDefault();
				focusItem(currentIndex - 1);
			} else if (event.key === 'Home') {
				event.preventDefault();
				focusItem(0);
			} else if (event.key === 'End') {
				event.preventDefault();
				focusItem(navItems.length - 1);
			}
		},
		[activeSection, focusItem, navItems]
	);

	return (
		<DesktopAppSurface className="min-h-0">
			<p className={SH_SIDEBAR_SECTION_LABEL_CLASS}>{navLabel}</p>
			<nav
				ref={listRef}
				aria-label={navLabel}
				className={cn(
					compact ? SH_SIDEBAR_NAV_COMPACT_CLASS : 'grid gap-0.5 px-1'
				)}
				onKeyDown={handleKeyDown}
			>
				{navItems.map((item) => {
					const Icon = sectionIcon(item.id);
					const active = item.id === activeSection;
					return (
						<DesktopAppListRow
							key={item.id}
							data-sh-nav-item
							type="button"
							active={active}
							tone={active ? 'subtle' : 'default'}
							aria-current={active ? 'page' : undefined}
							className={shSidebarNavItemClass(active, compact)}
							onClick={() => onSelectSection(item.id)}
						>
							<span className="flex min-w-0 items-center gap-2">
								<Icon
									className={shSidebarNavIconClass(active)}
									aria-hidden
									strokeWidth={1.75}
								/>
								<span className="truncate font-medium">{item.label}</span>
							</span>
							{item.badgeCount && item.badgeCount > 0 ? (
								<span className={SH_NAV_BADGE_CLASS} aria-hidden>
									{item.badgeCount > 99 ? '99+' : item.badgeCount}
								</span>
							) : null}
						</DesktopAppListRow>
					);
				})}
			</nav>
		</DesktopAppSurface>
	);
}
