/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders trusted-phone pairing, freshness recovery, device revocation, and
 * honest Secure Connection edge-sync status from trusted-device list fields.
 *
 * Invariants:
 * - Device revocation is optimistic but reconciles with the server after every outcome.
 * - A pairing code remains visible until controller confirmation or expiry.
 * - WG metadata readiness must not be labeled as full Secure Connection readiness;
 *   edge sync uses wg_edge_sync_status / wg_edge_synced_at from the API.
 *
 * Related:
 * - useMobileAppHubController.ts
 * - mobileHubFormat.ts (resolveTrustedDeviceEdgeSyncStatus)
 * - documentation/product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md
 * - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
 */

import {
	ArrowPathIcon,
	ClipboardDocumentIcon,
	ShieldCheckIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppStatusBadge,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	SH_MOBILE_DOWNLOAD_PANEL_CLASS,
	SH_MOBILE_FIELD_LABEL_CLASS,
	SH_SUBPANEL_TITLE_CLASS,
} from '../../social-hub/layout/socialHubLayoutTokens';
import type {
	MobilePairingChallengeResponse,
	MobileTrustedDeviceItem,
} from '@/services/mobileAppApi';
import { cn } from '@/utils/cn';
import {
	formatDt,
	resolveTrustedDeviceEdgeSyncStatus,
	type TrustedDeviceEdgeSyncUiStatus,
} from './mobileHubFormat';

type Props = {
	devices: MobileTrustedDeviceItem[];
	error: string | null;
	pairingChallenge: MobilePairingChallengeResponse | null;
	pairingBusy: boolean;
	pairingInlineNotice: string | null;
	prepareGafE2ee: boolean;
	revokeBusyId: string | null;
	setPrepareGafE2ee: (value: boolean) => void;
	onCreatePairingChallenge: () => Promise<void>;
	onCopyPairingCode: () => Promise<void>;
	onRevokeDevice: (device: MobileTrustedDeviceItem) => Promise<void>;
	onRefresh: () => Promise<void>;
};

export function MobileHubTrustedDevicesPanel({
	devices,
	error,
	pairingChallenge,
	pairingBusy,
	pairingInlineNotice,
	prepareGafE2ee,
	revokeBusyId,
	setPrepareGafE2ee,
	onCreatePairingChallenge,
	onCopyPairingCode,
	onRevokeDevice,
	onRefresh,
}: Props): JSX.Element {
	const { t } = useTranslation('contentManager');
	return (
		<section className={SH_MOBILE_DOWNLOAD_PANEL_CLASS}>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h3
						className={cn(SH_SUBPANEL_TITLE_CLASS, 'flex items-center gap-2')}
					>
						<ShieldCheckIcon
							className={DESKTOP_LUCIDE.sm}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('friends.mobileApp.trustedDeviceTitle', {
							defaultValue: 'Доверенное устройство',
						})}
					</h3>
					<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
						{t('friends.mobileApp.trustedDeviceDescription', {
							defaultValue:
								'Привязка добавляет защиту Secure Connection. Приватные ключи остаются на телефоне. Полная готовность — только после синхронизации VPN на сервере (не путать с выдачей config).',
						})}
					</p>
				</div>
				<label className="flex items-center gap-2 text-xs text-(--desktop-text-muted)">
					<input
						type="checkbox"
						checked={prepareGafE2ee}
						onChange={(event) => setPrepareGafE2ee(event.currentTarget.checked)}
					/>
					{t('friends.mobileApp.prepareGafE2ee', {
						defaultValue: 'Подготовить ключи GAF E2EE',
					})}
				</label>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				<DesktopAppButton
					type="button"
					variant="accent"
					className="gap-1.5"
					disabled={pairingBusy}
					onClick={() => void onCreatePairingChallenge()}
				>
					<ShieldCheckIcon
						className={DESKTOP_LUCIDE.sm}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{pairingBusy
						? t('friends.mobileApp.trustedDevicePairingBusy', {
								defaultValue: 'Создаём…',
							})
						: t('friends.mobileApp.trustedDevicePairingAction', {
								defaultValue: 'Создать код привязки',
							})}
				</DesktopAppButton>
				{pairingChallenge ? (
					<DesktopAppButton
						type="button"
						variant="neutral"
						className="gap-1.5"
						onClick={() => void onCopyPairingCode()}
					>
						<ClipboardDocumentIcon
							className={DESKTOP_LUCIDE.sm}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('friends.mobileApp.trustedDeviceCopyCode', {
							defaultValue: 'Скопировать код',
						})}
					</DesktopAppButton>
				) : null}
			</div>
			{pairingInlineNotice ? (
				<DesktopProductStatusBanner
					tone="info"
					role="status"
					aria-live="polite"
					className="mt-3"
					title={t('friends.mobileApp.trustedDeviceTitle')}
					description={pairingInlineNotice}
				/>
			) : null}
			{pairingChallenge ? (
				<div
					className="mt-3 rounded-(--desktop-radius-md) border-2 border-(--desktop-accent)/50 bg-(--desktop-surface-elevated) p-4 shadow-sm"
					role="status"
					aria-live="polite"
					data-testid="trusted-device-pairing-code-panel"
				>
					<p className={SH_MOBILE_FIELD_LABEL_CLASS}>
						{t('friends.mobileApp.trustedDevicePairingCode', {
							defaultValue: 'Код привязки',
						})}
					</p>
					<p
						className="mt-2 font-mono text-3xl font-semibold tracking-[0.35em] text-(--desktop-accent)"
						data-testid="trusted-device-pairing-code-value"
					>
						{pairingChallenge.pairing_code}
					</p>
					<p className="mt-2 text-xs leading-relaxed text-(--desktop-text-muted)">
						{t('friends.mobileApp.trustedDevicePairingStartedBody', {
							defaultValue:
								'Введите код в мобильном приложении в течение 5 минут.',
						})}
					</p>
					<p className="mt-1 text-xs text-(--desktop-text-muted)">
						{t('friends.mobileApp.trustedDevicePairingExpires', {
							defaultValue: 'Действует до',
						})}{' '}
						{formatDt(pairingChallenge.expires_at)}
					</p>
				</div>
			) : null}
			{error ? (
				<DesktopProductStatusBanner
					tone="warning"
					role="alert"
					aria-live="polite"
					className="mt-3"
					title={t('friends.mobileApp.trustedDevicesLoadErrorTitle')}
					description={error}
					actions={
						<DesktopAppButton
							type="button"
							variant="neutral"
							className="shrink-0 gap-1.5"
							onClick={() => void onRefresh()}
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
			<div className="mt-4 space-y-2">
				{devices.length > 0 ? (
					devices.map((device) => (
						<TrustedDeviceRow
							key={device.id}
							device={device}
							revokeBusyId={revokeBusyId}
							onRevokeDevice={onRevokeDevice}
						/>
					))
				) : (
					<p className="text-xs text-(--desktop-text-muted)">
						{t('friends.mobileApp.trustedDeviceEmpty', {
							defaultValue: 'Доверенные телефоны ещё не привязаны.',
						})}
					</p>
				)}
			</div>
		</section>
	);
}

function edgeSyncBadgeClass(status: TrustedDeviceEdgeSyncUiStatus): string {
	switch (status) {
		case 'synced':
			return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
		case 'pending':
			return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
		case 'failed':
			return 'border-rose-400/40 bg-rose-500/10 text-rose-200';
		case 'manual_required':
			return 'border-orange-400/40 bg-orange-500/10 text-orange-200';
		default:
			return 'border-(--desktop-border-subtle) bg-(--desktop-surface-muted) text-(--desktop-text-muted)';
	}
}

function edgeSyncLabelKey(
	status: TrustedDeviceEdgeSyncUiStatus
):
	| 'friends.mobileApp.trustedDeviceEdgeSyncSynced'
	| 'friends.mobileApp.trustedDeviceEdgeSyncPending'
	| 'friends.mobileApp.trustedDeviceEdgeSyncFailed'
	| 'friends.mobileApp.trustedDeviceEdgeSyncManual'
	| 'friends.mobileApp.trustedDeviceEdgeSyncUnknown' {
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

function TrustedDeviceRow({
	device,
	revokeBusyId,
	onRevokeDevice,
}: Pick<Props, 'revokeBusyId' | 'onRevokeDevice'> & {
	device: MobileTrustedDeviceItem;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const tunnelReady = Boolean(
		device.wg_assigned_ip && device.wg_endpoint && device.wg_server_public_key
	);
	const edgeSyncStatus = resolveTrustedDeviceEdgeSyncStatus(device);
	const gafReady = Boolean(device.gaf_public_key_fingerprint);
	return (
		<div className="flex flex-col gap-3 rounded-(--desktop-radius-md) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium">{device.device_label}</p>
					<DesktopAppStatusBadge className="border-emerald-400/40 bg-emerald-500/10 text-emerald-200">
						{t('friends.mobileApp.trustedDeviceBound', {
							defaultValue: 'Телефон привязан',
						})}
					</DesktopAppStatusBadge>
				</div>
				<p className="mt-1 text-xs text-(--desktop-text-muted)">
					WG {device.wg_assigned_ip ?? '—'} · {formatDt(device.approved_at)}
				</p>
				<div className="mt-2 flex flex-wrap gap-1.5">
					<DesktopAppStatusBadge
						className={
							tunnelReady
								? 'border-sky-400/40 bg-sky-500/10 text-sky-200'
								: 'border-amber-400/40 bg-amber-500/10 text-amber-200'
						}
					>
						{tunnelReady
							? t('friends.mobileApp.trustedDeviceTunnelReady')
							: t('friends.mobileApp.trustedDeviceTunnelPending')}
					</DesktopAppStatusBadge>
					<DesktopAppStatusBadge
						className={edgeSyncBadgeClass(edgeSyncStatus)}
						data-testid="trusted-device-edge-sync-badge"
						data-edge-sync-status={edgeSyncStatus}
					>
						{t(edgeSyncLabelKey(edgeSyncStatus))}
					</DesktopAppStatusBadge>
					<DesktopAppStatusBadge
						className={
							gafReady
								? 'border-violet-400/40 bg-violet-500/10 text-violet-200'
								: 'border-(--desktop-border-subtle) bg-(--desktop-surface-muted) text-(--desktop-text-muted)'
						}
					>
						{gafReady
							? t('friends.mobileApp.trustedDeviceGafReady')
							: t('friends.mobileApp.trustedDeviceGafNotPrepared')}
					</DesktopAppStatusBadge>
				</div>
				{device.wg_edge_synced_at ? (
					<p
						className="mt-1.5 text-xs text-(--desktop-text-muted)"
						data-testid="trusted-device-edge-synced-at"
					>
						{t('friends.mobileApp.trustedDeviceEdgeSyncedAt', {
							when: formatDt(device.wg_edge_synced_at),
						})}
					</p>
				) : null}
			</div>
			<DesktopAppButton
				type="button"
				variant="danger"
				size="sm"
				className="gap-1.5"
				disabled={revokeBusyId === device.id || device.status === 'revoked'}
				onClick={() => void onRevokeDevice(device)}
			>
				<TrashIcon
					className={DESKTOP_LUCIDE.sm}
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				{t('friends.mobileApp.trustedDeviceRevoke', {
					defaultValue: 'Отозвать',
				})}
			</DesktopAppButton>
		</div>
	);
}
