/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operator-facing OTA + edge-sync parity readout on Social Hub Mobile
 * (version/SHA/published_at from overview + trusted-device edge aggregate).
 *
 * Invariants:
 * - Missing OTA fields render as an explicit em dash, never fabricated values.
 * - Edge aggregate uses resolveTrustedDeviceEdgeSyncStatus (not WG metadata alone).
 *
 * Related:
 * - MobileAppHubPanel.tsx
 * - services/mobileAppApi.ts
 * - documentation/product/mobile/MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md (W5)
 */

import { useTranslation } from 'react-i18next';
import {
	SH_MOBILE_FIELD_HINT_CLASS,
	SH_MOBILE_FIELD_LABEL_CLASS,
	SH_MOBILE_FIELD_VALUE_CLASS,
	SH_PANEL_INSET_CLASS,
} from '../../social-hub/layout/socialHubLayoutTokens';
import type {
	MobileAppOverview,
	MobileTrustedDeviceItem,
} from '@/services/mobileAppApi';
import { cn } from '@/utils/cn';
import {
	aggregateTrustedDeviceEdgeSync,
	formatApkSha256Short,
	formatDt,
	type TrustedDeviceEdgeSyncUiStatus,
} from './mobileHubFormat';

type Props = {
	overview: MobileAppOverview | null;
	buildLabel: string;
	devices: MobileTrustedDeviceItem[];
};

function edgeWorstLabelKey(status: TrustedDeviceEdgeSyncUiStatus): string {
	switch (status) {
		case 'synced':
			return 'friends.mobileApp.trustedDeviceEdgeSyncSynced';
		case 'pending':
			return 'friends.mobileApp.trustedDeviceEdgeSyncPending';
		case 'failed':
			return 'friends.mobileApp.trustedDeviceEdgeSyncFailed';
		case 'manual_required':
			return 'friends.mobileApp.trustedDeviceEdgeSyncManual';
		default:
			return 'friends.mobileApp.trustedDeviceEdgeSyncUnknown';
	}
}

export function MobileHubOtaObservabilityStrip({
	overview,
	buildLabel,
	devices,
}: Props): JSX.Element {
	const { t } = useTranslation('contentManager');
	const edge = aggregateTrustedDeviceEdgeSync(devices);
	const shaFull = (overview?.apk_sha256 || '').trim().toLowerCase();
	const shaShort = formatApkSha256Short(shaFull);
	const publishedAt = formatDt(overview?.published_at);
	const apkAvailable = Boolean(overview?.apk_available);

	return (
		<section
			className={cn(SH_PANEL_INSET_CLASS, 'space-y-3')}
			data-testid="mobile-hub-ota-observability"
			aria-label={t('friends.mobileApp.otaObservabilityAria')}
		>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h3 className="text-sm font-semibold text-(--desktop-text-primary)">
					{t('friends.mobileApp.otaObservabilityTitle')}
				</h3>
				<p className="text-xs text-(--desktop-text-muted)">
					{t('friends.mobileApp.otaObservabilityHint')}
				</p>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<div>
					<p className={SH_MOBILE_FIELD_LABEL_CLASS}>
						{t('friends.mobileApp.otaPublishedBuild')}
					</p>
					<p
						className={SH_MOBILE_FIELD_VALUE_CLASS}
						data-testid="mobile-hub-ota-build"
					>
						{buildLabel}
					</p>
					<p className={SH_MOBILE_FIELD_HINT_CLASS}>
						{apkAvailable
							? t('friends.mobileApp.otaApkAvailable')
							: t('friends.mobileApp.otaApkUnavailable')}
					</p>
				</div>
				<div>
					<p className={SH_MOBILE_FIELD_LABEL_CLASS}>
						{t('friends.mobileApp.otaSha256')}
					</p>
					<p
						className={cn(
							SH_MOBILE_FIELD_VALUE_CLASS,
							'font-mono text-xs tracking-tight'
						)}
						data-testid="mobile-hub-ota-sha"
						title={shaFull || undefined}
					>
						{shaShort}
					</p>
					<p className={SH_MOBILE_FIELD_HINT_CLASS}>
						{t('friends.mobileApp.otaSha256Hint')}
					</p>
				</div>
				<div>
					<p className={SH_MOBILE_FIELD_LABEL_CLASS}>
						{t('friends.mobileApp.otaPublishedAt')}
					</p>
					<p
						className={SH_MOBILE_FIELD_VALUE_CLASS}
						data-testid="mobile-hub-ota-published-at"
					>
						{publishedAt}
					</p>
					{overview?.min_supported_version_code != null ? (
						<p className={SH_MOBILE_FIELD_HINT_CLASS}>
							{t('friends.mobileApp.otaMinSupported', {
								code: overview.min_supported_version_code,
							})}
						</p>
					) : (
						<p className={SH_MOBILE_FIELD_HINT_CLASS}>
							{t('friends.mobileApp.otaPublishedAtHint')}
						</p>
					)}
				</div>
				<div>
					<p className={SH_MOBILE_FIELD_LABEL_CLASS}>
						{t('friends.mobileApp.otaTrustedActive')}
					</p>
					<p
						className={cn(SH_MOBILE_FIELD_VALUE_CLASS, 'tabular-nums')}
						data-testid="mobile-hub-ota-active-devices"
					>
						{edge.activeCount}
					</p>
					<p
						className={SH_MOBILE_FIELD_HINT_CLASS}
						data-testid="mobile-hub-ota-edge-aggregate"
						data-edge-worst={edge.worstStatus ?? 'none'}
					>
						{edge.activeCount === 0
							? t('friends.mobileApp.otaEdgeNone')
							: t('friends.mobileApp.otaEdgeSummary', {
									synced: edge.byStatus.synced,
									pending: edge.byStatus.pending,
									attention:
										edge.byStatus.failed +
										edge.byStatus.manual_required +
										edge.byStatus.unknown,
									worst: edge.worstStatus
										? t(edgeWorstLabelKey(edge.worstStatus))
										: '—',
								})}
					</p>
					{edge.lastSyncedAt ? (
						<p
							className={SH_MOBILE_FIELD_HINT_CLASS}
							data-testid="mobile-hub-ota-edge-last-sync"
						>
							{t('friends.mobileApp.trustedDeviceEdgeSyncedAt', {
								when: formatDt(edge.lastSyncedAt),
							})}
						</p>
					) : null}
				</div>
			</div>
		</section>
	);
}
