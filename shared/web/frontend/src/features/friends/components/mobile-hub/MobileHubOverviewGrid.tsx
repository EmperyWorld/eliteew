/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders read-only account, mobile presence, build, and history summary metrics.
 *
 * Invariants:
 * - Missing server data renders as an explicit em dash, never a fabricated value.
 *
 * Related:
 * - MobileAppHubPanel.tsx
 */

import { useTranslation } from 'react-i18next';
import {
	SH_MOBILE_FIELD_HINT_CLASS,
	SH_MOBILE_FIELD_LABEL_CLASS,
	SH_MOBILE_FIELD_VALUE_CLASS,
	SH_MOBILE_OVERVIEW_GRID_CLASS,
} from '../../social-hub/layout/socialHubLayoutTokens';
import type { MobileAppOverview } from '@/services/mobileAppApi';
import { cn } from '@/utils/cn';
import { formatDt, formatMib } from './mobileHubFormat';

type Props = {
	overview: MobileAppOverview | null;
	buildLabel: string;
};

export function MobileHubOverviewGrid({
	overview,
	buildLabel,
}: Props): JSX.Element {
	const { t } = useTranslation('contentManager');
	const session = overview?.mobile_session;
	const historyCount = overview?.login_history.length ?? 0;

	return (
		<section className={SH_MOBILE_OVERVIEW_GRID_CLASS}>
			<div>
				<p className={SH_MOBILE_FIELD_LABEL_CLASS}>
					{t('friends.mobileApp.lastAccountLogin')}
				</p>
				<p className={SH_MOBILE_FIELD_VALUE_CLASS}>
					{formatDt(overview?.last_login_at)}
				</p>
				{overview?.login_count != null ? (
					<p className={SH_MOBILE_FIELD_HINT_CLASS}>
						{t('friends.mobileApp.loginCount', { count: overview.login_count })}
					</p>
				) : null}
			</div>
			<div>
				<p className={SH_MOBILE_FIELD_LABEL_CLASS}>
					{t('friends.mobileApp.lastMobileActivity')}
				</p>
				<p className={SH_MOBILE_FIELD_VALUE_CLASS}>
					{formatDt(session?.last_seen_at)}
				</p>
				<p className={SH_MOBILE_FIELD_HINT_CLASS}>
					{session?.active
						? session.live
							? t('friends.mobileApp.statusLive')
							: t('friends.mobileApp.statusActive')
						: t('friends.mobileApp.statusOffline')}
					{session?.ip_address ? ` · ${session.ip_address}` : ''}
				</p>
			</div>
			<div>
				<p className={SH_MOBILE_FIELD_LABEL_CLASS}>
					{t('friends.mobileApp.buildMetric')}
				</p>
				<p className={SH_MOBILE_FIELD_VALUE_CLASS}>{buildLabel}</p>
				<p className={SH_MOBILE_FIELD_HINT_CLASS}>
					{t('friends.mobileApp.apkSizeMetric', {
						size: formatMib(overview?.apk_size_bytes),
					})}
				</p>
			</div>
			<div>
				<p className={SH_MOBILE_FIELD_LABEL_CLASS}>
					{t('friends.mobileApp.historyMetric')}
				</p>
				<p className={cn(SH_MOBILE_FIELD_VALUE_CLASS, 'tabular-nums')}>
					{historyCount}
				</p>
				<p className={SH_MOBILE_FIELD_HINT_CLASS}>
					{t('friends.mobileApp.historyMetricHint')}
				</p>
			</div>
		</section>
	);
}
