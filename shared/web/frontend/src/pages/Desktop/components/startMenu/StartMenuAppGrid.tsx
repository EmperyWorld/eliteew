/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Start Menu app card grid used by categories, recent, pinned, and all tabs.
 * Compact tiles: icon + name + optional meta; desktop pin is a short chip / icon.
 *
 * Invariants:
 * - Presentation-only extract from StartMenu; open / context / pin handlers stay parent-owned.
 * - No Framer stagger/hover scale on cards (RDP-safe).
 * - Off-desktop pin control is icon+tooltip (no long label wall on the card).
 * - P5: no nested interactive controls — open, pin, and overflow menu are sibling buttons (Focus contract).
 * - P16 / Wave 1: density classes live in `startMenuAppGridLayout.ts`
 *   (`catalog` vs capped `home-short`).
 *
 * Related:
 * - ../StartMenu.tsx, documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 * - shell/shellSemanticContracts.ts
 * - startMenuAppGridLayout.ts
 */

import * as React from 'react';
import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import { EllipsisHorizontalIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { DesktopIconStyle } from '../../../../types/profile';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '../../constants';
import type { DesktopItem } from '../../types/desktop.types';
import { isSystemDesktopApp } from '../../utils/desktopAppRegistry';
import { DesktopAppBadge } from '../../utils/desktopVisualSystem';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import {
	START_MENU_APP_CARD_CLASS,
	START_MENU_APP_META_CLASS,
	START_MENU_APP_NAME_CLASS,
	startMenuAppGridClassForDensity,
	type StartMenuAppGridDensity,
} from './startMenuAppGridLayout';

const START_MENU_APP_OPEN_CLASS = cn(
	'flex min-w-0 w-full flex-1 flex-col gap-0.5 rounded-(--desktop-radius) text-left',
	DESKTOP_INTERACTIVE.focusRing
);

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightMatch(text: string, query: string): React.ReactNode {
	if (!query.trim()) return text;
	const escaped = escapeRegex(query.trim());
	const re = new RegExp(`(${escaped})`, 'gi');
	const parts = text.split(re);
	let sliceStart = 0;
	return parts.map((part, i) => {
		const markKey = `sm-${sliceStart}`;
		sliceStart += part.length;
		return i % 2 === 1 ? (
			<mark
				key={markKey}
				className="rounded bg-[rgb(var(--desktop-accent-rgb)/0.18)] px-0.5 font-medium text-(--desktop-text-primary)"
			>
				{part}
			</mark>
		) : (
			part
		);
	});
}

function startMenuAppMetaLine(app: DesktopItem): string | null {
	const description = app.description?.trim();
	if (description) return description;
	const category = app.category?.trim();
	if (category) return category;
	return null;
}

function startMenuDesktopStatusBadgeClass(onDesktop: boolean): string {
	return cn(
		DESKTOP_TYPOGRAPHY.small,
		'inline-flex max-w-full items-center justify-center rounded-md border px-1.5 py-0.5',
		'font-semibold leading-none shadow-sm',
		onDesktop
			? 'border-emerald-300/35 bg-emerald-400/12 text-emerald-200 shadow-emerald-950/10'
			: 'border-rose-300/35 bg-rose-400/12 text-rose-200 shadow-rose-950/10'
	);
}

type StartMenuDesktopStatusBadgeProps = {
	app: DesktopItem;
	onDesktop: boolean;
	canToggle: boolean;
	onToggle: (app: DesktopItem, onDesktop: boolean) => void;
	labelOnDesktop: string;
	labelNotOnDesktop: string;
	ariaPin: string;
	ariaUnpin: string;
};

function StartMenuDesktopStatusBadge({
	app,
	onDesktop,
	canToggle,
	onToggle,
	labelOnDesktop,
	labelNotOnDesktop: _labelNotOnDesktop,
	ariaPin,
	ariaUnpin,
}: StartMenuDesktopStatusBadgeProps): React.ReactElement | null {
	// Progressive disclosure: red «Не отображён» wall removed — only show when on desktop.
	if (!onDesktop) {
		if (!canToggle) return null;
		return (
			<DesktopChromeTooltip content={ariaPin} placement="top" offsetExtra={6}>
				<button
					type="button"
					data-start-app-desktop-toggle="true"
					className={cn(
						'mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md',
						'text-(--desktop-text-muted)',
						'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
						'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
						'focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
					)}
					aria-label={ariaPin}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onToggle(app, onDesktop);
					}}
				>
					<PlusIcon
						className={DESKTOP_LUCIDE.sm}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				</button>
			</DesktopChromeTooltip>
		);
	}
	if (!canToggle) {
		return (
			<span className={startMenuDesktopStatusBadgeClass(true)}>
				{labelOnDesktop}
			</span>
		);
	}
	return (
		<DesktopChromeTooltip content={ariaUnpin} placement="top" offsetExtra={6}>
			<button
				type="button"
				data-start-app-desktop-toggle="true"
				className={cn(
					startMenuDesktopStatusBadgeClass(true),
					'cursor-pointer transition-[filter,transform] hover:brightness-110 active:scale-[0.98]',
					'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-[rgb(var(--desktop-bg-primary-rgb))]'
				)}
				aria-label={ariaUnpin}
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onToggle(app, onDesktop);
				}}
			>
				{labelOnDesktop}
			</button>
		</DesktopChromeTooltip>
	);
}

export type StartMenuAppGridProps = {
	apps: DesktopItem[];
	search: string;
	iconStyle: DesktopIconStyle;
	desktopAppIdSet: Set<string>;
	canToggleDesktopPin: boolean;
	t: TFunction<'desktopUi'>;
	openAppFromStart: (app: DesktopItem) => void;
	onOpenAppContext: (app: DesktopItem, x: number, y: number) => void;
	onAppContextMenu: (e: React.MouseEvent, app: DesktopItem) => void;
	onAppMouseDown: (e: React.MouseEvent, app: DesktopItem) => void;
	onPreloadApp: (app: DesktopItem) => void;
	toggleAppDesktopPin: (app: DesktopItem, onDesktop: boolean) => void;
	/** Default `catalog` (All apps / search). Home idle short lists use `home-short`. */
	density?: StartMenuAppGridDensity;
};

export function StartMenuAppGrid({
	apps,
	search,
	iconStyle,
	desktopAppIdSet,
	canToggleDesktopPin,
	t,
	openAppFromStart,
	onOpenAppContext,
	onAppContextMenu,
	onAppMouseDown,
	onPreloadApp,
	toggleAppDesktopPin,
	density = 'catalog',
}: StartMenuAppGridProps) {
	return (
		<div
			className={startMenuAppGridClassForDensity(density)}
			data-testid="start-menu-app-grid"
			data-start-menu-grid-density={density}
		>
			{apps.map((app) => {
				const meta = startMenuAppMetaLine(app);
				const onDesktop = desktopAppIdSet.has(app.id);
				const canToggle = canToggleDesktopPin && !isSystemDesktopApp(app);
				return (
					<article
						key={app.id}
						data-start-app-id={app.id}
						data-testid="start-menu-app-card"
						className={START_MENU_APP_CARD_CLASS}
						onContextMenu={(e) => onAppContextMenu(e, app)}
					>
						<DesktopChromeTooltip
							content={t('startMenu.appMenuTriggerTitle')}
							placement="top"
							offsetExtra={4}
						>
							<button
								type="button"
								data-start-app-menu-trigger="true"
								aria-haspopup="menu"
								aria-label={t('startMenu.appMenuTriggerTitle')}
								className={cn(
									'absolute right-0.5 top-0.5 z-10 rounded-md border border-transparent p-1 text-(--desktop-text-muted) transition-colors',
									'hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary)',
									DESKTOP_INTERACTIVE.focusRing
								)}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									const rect = (
										e.currentTarget as HTMLButtonElement
									).getBoundingClientRect();
									onOpenAppContext(app, rect.right - 6, rect.bottom + 4);
								}}
							>
								<EllipsisHorizontalIcon
									className={DESKTOP_LUCIDE.sm}
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</button>
						</DesktopChromeTooltip>
						<DesktopChromeTooltip
							content={meta ? `${app.name} — ${meta}` : app.name}
							placement="top"
							offsetExtra={4}
							fullWidth
						>
							<button
								type="button"
								className={START_MENU_APP_OPEN_CLASS}
								aria-label={meta ? `${app.name}. ${meta}` : app.name}
								onClick={() => openAppFromStart(app)}
								onMouseDown={(e) => onAppMouseDown(e, app)}
								onPointerEnter={() => onPreloadApp(app)}
							>
								<div className="flex min-w-0 items-start gap-2 pr-5">
									<DesktopAppBadge
										appComponent={app.appComponent}
										icon={app.icon}
										variant="start"
										className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
										iconStyle={iconStyle}
									/>
									<div className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className={START_MENU_APP_NAME_CLASS}>
											{highlightMatch(app.name, search)}
										</span>
										{meta ? (
											<span className={START_MENU_APP_META_CLASS}>{meta}</span>
										) : null}
									</div>
								</div>
							</button>
						</DesktopChromeTooltip>
						{(onDesktop || canToggle) && (
							<div className="flex min-w-0 pl-10 sm:pl-11">
								<StartMenuDesktopStatusBadge
									app={app}
									onDesktop={onDesktop}
									canToggle={canToggle}
									onToggle={toggleAppDesktopPin}
									labelOnDesktop={t('startMenu.onDesktop')}
									labelNotOnDesktop={t('startMenu.notOnDesktop')}
									ariaPin={t('startMenu.pinToDesktop')}
									ariaUnpin={t('startMenu.unpinFromDesktop')}
								/>
							</div>
						)}
					</article>
				);
			})}
		</div>
	);
}
