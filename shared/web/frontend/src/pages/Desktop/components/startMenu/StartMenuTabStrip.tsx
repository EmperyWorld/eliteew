/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Start Menu tab strip (P19 search-first): Home + All apps primary; Pinned /
 * Recent / Work via «More» — not an expanding chip row.
 *
 * Invariants:
 * - Primary strip never grows with secondary tab chips.
 * - Active secondary tab is reflected on the More control (accent + label).
 * - `showMoreTabs` means the More menu is open (`aria-expanded` / `aria-haspopup`).
 *
 * Related:
 * - ../StartMenu.tsx
 * - ../../types/desktopStartMenu.ts
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import type { TFunction } from 'i18next';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import {
	resolveStartMenuTab,
	type StartMenuResolvedTab,
	type StartMenuTab,
} from '../../types/desktopStartMenu';
import { DESKTOP_LUCIDE } from '../../constants';
import {
	DesktopAppButton,
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
} from '../DesktopAppChrome';

type Props = {
	activeTab: StartMenuTab;
	showMoreTabs: boolean;
	setActiveTab: (tab: StartMenuTab) => void;
	setShowMoreTabs: (show: boolean | ((current: boolean) => boolean)) => void;
	t: TFunction<'desktopUi'>;
};

const PRIMARY_TABS: {
	id: StartMenuResolvedTab;
	label: string;
	ariaLabel: string;
}[] = [
	{
		id: 'home',
		label: 'startMenu.tabHome',
		ariaLabel: 'startMenu.tabHomeAria',
	},
	{
		id: 'all',
		label: 'startMenu.tabAll',
		ariaLabel: 'startMenu.tabAllAria',
	},
];

const SECONDARY_TABS: {
	id: StartMenuResolvedTab;
	label: string;
	ariaLabel: string;
}[] = [
	{
		id: 'pinned',
		label: 'startMenu.tabPinned',
		ariaLabel: 'startMenu.tabPinnedAria',
	},
	{
		id: 'recent',
		label: 'startMenu.tabRecent',
		ariaLabel: 'startMenu.tabRecentAria',
	},
	{
		id: 'work',
		label: 'startMenu.tabWork',
		ariaLabel: 'startMenu.tabWorkAria',
	},
];

export function StartMenuTabStrip({
	activeTab,
	showMoreTabs,
	setActiveTab,
	setShowMoreTabs,
	t,
}: Props) {
	const moreWrapRef = useRef<HTMLDivElement | null>(null);
	const resolved = resolveStartMenuTab(activeTab);
	const secondaryActive = SECONDARY_TABS.find(({ id }) => id === resolved);
	const moreMenuOpen = showMoreTabs;

	useEffect(() => {
		if (!moreMenuOpen) return;
		const onPointerDown = (event: PointerEvent) => {
			const root = moreWrapRef.current;
			if (!root) return;
			if (event.target instanceof Node && !root.contains(event.target)) {
				setShowMoreTabs(false);
			}
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		return () =>
			document.removeEventListener('pointerdown', onPointerDown, true);
	}, [moreMenuOpen, setShowMoreTabs]);

	return (
		<div className="relative z-1 shrink-0 px-4 pt-3 pb-2 max-sm:px-3 max-sm:pt-2 max-sm:pb-1.5">
			<div
				role="tablist"
				aria-label={t('startMenu.tabsAria', {
					defaultValue: t('startMenu.dialogLabel'),
				})}
				className="flex gap-1 rounded-2xl border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_92%,var(--desktop-surface-panel)_8%)] p-1 shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--desktop-text-primary)_6%,transparent)] max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overscroll-x-contain max-sm:snap-x max-sm:snap-mandatory max-sm:scrollbar-none max-sm:[&::-webkit-scrollbar]:hidden"
			>
				{PRIMARY_TABS.map(({ id, label, ariaLabel }) => (
					<DesktopAppButton
						key={id}
						type="button"
						role="tab"
						onClick={() => {
							setShowMoreTabs(false);
							setActiveTab(id);
						}}
						aria-selected={resolved === id}
						aria-pressed={resolved === id}
						aria-label={t(ariaLabel)}
						size="md"
						variant={resolved === id ? 'accent' : 'ghost'}
						className="shrink-0 snap-start rounded-xl px-3.5 py-1.5 max-sm:px-2.5 max-sm:py-1"
						data-testid={`start-menu-tab-${id}`}
					>
						{t(label)}
					</DesktopAppButton>
				))}
				<div ref={moreWrapRef} className="relative shrink-0 snap-start">
					<DesktopAppButton
						type="button"
						onClick={() => setShowMoreTabs((visible) => !visible)}
						aria-haspopup="menu"
						aria-expanded={moreMenuOpen}
						aria-label={t('startMenu.moreTabsAria')}
						size="md"
						variant={moreMenuOpen || secondaryActive ? 'accent' : 'ghost'}
						className="rounded-xl px-3.5 py-1.5 max-sm:px-2.5 max-sm:py-1"
						data-testid="start-menu-more-tabs"
					>
						<EllipsisHorizontalIcon
							className={DESKTOP_LUCIDE.sm}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						<span className="ms-1.5">
							{secondaryActive
								? t(secondaryActive.label)
								: t('startMenu.moreTabs')}
						</span>
					</DesktopAppButton>
					{moreMenuOpen ? (
						<DesktopAppMenuSurface
							role="menu"
							aria-label={t('startMenu.moreTabsAria')}
							className="absolute top-[calc(100%+0.35rem)] right-0 z-20 min-w-44 py-1"
							data-testid="start-menu-more-tabs-menu"
						>
							{SECONDARY_TABS.map(({ id, label, ariaLabel }) => (
								<DesktopAppMenuItem
									key={id}
									type="button"
									role="menuitem"
									aria-label={t(ariaLabel)}
									aria-current={resolved === id ? 'page' : undefined}
									onClick={() => {
										setActiveTab(id);
										setShowMoreTabs(false);
									}}
								>
									{t(label)}
								</DesktopAppMenuItem>
							))}
						</DesktopAppMenuSurface>
					) : null}
				</div>
			</div>
		</div>
	);
}
