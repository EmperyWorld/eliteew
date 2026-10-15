/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P19 Start Home (Find): search-first surface with short pinned + recent lists
 * and an explicit path to the full All apps catalog — not the category wall.
 * When the search field has a query, shows matching apps from the full catalog.
 * Home headings stay sentence-case; hint + catalog CTA live in a soft strip
 * when Home has content. Fully empty Home/search collapses to one hero + CTA.
 *
 * Invariants:
 * - Does not mount StartMenuRecentDiscovery (full discovery stays on Recent tab).
 * - Idle short lists capped by START_MENU_HOME_SHORT_LIST_CAP.
 * - Idle grids use `home-short` density (≤3 cols); search uses full catalog density.
 * - Search mode does not render the category wall.
 * - Section labels override chrome uppercase (`HOME_SECTION_LABEL_CLASS`).
 * - Idle/search empty: single catalog CTA inside empty state (no competing hint strip).
 *
 * Related:
 * - ../StartMenuLegacy.tsx
 * - ../../types/desktopStartMenu.ts
 * - startMenuAppGridLayout.ts
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md §5.2
 */

import type { TFunction } from 'i18next';
import {
	MagnifyingGlassIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import type { DesktopIconStyle } from '../../../../types/profile';
import { DESKTOP_LUCIDE } from '../../constants';
import type { DesktopItem } from '../../types/desktop.types';
import { START_MENU_HOME_SHORT_LIST_CAP } from '../../types/desktopStartMenu';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
} from '../DesktopAppChrome';
import { StartMenuAppGrid } from './StartMenuAppGrid';

/** Home section titles: sentence case (not chrome uppercase shout). */
const HOME_SECTION_LABEL_CLASS =
	'mb-2 normal-case tracking-normal text-xs font-medium text-(--desktop-text-secondary)';

export type StartMenuHomeSurfaceProps = {
	t: TFunction<'desktopUi'>;
	search: string;
	iconStyle: DesktopIconStyle;
	pinnedApps: DesktopItem[];
	recentApps: DesktopItem[];
	/** Full filtered catalog when searching (Home is search-first). */
	searchResults: DesktopItem[];
	desktopAppIdSet: Set<string>;
	canToggleDesktopPin: boolean;
	openAppFromStart: (app: DesktopItem) => void;
	onOpenAppContext: (app: DesktopItem, x: number, y: number) => void;
	onAppContextMenu: (e: React.MouseEvent, app: DesktopItem) => void;
	onAppMouseDown: (e: React.MouseEvent, app: DesktopItem) => void;
	onPreloadApp: (app: DesktopItem) => void;
	toggleAppDesktopPin: (app: DesktopItem, onDesktop: boolean) => void;
	onOpenAllApps: () => void;
};

export function StartMenuHomeSurface({
	t,
	search,
	iconStyle,
	pinnedApps,
	recentApps,
	searchResults,
	desktopAppIdSet,
	canToggleDesktopPin,
	openAppFromStart,
	onOpenAppContext,
	onAppContextMenu,
	onAppMouseDown,
	onPreloadApp,
	toggleAppDesktopPin,
	onOpenAllApps,
}: StartMenuHomeSurfaceProps): React.JSX.Element {
	const pinnedShort = pinnedApps.slice(0, START_MENU_HOME_SHORT_LIST_CAP);
	const recentShort = recentApps.slice(0, START_MENU_HOME_SHORT_LIST_CAP);
	const searching = Boolean(search.trim());
	const idleEmpty =
		!searching && pinnedShort.length === 0 && recentShort.length === 0;
	const searchEmpty = searching && searchResults.length === 0;

	const gridShared = {
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
	};

	const showHintStrip = !(idleEmpty || searchEmpty);
	const catalogCta = (
		<DesktopAppButton
			type="button"
			variant="accent"
			size="sm"
			onClick={onOpenAllApps}
			data-testid="start-menu-home-all-apps"
			aria-label={t('startMenu.tabAllAria')}
			className="shrink-0"
		>
			<Squares2X2Icon
				className={DESKTOP_LUCIDE.sm}
				aria-hidden
				strokeWidth={DESKTOP_LUCIDE.stroke}
			/>
			{t('startMenu.openAllApps')}
		</DesktopAppButton>
	);

	return (
		<div
			className="flex flex-col gap-5 max-sm:gap-4"
			data-testid="start-menu-home"
		>
			{showHintStrip ? (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/55 px-3 py-2.5">
					<p className="min-w-0 flex-1 text-sm leading-snug text-(--desktop-text-secondary)">
						{t('startMenu.homeHint')}
					</p>
					{catalogCta}
				</div>
			) : null}

			{searching ? (
				searchEmpty ? (
					<DesktopAppEmptyState
						icon={
							<MagnifyingGlassIcon
								className="h-7 w-7 text-(--desktop-text-dim)"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						}
						title={t('startMenu.emptySearchTitle')}
						description={t('startMenu.emptySearchDescription')}
					>
						{catalogCta}
					</DesktopAppEmptyState>
				) : (
					<section data-testid="start-menu-home-search-results">
						<DesktopAppSectionLabel className={HOME_SECTION_LABEL_CLASS}>
							{t('startMenu.matchingAppsSectionTitle')}
						</DesktopAppSectionLabel>
						<StartMenuAppGrid
							apps={searchResults}
							density="catalog"
							{...gridShared}
						/>
					</section>
				)
			) : (
				<>
					{idleEmpty ? (
						<DesktopAppEmptyState
							icon={
								<Squares2X2Icon
									className="h-7 w-7 text-(--desktop-text-dim)"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							}
							title={t('startMenu.emptyHomeTitle')}
							description={t('startMenu.emptyHomeDescription')}
						>
							{catalogCta}
						</DesktopAppEmptyState>
					) : null}

					{pinnedShort.length > 0 ? (
						<section>
							<DesktopAppSectionLabel className={HOME_SECTION_LABEL_CLASS}>
								{t('startMenu.homePinnedHeading')}
							</DesktopAppSectionLabel>
							<StartMenuAppGrid
								apps={pinnedShort}
								density="home-short"
								{...gridShared}
							/>
						</section>
					) : null}

					{recentShort.length > 0 ? (
						<section>
							<DesktopAppSectionLabel className={HOME_SECTION_LABEL_CLASS}>
								{t('startMenu.homeRecentHeading')}
							</DesktopAppSectionLabel>
							<StartMenuAppGrid
								apps={recentShort}
								density="home-short"
								{...gridShared}
							/>
						</section>
					) : null}
				</>
			)}
		</div>
	);
}
