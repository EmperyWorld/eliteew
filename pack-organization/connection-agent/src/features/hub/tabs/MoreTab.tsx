/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey Hub Ещё — License (W5c) + Connection + Host network + About/contacts (W6).
 *
 * Invariants:
 * - Local reset CTA is retail-visible; ops ProfileMenu clear-bind stays ops-only.
 * - Connection UI uses four signal levels; no peer IP / SOCKS in primary copy.
 * - Host network is OS link/Wi‑Fi (not W-transport); also available pre-license via chrome.
 * - Site/mailto via opener on main launcher only.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.3–§5.6
 */

import { ProfileMenu } from '../../profile-menu/ProfileMenu';
import { tunnelChipValue } from '../../../lib/launcher/shellChips';
import type {
	EntitlementStatusView,
	WgPortalStatus,
} from '../../../lib/tauri-bridge/commands';
import { tunnelTone } from '../../../lib/ui/statusCopy';
import { AboutContactsPanel } from '../more/AboutContactsPanel';
import { ConnectionPanel } from '../more/ConnectionPanel';
import { LicensePanel } from '../more/LicensePanel';
import { HostNetworkPanel } from '../../network/HostNetworkPanel';

export type MoreTabProps = {
	appBase: string;
	enrollBase: string;
	wg: WgPortalStatus | null;
	entitlement: EntitlementStatusView | null;
	onlineBoundLabel: string | null;
	boundLabel: string;
	deviceBound?: boolean | null;
	onCheckChannel?: () => void;
	channelCheckBusy?: boolean;
	onStopChannel?: () => void;
	channelStopBusy?: boolean;
	onGoHome: () => void;
	onOpenTunnel?: () => void;
	onClearDeviceBind?: () => void;
	clearDeviceBindBusy?: boolean;
	onOpenSite?: () => void;
	onOpenSourceCode?: () => void;
	onOpenMailto?: () => void;
	graphicsRecoveryAvailable?: boolean;
	graphicsRecoveryBusy?: boolean;
	onGraphicsRecovery?: () => void;
};

export function MoreTab(props: MoreTabProps) {
	const {
		appBase,
		enrollBase,
		wg,
		entitlement,
		onlineBoundLabel,
		boundLabel,
		deviceBound = null,
		onCheckChannel,
		channelCheckBusy = false,
		onStopChannel,
		channelStopBusy = false,
		onGoHome,
		onOpenTunnel,
		onClearDeviceBind,
		clearDeviceBindBusy = false,
		onOpenSite,
		onOpenSourceCode,
		onOpenMailto,
		graphicsRecoveryAvailable = false,
		graphicsRecoveryBusy = false,
		onGraphicsRecovery,
	} = props;

	const channelValue = tunnelChipValue(wg);
	const channelTone = tunnelTone(wg?.ok, wg?.code);

	return (
		<div className="shell-split" data-layout="more-tab">
			<div className="shell-primary">
				<LicensePanel
					entitlement={entitlement}
					onlineBoundLabel={onlineBoundLabel}
					boundLabel={boundLabel}
					channelLabel={channelValue}
					channelTone={channelTone}
					deviceBound={deviceBound}
				/>
				<ConnectionPanel
					wg={wg}
					onCheckChannel={onCheckChannel}
					channelCheckBusy={channelCheckBusy}
					onStopChannel={onStopChannel}
					channelStopBusy={channelStopBusy}
				/>
				<HostNetworkPanel variant="section" />
				<AboutContactsPanel
					onOpenSite={onOpenSite}
					onOpenSourceCode={onOpenSourceCode}
					onOpenMailto={onOpenMailto}
					graphicsRecoveryAvailable={graphicsRecoveryAvailable}
					graphicsRecoveryBusy={graphicsRecoveryBusy}
					onGraphicsRecovery={onGraphicsRecovery}
				/>
			</div>
			<div className="shell-secondary">
				<ProfileMenu
					enrollBase={enrollBase}
					appBase={appBase}
					boundLabel={boundLabel}
					onBackToLicense={onOpenTunnel ? onGoHome : undefined}
					onOpenTunnel={onOpenTunnel}
					onClearDeviceBind={onClearDeviceBind}
					clearDeviceBindBusy={clearDeviceBindBusy}
				/>
			</div>
		</div>
	);
}
