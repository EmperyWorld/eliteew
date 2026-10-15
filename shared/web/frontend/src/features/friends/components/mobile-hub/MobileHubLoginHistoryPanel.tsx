/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Displays localized mobile sign-in history and the refreshable empty state.
 *
 * Invariants:
 * - Raw event identifiers are rendered only as a localized fallback.
 *
 * Related:
 * - MobileAppHubPanel.tsx
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	SH_METRIC_LABEL_CLASS,
	SH_METRIC_VALUE_CLASS,
	SH_MOBILE_EMPTY_HISTORY_PANEL_CLASS,
	SH_MOBILE_HISTORY_LATEST_VALUE_CLASS,
	SH_MOBILE_HISTORY_LIST_CLASS,
	SH_MOBILE_HISTORY_ROW_CLASS,
	SH_MOBILE_HISTORY_SUMMARY_GRID_CLASS,
	SH_SUBPANEL_TITLE_CLASS,
	shMetricLabelToneClass,
	shMetricTileToneClass,
	shMetricValueToneClass,
} from '../../social-hub/layout/socialHubLayoutTokens';
import type { MobileAppOverview } from '@/services/mobileAppApi';
import { cn } from '@/utils/cn';
import { formatDt, humanizeMobileHistoryEventType } from './mobileHubFormat';

type Props = {
	history: MobileAppOverview['login_history'];
	onRefresh: () => Promise<void>;
};

export function MobileHubLoginHistoryPanel({
	history,
	onRefresh,
}: Props): JSX.Element {
	const { t } = useTranslation('contentManager');
	if (history.length === 0) {
		return (
			<section className={SH_MOBILE_EMPTY_HISTORY_PANEL_CLASS}>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h3 className="font-medium">
							{t('friends.mobileApp.historyEmptyTitle')}
						</h3>
						<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
							{t('friends.mobileApp.historyEmptyDescription')}
						</p>
					</div>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						className="gap-1.5"
						onClick={() => void onRefresh()}
					>
						<ArrowPathIcon
							className={DESKTOP_LUCIDE.sm}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('friends.mobileApp.refresh')}
					</DesktopAppButton>
				</div>
			</section>
		);
	}

	const eventTypeCount = new Set(history.map((item) => item.event_type)).size;
	const labelFor = (eventType: string) =>
		t(`friends.mobileApp.historyEvents.${eventType}`, {
			defaultValue: humanizeMobileHistoryEventType(eventType),
		});
	return (
		<section>
			<h3 className={cn(SH_SUBPANEL_TITLE_CLASS, 'mb-2')}>
				{t('friends.mobileApp.historyTitle')}
			</h3>
			<div className={SH_MOBILE_HISTORY_SUMMARY_GRID_CLASS}>
				<div className={shMetricTileToneClass('neutral')}>
					<div className={SH_METRIC_VALUE_CLASS}>{history.length}</div>
					<div className={SH_METRIC_LABEL_CLASS}>
						{t('friends.mobileApp.historyMetric')}
					</div>
				</div>
				<div className={shMetricTileToneClass('info')}>
					<div className={shMetricValueToneClass('info')}>{eventTypeCount}</div>
					<div className={shMetricLabelToneClass('info')}>
						{t('friends.mobileApp.historyTypesMetric')}
					</div>
				</div>
				<div className={shMetricTileToneClass('success')}>
					<div className={SH_MOBILE_HISTORY_LATEST_VALUE_CLASS}>
						{formatDt(history[0]?.created_at)}
					</div>
					<div className={shMetricLabelToneClass('success')}>
						{t('friends.mobileApp.historyLatestMetric')}
					</div>
				</div>
			</div>
			<ul className={SH_MOBILE_HISTORY_LIST_CLASS}>
				{history.map((item) => (
					<li
						key={`${item.created_at}-${item.event_type}-${item.client_id ?? ''}`}
						className={SH_MOBILE_HISTORY_ROW_CLASS}
					>
						<span className="font-medium">{labelFor(item.event_type)}</span>
						<span className="text-(--desktop-text-muted)">
							{' '}
							· {formatDt(item.created_at)}
						</span>
						{item.ip_address ? (
							<p className="mt-0.5 text-xs text-(--desktop-text-muted)">
								{item.ip_address}
							</p>
						) : null}
					</li>
				))}
			</ul>
		</section>
	);
}
