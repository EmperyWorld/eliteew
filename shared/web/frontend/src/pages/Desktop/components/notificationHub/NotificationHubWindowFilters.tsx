/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-window filter block: Quick Settings, search, source filter, read filter, group-by toggle.
 *
 * Invariants:
 * - Shared between virtual-window scroll header and scroll-window header layouts.
 *
 * Related:
 * - NotificationHubBody.tsx, NotificationHubQuickSettings.tsx
 */

import { cn } from '@/utils/cn';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import {
	NotificationHubExtensionSlots,
	type NotificationHubExtensionContext,
} from '../../notifications';
import { NotificationHubQuickSettings } from './NotificationHubQuickSettings';
import {
	NH_GROUP_BY_CHIP_ROW_CLASS,
	NH_GROUP_BY_WRAP_CLASS,
	NH_HINT_TEXT_CLASS,
	NH_SECTION_LABEL_NORMAL_CLASS,
	NH_SOURCE_CHIP_ROW_CLASS,
	NH_SOURCE_FILTER_WRAP_CLASS,
	NH_WINDOW_FILTER_ACTIONS_CLASS,
	nhExtensionSlotClass,
	nhFilterChipButtonClass,
	nhSourceChipAllButtonClass,
	nhSourceChipButtonClass,
} from './notificationHubLayoutTokens';

export type NotificationHubWindowFiltersProps = {
	showDetailedSettings: boolean;
	embeddedMobileLayout?: boolean;
	extensionContext: NotificationHubExtensionContext;
	searchQuery: string;
	onSearchChange: (value: string) => void;
	uniqueSources: string[];
	sourceFilter: 'all' | string;
	onSourceFilterChange: (source: 'all' | string) => void;
	getSourceLabel: (source: string) => string;
	filter: 'all' | 'unread';
	unreadCount: number;
	onFilterChange: (filter: 'all' | 'unread') => void;
	effectiveGroupMode: 'type' | 'source';
	useWindowVirtual: boolean;
	onGroupModeChange: (mode: 'type' | 'source') => void;
	settingsBlockClass: string;
	scrollCapClass?: string;
};

export const NotificationHubWindowFilters: React.FC<NotificationHubWindowFiltersProps> =
	memo(
		({
			showDetailedSettings,
			embeddedMobileLayout = false,
			extensionContext,
			searchQuery,
			onSearchChange,
			uniqueSources,
			sourceFilter,
			onSourceFilterChange,
			getSourceLabel,
			filter,
			unreadCount,
			onFilterChange,
			effectiveGroupMode,
			useWindowVirtual,
			onGroupModeChange,
			settingsBlockClass,
			scrollCapClass,
		}) => {
			const { t } = useTranslation('desktopUi', {
				keyPrefix: 'notificationHub',
			});

			const groupByToggle = (
				<div className={NH_GROUP_BY_WRAP_CLASS}>
					<DesktopAppSectionLabel className={NH_SECTION_LABEL_NORMAL_CLASS}>
						{t('groupByLabel')}
					</DesktopAppSectionLabel>
					<div className={NH_GROUP_BY_CHIP_ROW_CLASS}>
						<DesktopChromeTooltip
							content={
								useWindowVirtual ? t('virtualGroupBySourceHint') : undefined
							}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								size="sm"
								variant={effectiveGroupMode === 'type' ? 'accent' : 'ghost'}
								disabled={useWindowVirtual}
								onClick={() => onGroupModeChange('type')}
								className={nhFilterChipButtonClass()}
							>
								{t('groupByType')}
							</DesktopAppButton>
						</DesktopChromeTooltip>
						<DesktopChromeTooltip
							content={
								useWindowVirtual ? t('virtualGroupBySourceHint') : undefined
							}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								size="sm"
								variant={effectiveGroupMode === 'source' ? 'accent' : 'ghost'}
								disabled={useWindowVirtual}
								onClick={() => onGroupModeChange('source')}
								className={nhFilterChipButtonClass()}
							>
								{t('groupBySource')}
							</DesktopAppButton>
						</DesktopChromeTooltip>
					</div>
					{useWindowVirtual ? (
						<p className={NH_HINT_TEXT_CLASS}>
							{t('virtualGroupBySourceHint')}
						</p>
					) : null}
				</div>
			);

			return (
				<div
					data-nc-guide="filters"
					className={cn(
						'shrink-0 border-b border-(--desktop-border-subtle)',
						settingsBlockClass,
						scrollCapClass
					)}
				>
					{showDetailedSettings ? (
						<>
							<NotificationHubExtensionSlots
								slot="hubSettingsBefore"
								context={extensionContext}
								className={nhExtensionSlotClass('hubSettingsBefore')}
							/>
							<NotificationHubQuickSettings
								embeddedMobileLayout={embeddedMobileLayout}
							/>
							<NotificationHubExtensionSlots
								slot="hubSettingsAfter"
								context={extensionContext}
								className={nhExtensionSlotClass('hubSettingsAfter')}
							/>
						</>
					) : null}
					<div className="mt-3">
						<input
							type="search"
							value={searchQuery}
							onChange={(e) => onSearchChange(e.target.value)}
							placeholder={t('searchPlaceholder')}
							aria-label={t('searchAria')}
							className={DESKTOP_APP_STYLE_CONTRACT.searchField}
						/>
					</div>
					{uniqueSources.length > 0 ? (
						<div className={NH_SOURCE_FILTER_WRAP_CLASS}>
							<DesktopAppSectionLabel className={NH_SECTION_LABEL_NORMAL_CLASS}>
								{t('sourceFilterLabel')}
							</DesktopAppSectionLabel>
							<div className={NH_SOURCE_CHIP_ROW_CLASS}>
								<DesktopChromeTooltip
									content={t('sourceFilterAll')}
									placement="top"
									offsetExtra={4}
								>
									<DesktopAppButton
										type="button"
										size="sm"
										variant={sourceFilter === 'all' ? 'accent' : 'ghost'}
										onClick={() => onSourceFilterChange('all')}
										className={nhSourceChipAllButtonClass()}
									>
										{t('sourceFilterAll')}
									</DesktopAppButton>
								</DesktopChromeTooltip>
								{uniqueSources.map((src) => (
									<DesktopChromeTooltip
										key={src}
										content={src}
										placement="top"
										offsetExtra={4}
									>
										<DesktopAppButton
											type="button"
											size="sm"
											variant={sourceFilter === src ? 'accent' : 'ghost'}
											onClick={() => onSourceFilterChange(src)}
											className={nhSourceChipButtonClass()}
										>
											{getSourceLabel(src)}
										</DesktopAppButton>
									</DesktopChromeTooltip>
								))}
							</div>
						</div>
					) : null}
					<div
						className={cn(
							NH_WINDOW_FILTER_ACTIONS_CLASS,
							!showDetailedSettings && 'pt-1'
						)}
					>
						<DesktopChromeTooltip
							content={t('filterAll')}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								variant={filter === 'all' ? 'accent' : 'ghost'}
								size="sm"
								onClick={() => onFilterChange('all')}
								className="flex-1"
							>
								{t('filterAll')}
							</DesktopAppButton>
						</DesktopChromeTooltip>
						<DesktopChromeTooltip
							content={t('filterUnread', { count: unreadCount })}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								variant={filter === 'unread' ? 'accent' : 'ghost'}
								size="sm"
								onClick={() => onFilterChange('unread')}
								className="flex-1"
							>
								{t('filterUnread', { count: unreadCount })}
							</DesktopAppButton>
						</DesktopChromeTooltip>
					</div>
					{groupByToggle}
				</div>
			);
		}
	);

NotificationHubWindowFilters.displayName = 'NotificationHubWindowFilters';
