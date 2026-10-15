/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Directory summary strip (totals, Redis/SSO subset counts, mismatch hint).
 *
 * Invariants:
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

export type AdminUsersDirectorySummary = {
	online_matching_total?: number | null;
	presence_anomaly_matching_total?: number | null;
	sso_browser_active_matching_total?: number | null;
	sso_mobile_active_matching_total?: number | null;
	sso_desktop_active_matching_total?: number | null;
	channel_mismatch_matching_total?: number | null;
};

export type AdminUsersSummaryBarProps = {
	total: number;
	onlineOnPage: number;
	mismatchOnPage: number;
	mismatchOnly: boolean;
	selectedCount: number;
	redisAvailable: boolean;
	summary: AdminUsersDirectorySummary | null | undefined;
	onApplyOnlineFilter: () => void;
	onApplyAnomalyFilter: () => void;
	onApplySsoBrowserFilter: () => void;
	onApplySsoMobileFilter: () => void;
	onApplySsoDesktopFilter: () => void;
	onApplyMismatchFilter: () => void;
};

export function AdminUsersSummaryBar(
	props: AdminUsersSummaryBarProps
): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const {
		total,
		onlineOnPage,
		mismatchOnPage,
		mismatchOnly,
		selectedCount,
		redisAvailable,
		summary,
		onApplyOnlineFilter,
		onApplyAnomalyFilter,
		onApplySsoBrowserFilter,
		onApplySsoMobileFilter,
		onApplySsoDesktopFilter,
		onApplyMismatchFilter,
	} = props;

	return (
		<div className="eliteew-admin-summary-bar text-(length:--admin-ui-text-sm) text-(--admin-ui-fg-muted)">
			<span>
				{t('adminUsersHub.summary.inCatalog')}{' '}
				<span className="text-(--admin-ui-fg) tabular-nums">{total}</span>
			</span>
			<span aria-hidden>·</span>
			<span>
				{t('adminUsersHub.summary.onlineOnPage')}{' '}
				<span className="text-emerald-200/90 tabular-nums">{onlineOnPage}</span>
			</span>
			{mismatchOnPage > 0 && !mismatchOnly ? (
				<>
					<span aria-hidden>·</span>
					<button
						type="button"
						className="eliteew-admin-summary-bar__hint-action"
						title={t('adminUsersHub.summary.mismatchOnPageTitle')}
						onClick={onApplyMismatchFilter}
					>
						{t('adminUsersHub.summary.mismatchOnPage')}{' '}
						<span className="text-sky-200/90 tabular-nums">
							{mismatchOnPage}
						</span>
					</button>
				</>
			) : null}
			{summary && redisAvailable ? (
				<>
					<span aria-hidden>·</span>
					<button
						type="button"
						title={t('adminUsersHub.summary.onlineByFilterTitle')}
						onClick={onApplyOnlineFilter}
						className="hover:text-emerald-100 underline-offset-2 hover:underline"
					>
						{t('adminUsersHub.summary.onlineByFilter')}{' '}
						<span className="text-emerald-200/90 tabular-nums">
							{summary.online_matching_total ?? '—'}
						</span>
					</button>
					<span aria-hidden>·</span>
					<button
						type="button"
						title={t('adminUsersHub.summary.anomalyByFilterTitle')}
						onClick={onApplyAnomalyFilter}
						className="hover:text-amber-100 underline-offset-2 hover:underline"
					>
						{t('adminUsersHub.summary.anomalyByFilter')}{' '}
						<span className="text-amber-200/90 tabular-nums">
							{summary.presence_anomaly_matching_total ?? '—'}
						</span>
					</button>
				</>
			) : null}
			{summary ? (
				<>
					<span aria-hidden>·</span>
					<button
						type="button"
						title={t('adminUsersHub.summary.ssoBrowserByFilterTitle')}
						onClick={onApplySsoBrowserFilter}
						className="hover:text-sky-100 underline-offset-2 hover:underline"
					>
						{t('adminUsersHub.summary.ssoBrowserByFilter')}{' '}
						<span className="text-sky-200/90 tabular-nums">
							{summary.sso_browser_active_matching_total ?? '—'}
						</span>
					</button>
					<span aria-hidden>·</span>
					<button
						type="button"
						title={t('adminUsersHub.summary.ssoMobileByFilterTitle')}
						onClick={onApplySsoMobileFilter}
						className="hover:text-violet-100 underline-offset-2 hover:underline"
					>
						{t('adminUsersHub.summary.ssoMobileByFilter')}{' '}
						<span className="text-violet-200/90 tabular-nums">
							{summary.sso_mobile_active_matching_total ?? '—'}
						</span>
					</button>
					<span aria-hidden>·</span>
					<button
						type="button"
						title={t('adminUsersHub.summary.ssoDesktopByFilterTitle')}
						onClick={onApplySsoDesktopFilter}
						className="hover:text-cyan-100 underline-offset-2 hover:underline"
					>
						{t('adminUsersHub.summary.ssoDesktopByFilter')}{' '}
						<span className="text-cyan-200/90 tabular-nums">
							{summary.sso_desktop_active_matching_total ?? '—'}
						</span>
					</button>
					<span aria-hidden>·</span>
					<button
						type="button"
						title={t('adminUsersHub.summary.mismatchByFilterTitle')}
						onClick={onApplyMismatchFilter}
						className="hover:text-sky-100 underline-offset-2 hover:underline"
					>
						{t('adminUsersHub.summary.mismatchByFilter')}{' '}
						<span className="text-sky-200/90 tabular-nums">
							{summary.channel_mismatch_matching_total ?? '—'}
						</span>
					</button>
				</>
			) : null}
			{selectedCount > 0 ? (
				<>
					<span aria-hidden>·</span>
					<span>
						{t('adminUsersHub.summary.selected')}{' '}
						<span className="text-violet-200 tabular-nums">
							{selectedCount}
						</span>
					</span>
				</>
			) : null}
		</div>
	);
}
