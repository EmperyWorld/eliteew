/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk desktop toolbar header (tagline + refresh); WindowTitleBar owns app title.
 *
 * Invariants:
 * - List loads without post body; full Markdown fetched per selected id only.
 * - Desktop chrome header is toolbar-only (tagline + refresh); shell WindowTitleBar owns app title.
 * - Marked `data-desktop-chrome="full-shell-only"` (Wave 5 embedded adoption).
 *
 * Related:
 * - `pages/Desktop/components/EWDeskApp.tsx`
 * - `utils/desktopFullShellChrome.ts`
 * - `documentation/product/desktop/EWDESK-NEWS.md`
 * - `documentation/product/desktop/DESKTOP-MOBILE-EMBEDDED-SHELL.md`
 */
import { cn } from '@/utils/cn';
import { desktopFullShellOnlyChromeProps } from '@/utils/desktopFullShellChrome';
import type { TFunction } from 'i18next';
import type { ReactElement } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import type { DesktopIconStyle } from '../../../../types/profile';
import { DesktopAppSymbol } from '../../utils/desktopVisualSystem';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';

export interface EwDeskAppHeaderProps {
	t: TFunction<'desktopUi', 'ewDesk'>;
	headerStripClass: string;
	desktopIconStyle: DesktopIconStyle;
	listFeedIsFetching: boolean;
	onRefresh: () => void;
}

export function EwDeskAppHeader({
	t,
	headerStripClass,
	desktopIconStyle,
	listFeedIsFetching,
	onRefresh,
}: EwDeskAppHeaderProps): ReactElement {
	return (
		<div
			data-ed-guide="header"
			{...desktopFullShellOnlyChromeProps()}
			className={cn(
				'relative flex min-h-12 shrink-0 select-none items-center justify-between gap-2 border-b border-(--desktop-border-subtle)/70 px-4 py-2.5',
				'shadow-[inset_0_-1px_0_rgb(var(--desktop-fg-primary-rgb)/0.07)]',
				headerStripClass
			)}
		>
			<div className="flex min-w-0 items-center gap-2.5">
				<span
					className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-(--desktop-radius-lg)"
					aria-hidden
				>
					<DesktopAppSymbol
						appComponent="EWDeskApp"
						className="h-full w-full"
						iconStyle={desktopIconStyle}
					/>
				</span>
				<span
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'block min-w-0 max-w-56 truncate leading-tight sm:max-w-none'
					)}
				>
					{t('tagline')}
				</span>
			</div>
			<DesktopChromeTooltip
				content={
					listFeedIsFetching ? t('refreshLoadingAria') : t('refreshAria')
				}
				placement="top"
				offsetExtra={4}
			>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					className="shrink-0 rounded-(--desktop-radius-lg) text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary) active:scale-95 disabled:cursor-wait disabled:opacity-50 motion-reduce:active:scale-100"
					aria-label={
						listFeedIsFetching ? t('refreshLoadingAria') : t('refreshAria')
					}
					disabled={listFeedIsFetching}
					onClick={onRefresh}
				>
					<ArrowPathIcon
						className={cn(
							'h-4 w-4 transition-opacity duration-200 motion-reduce:transition-none',
							listFeedIsFetching
								? 'motion-safe:animate-spin motion-reduce:animate-none'
								: 'opacity-[0.88] hover:opacity-100'
						)}
						aria-hidden
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</DesktopAppButton>
			</DesktopChromeTooltip>
		</div>
	);
}
