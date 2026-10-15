/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Primary sidebar navigation for Professional Worlds runtime shell.
 *
 * Invariants:
 * - Locked modules remain keyboard-reachable and expose a visible explanation; label stays clean (no suffix).
 *
 * Related:
 * - ProfessionalWorldsRuntimeShell.tsx
 */

import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppListRow,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import type { ProfessionalWorldsRuntimeNavItem } from '../ProfessionalWorldsRuntimeShell';

type NavGroupDefinition = {
	id: string;
	labelKey: string;
	views: string[];
};

const NAV_GROUPS: NavGroupDefinition[] = [
	{ id: 'today', labelKey: 'nav.groups.today', views: ['overview'] },
	{ id: 'listings', labelKey: 'nav.groups.listings', views: ['properties'] },
	{
		id: 'clients',
		labelKey: 'nav.groups.clients',
		views: ['clients', 'professionTools'],
	},
	{
		id: 'image',
		labelKey: 'nav.groups.image',
		views: ['profile', 'brand', 'learning', 'playbooks'],
	},
	{
		id: 'drafts',
		labelKey: 'nav.groups.drafts',
		views: ['artifacts'],
	},
];

export function ProfessionalWorldsSidebarNav<TView extends string>({
	activeView,
	navItems,
	navLabel,
	onSelectView,
	safetyTitle,
	safetyBody,
	collapsedSafety,
	layoutMode = 'vertical',
}: {
	activeView: TView;
	navItems: ProfessionalWorldsRuntimeNavItem<TView>[];
	navLabel: string;
	onSelectView: (view: TView) => void;
	safetyTitle: string;
	safetyBody: string;
	/** Hide safety aside on compact surfaces (toolbar still shows safety in help). */
	collapsedSafety?: boolean;
	/** Embedded mobile: horizontal scroll rail instead of vertical stack. */
	layoutMode?: 'vertical' | 'horizontal';
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const listRef = useRef<HTMLElement>(null);
	const navGroups =
		layoutMode === 'vertical'
			? NAV_GROUPS.map((group) => ({
					...group,
					items: navItems.filter((item) =>
						group.views.includes(String(item.id))
					),
				})).filter((group) => group.items.length > 0)
			: [{ id: 'all', labelKey: null, items: navItems }];
	const groupedIds = new Set(
		NAV_GROUPS.flatMap((group) => group.views).map((view) => String(view))
	);
	const ungroupedItems =
		layoutMode === 'vertical'
			? navItems.filter((item) => !groupedIds.has(String(item.id)))
			: [];

	const focusItem = useCallback(
		(index: number) => {
			const rows = listRef.current?.querySelectorAll<HTMLButtonElement>(
				'button[data-pw-nav-item]'
			);
			if (!rows?.length) return;
			const row = rows[Math.max(0, Math.min(index, rows.length - 1))];
			row?.focus();
			const id =
				navItems[Math.max(0, Math.min(index, navItems.length - 1))]?.id;
			if (
				id &&
				!navItems[Math.max(0, Math.min(index, navItems.length - 1))]?.disabled
			) {
				onSelectView(id);
			}
		},
		[navItems, onSelectView]
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLElement>) => {
			const currentIndex = navItems.findIndex((item) => item.id === activeView);
			if (currentIndex < 0) return;
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				focusItem(currentIndex + 1);
			} else if (event.key === 'ArrowUp') {
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
		[activeView, focusItem, navItems]
	);

	return (
		<>
			<nav
				ref={listRef}
				aria-label={navLabel}
				className={cn(
					layoutMode === 'horizontal'
						? 'flex gap-1 overflow-x-auto overscroll-x-contain pb-1'
						: 'grid gap-0.5'
				)}
				onKeyDown={handleKeyDown}
			>
				{[
					...navGroups,
					...(ungroupedItems.length > 0
						? [
								{
									id: 'other',
									labelKey: 'nav.groups.other',
									items: ungroupedItems,
								},
							]
						: []),
				].map((group) => (
					<div
						key={group.id}
						className={layoutMode === 'vertical' ? 'grid gap-1' : 'contents'}
					>
						{group.labelKey ? (
							<DesktopAppSectionLabel>
								{t(group.labelKey)}
							</DesktopAppSectionLabel>
						) : null}
						{group.items.map((item) => (
							<DesktopAppListRow
								key={String(item.id)}
								type="button"
								active={activeView === item.id}
								aria-disabled={item.disabled === true ? 'true' : undefined}
								aria-label={
									item.locked
										? `${item.label}, ${t('nav.lockedShort')}`
										: item.label
								}
								aria-describedby={
									item.locked ? `pw-nav-lock-${String(item.id)}` : undefined
								}
								title={item.title}
								data-pw-nav-item
								className={cn(
									'justify-between gap-2 text-left text-sm',
									item.disabled && 'cursor-not-allowed opacity-80',
									layoutMode === 'horizontal'
										? 'min-w-34 shrink-0 px-2.5 py-1.5'
										: 'px-2.5 py-2'
								)}
								onClick={() => {
									if (item.disabled) return;
									onSelectView(item.id);
								}}
							>
								<span className="grid min-w-0 gap-0.5">
									<span className="truncate">{item.label}</span>
									{item.locked ? (
										<span
											id={`pw-nav-lock-${String(item.id)}`}
											className="text-[10px] leading-4 text-(--desktop-text-muted)"
										>
											{item.lockReason ?? item.title ?? t('nav.lockedExplain')}
										</span>
									) : null}
								</span>
								{item.locked ? (
									<span
										aria-hidden
										className="shrink-0 rounded-(--desktop-radius-sm) bg-(--desktop-surface-soft) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--desktop-text-muted)"
									>
										{t('nav.lockedBadge', { defaultValue: 'Off' })}
									</span>
								) : null}
							</DesktopAppListRow>
						))}
					</div>
				))}
			</nav>
			{!collapsedSafety ? (
				<DesktopAppSurface
					variant="soft"
					padding="md"
					className="mt-3 grid gap-2"
				>
					<DesktopAppSectionLabel>{safetyTitle}</DesktopAppSectionLabel>
					<p className="text-xs leading-5 text-(--desktop-text-secondary)">
						{safetyBody}
					</p>
				</DesktopAppSurface>
			) : null}
		</>
	);
}
