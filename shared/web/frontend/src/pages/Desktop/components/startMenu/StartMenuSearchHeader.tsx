/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Start Menu search field + launcher role strip above the tab controls.
 *
 * Invariants:
 * - Search input remains controlled by the Start Menu orchestrator.
 * - Role strip mirrors Quick Search / Command Palette mental-model copy (P7).
 * - Wave K13: offline notice distinguishes O5 pack vs spa_offline_only counts.
 *
 * Related:
 * - ../StartMenu.tsx
 * - ../../utils/desktopLauncherRoles.ts
 * - shell/kernelOfflineSpaDeepLink.ts
 */

import type { RefObject } from 'react';
import type { TFunction } from 'i18next';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '../../constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppSectionLabel,
} from '../DesktopAppChrome';
import { formatKernelOfflineSubsetNoticeRu } from '../../shell/kernelOfflineSpaDeepLink';

type Props = {
	inputRef: RefObject<HTMLInputElement | null>;
	search: string;
	setSearch: (value: string) => void;
	t: TFunction<'desktopUi'>;
	/** Wave K7/K13: show Kernel offline SPA subset notice under search. */
	kernelOfflineSubsetActive?: boolean;
};

export function StartMenuSearchHeader({
	inputRef,
	search,
	setSearch,
	t,
	kernelOfflineSubsetActive = false,
}: Props) {
	return (
		<div className="relative z-1 shrink-0 border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_82%,var(--desktop-surface-panel)_18%)] px-3 pt-3.5 pb-2.5 max-sm:px-2.5 max-sm:pt-2.5 max-sm:pb-2">
			<div
				className="mb-2.5 flex items-start justify-between gap-3"
				data-testid="start-menu-launcher-role"
			>
				<div className="min-w-0">
					<DesktopAppSectionLabel className="tracking-[0.16em]">
						{t('startMenu.roleTitle')}
					</DesktopAppSectionLabel>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'mt-1 leading-relaxed text-(--desktop-text-muted)'
						)}
					>
						{t('startMenu.roleDescription')}
					</p>
				</div>
				<span
					className={cn(
						DESKTOP_TYPOGRAPHY.sectionPill,
						'shrink-0 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1'
					)}
					aria-hidden
				>
					{t('startMenu.roleBadge')}
				</span>
			</div>
			<div className="relative">
				<div className="pointer-events-none absolute left-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-lg bg-(--desktop-surface-soft) text-(--desktop-text-muted) [&_svg]:stroke-[1.35]">
					<MagnifyingGlassIcon
						className={DESKTOP_LUCIDE.md}
						aria-hidden
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</div>
				<input
					ref={inputRef}
					type="search"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={t('startMenu.searchPlaceholder')}
					aria-label={t('startMenu.searchAria')}
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.searchField,
						DESKTOP_TYPOGRAPHY.quickSearchInput,
						'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)] focus-visible:border-[rgb(var(--desktop-accent-rgb)/0.65)]',
						'focus:bg-(--desktop-surface-soft-hover)',
						'w-full rounded-2xl py-2.5 pl-11 pr-3.5',
						DESKTOP_INTERACTIVE.inputFocus
					)}
				/>
			</div>
			{kernelOfflineSubsetActive ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'mt-2 text-(--desktop-text-muted)'
					)}
					role="status"
				>
					{formatKernelOfflineSubsetNoticeRu()}
				</p>
			) : null}
		</div>
	);
}
