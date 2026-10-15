/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composes the Social Hub mobile experience from dedicated data, pairing, and display modules.
 *
 * Invariants:
 * - The public default export remains the Social Hub mobile-tab entrypoint.
 * - Each subpanel receives only the state and actions it needs.
 *
 * Related:
 * - mobile-hub/useMobileAppHubController.ts
 * - services/mobileAppApi.ts
 */

import {
	ArrowPathIcon,
	DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppSkeleton,
	DesktopAppStatusBadge,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { formatMobileBuildLabel } from '@/services/mobileAppApi';
import { cn } from '@/utils/cn';
import { SocialHubSectionLead } from '../social-hub/layout/SocialHubSectionLead';
import { MobileHubApkDownloadPanel } from './mobile-hub/MobileHubApkDownloadPanel';
import { MobileHubCallTargetPanel } from './mobile-hub/MobileHubCallTargetPanel';
import { MobileHubLoginHistoryPanel } from './mobile-hub/MobileHubLoginHistoryPanel';
import { MobileHubOtaObservabilityStrip } from './mobile-hub/MobileHubOtaObservabilityStrip';
import { MobileHubOverviewGrid } from './mobile-hub/MobileHubOverviewGrid';
import { MobileHubTrustedDevicesPanel } from './mobile-hub/MobileHubTrustedDevicesPanel';
import { formatMib } from './mobile-hub/mobileHubFormat';
import { useMobileAppHubController } from './mobile-hub/useMobileAppHubController';

export default function MobileAppHubPanel(): JSX.Element {
	const { t } = useTranslation('contentManager');
	const controller = useMobileAppHubController();

	if (controller.loading) {
		return (
			<div
				role="status"
				aria-live="polite"
				aria-busy="true"
				aria-label={t('friends.socialHubPhoneLoadingAria')}
			>
				<DesktopAppSkeleton className="min-h-[280px] w-full rounded-(--desktop-radius-lg)" />
			</div>
		);
	}

	const session = controller.overview?.mobile_session;
	const sessionStatusLabel = session?.live
		? t('friends.mobileApp.statusLive')
		: session?.active
			? t('friends.mobileApp.statusActive')
			: t('friends.mobileApp.statusOffline');
	const buildLabel =
		formatMobileBuildLabel(
			controller.overview?.version_name,
			controller.overview?.version_code
		) ?? '—';
	const apkSizeLabel = formatMib(controller.overview?.apk_size_bytes);

	return (
		<div className="flex min-h-0 flex-col gap-4 text-(--desktop-text-primary)">
			<SocialHubSectionLead
				title={
					<span className="flex items-center gap-2">
						<DevicePhoneMobileIcon
							className={cn(DESKTOP_LUCIDE.md, 'text-(--desktop-accent)')}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('friends.mobileApp.title')}
					</span>
				}
				description={t('friends.mobileApp.subtitle')}
				actions={
					<>
						<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary)">
							{sessionStatusLabel}
						</DesktopAppStatusBadge>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="gap-1.5"
							onClick={() => void controller.load()}
						>
							<ArrowPathIcon
								className={DESKTOP_LUCIDE.sm}
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{t('friends.mobileApp.refresh')}
						</DesktopAppButton>
					</>
				}
			/>
			{controller.error ? (
				<DesktopProductStatusBanner
					tone="danger"
					role="alert"
					aria-live="assertive"
					title={t('friends.mobileApp.loadErrorTitle')}
					description={controller.error}
					actions={
						<DesktopAppButton
							type="button"
							variant="neutral"
							className="shrink-0 gap-1.5"
							onClick={() => void controller.load()}
						>
							<ArrowPathIcon
								className={DESKTOP_LUCIDE.sm}
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{t('friends.mobileApp.refresh')}
						</DesktopAppButton>
					}
				/>
			) : null}
			<MobileHubOtaObservabilityStrip
				overview={controller.overview}
				buildLabel={buildLabel}
				devices={controller.trustedDevices}
			/>
			<MobileHubOverviewGrid
				overview={controller.overview}
				buildLabel={buildLabel}
			/>
			<MobileHubApkDownloadPanel
				overview={controller.overview}
				buildLabel={buildLabel}
				apkSizeLabel={apkSizeLabel}
				downloading={controller.downloading}
				onDownload={controller.onDownload}
			/>
			<MobileHubCallTargetPanel />
			<MobileHubTrustedDevicesPanel
				devices={controller.trustedDevices}
				error={controller.trustedDevicesError}
				pairingChallenge={controller.pairingChallenge}
				pairingBusy={controller.pairingBusy}
				pairingInlineNotice={controller.pairingInlineNotice}
				prepareGafE2ee={controller.prepareGafE2ee}
				revokeBusyId={controller.revokeBusyId}
				setPrepareGafE2ee={controller.setPrepareGafE2ee}
				onCreatePairingChallenge={controller.onCreatePairingChallenge}
				onCopyPairingCode={controller.onCopyPairingCode}
				onRevokeDevice={controller.onRevokeDevice}
				onRefresh={() => controller.load({ silent: true })}
			/>
			<MobileHubLoginHistoryPanel
				history={controller.overview?.login_history ?? []}
				onRefresh={controller.load}
			/>
		</div>
	);
}
