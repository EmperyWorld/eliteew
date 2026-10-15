/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Panel flyout filter bar (read filter + type chips) and Quick Settings discoverability hint.
 *
 * Invariants:
 * - Quick Settings remain window-only; panel shows muted hint with open-full action.
 *
 * Related:
 * - NotificationHubBody.tsx, NotificationCenter.tsx
 */

import type { NotificationType } from '@/notifications';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import {
	NotificationHubExtensionSlots,
	type NotificationHubExtensionContext,
} from '../../notifications';
import {
	NH_FILTER_ROW_CLASS,
	NH_PANEL_FILTER_BAR_CLASS,
	NH_PANEL_QUICK_SETTINGS_HINT_CLASS,
	NH_TYPE_CHIP_ROW_CLASS,
	nhExtensionSlotClass,
	nhFilterChipButtonClass,
} from './notificationHubLayoutTokens';

const TYPE_CHIP_KEYS = ['all', 'error', 'warning', 'success', 'info'] as const;

export type NotificationHubPanelFiltersProps = {
	filter: 'all' | 'unread';
	unreadCount: number;
	typeChipFilter: 'all' | NotificationType;
	onFilterChange: (filter: 'all' | 'unread') => void;
	onTypeChipChange: (chip: 'all' | NotificationType) => void;
	extensionContext: NotificationHubExtensionContext;
	onOpenFull?: () => void;
};

export const NotificationHubPanelFilters: React.FC<NotificationHubPanelFiltersProps> =
	memo(
		({
			filter,
			unreadCount,
			typeChipFilter,
			onFilterChange,
			onTypeChipChange,
			extensionContext,
			onOpenFull,
		}) => {
			const { t } = useTranslation('desktopUi', {
				keyPrefix: 'notificationHub',
			});

			return (
				<div className={NH_PANEL_FILTER_BAR_CLASS}>
					<div className={NH_FILTER_ROW_CLASS}>
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
					<div className={NH_TYPE_CHIP_ROW_CLASS}>
						{TYPE_CHIP_KEYS.map((key) => {
							const isActive =
								key === 'all'
									? typeChipFilter === 'all'
									: typeChipFilter === key;
							const chipLabel =
								key === 'all' ? t('typeFilterAll') : t(`groups.${key}`);
							return (
								<DesktopChromeTooltip
									key={key}
									content={chipLabel}
									placement="top"
									offsetExtra={4}
								>
									<DesktopAppButton
										type="button"
										size="sm"
										variant={isActive ? 'accent' : 'ghost'}
										onClick={() => {
											if (key === 'all') onTypeChipChange('all');
											else onTypeChipChange(key);
										}}
										className={nhFilterChipButtonClass()}
									>
										{chipLabel}
									</DesktopAppButton>
								</DesktopChromeTooltip>
							);
						})}
					</div>
					{onOpenFull ? (
						<p className={NH_PANEL_QUICK_SETTINGS_HINT_CLASS}>
							<span>{t('panelQuickSettingsHint')}</span>
							<DesktopChromeTooltip
								content={t('openFull')}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={onOpenFull}
									aria-label={t('openFullAria')}
								>
									{t('openFull')}
								</DesktopAppButton>
							</DesktopChromeTooltip>
						</p>
					) : null}
					<NotificationHubExtensionSlots
						slot="hubPanelFooter"
						context={extensionContext}
						className={nhExtensionSlotClass('hubPanelFooter')}
					/>
				</div>
			);
		}
	);

NotificationHubPanelFilters.displayName = 'NotificationHubPanelFilters';
