/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns Mobile Hub data loading, APK download, trusted-device pairing, and revoke actions.
 *
 * Invariants:
 * - Overview and trusted-device failures stay independently recoverable.
 * - A pairing challenge persists until expiry or a newly bound device is observed.
 *
 * Related:
 * - MobileAppHubPanel.tsx
 * - mobile-secure-connection.mdc
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { notify } from '@/notifications/api';
import {
	isAuthenticated,
	isOidcAuthFreshForDeviceBinding,
	keycloak,
} from '@/services/keycloak';
import {
	createMobilePairingChallenge,
	downloadMobileApkBlob,
	fetchMobileAppOverview,
	fetchMobileTrustedDevices,
	requestMobileApkDownloadTicket,
	revokeMobileTrustedDevice,
	triggerApkDownload,
	triggerApkDownloadByUrl,
	type MobileAppOverview,
	type MobilePairingChallengeResponse,
	type MobileTrustedDeviceItem,
} from '@/services/mobileAppApi';
import {
	getApiErrorDetail,
	isForbiddenResponse,
	isFreshAuthRequiredError,
	isTrustedUserRequiredError,
} from './pairingAuthErrors';
import { pairingBindDetectedAfterChallenge } from './mobileHubFormat';
import {
	PAIRING_PENDING_KEY,
	readStoredPairingChallenge,
	storePairingChallenge,
} from './pairingChallengeStorage';

const BACKGROUND_POLL_MS = 30_000;
const PAIRING_POLL_MS = 5_000;

export type MobileAppHubController = {
	overview: MobileAppOverview | null;
	loading: boolean;
	downloading: boolean;
	error: string | null;
	trustedDevices: MobileTrustedDeviceItem[];
	trustedDevicesError: string | null;
	pairingChallenge: MobilePairingChallengeResponse | null;
	pairingBusy: boolean;
	pairingInlineNotice: string | null;
	prepareGafE2ee: boolean;
	revokeBusyId: string | null;
	load: (options?: { silent?: boolean }) => Promise<void>;
	setPrepareGafE2ee: (value: boolean) => void;
	onDownload: () => Promise<void>;
	onCreatePairingChallenge: () => Promise<void>;
	onCopyPairingCode: () => Promise<void>;
	onRevokeDevice: (device: MobileTrustedDeviceItem) => Promise<void>;
};

export function useMobileAppHubController(): MobileAppHubController {
	const { t } = useTranslation('contentManager');
	const [overview, setOverview] = useState<MobileAppOverview | null>(null);
	const [loading, setLoading] = useState(true);
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [trustedDevicesError, setTrustedDevicesError] = useState<string | null>(
		null
	);
	const [trustedDevices, setTrustedDevices] = useState<
		MobileTrustedDeviceItem[]
	>([]);
	const [pairingChallenge, setPairingChallenge] =
		useState<MobilePairingChallengeResponse | null>(null);
	const [pairingBusy, setPairingBusy] = useState(false);
	const [pairingInlineNotice, setPairingInlineNotice] = useState<string | null>(
		null
	);
	const [prepareGafE2ee, setPrepareGafE2ee] = useState(true);
	const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);
	const pairingIssuedAtMsRef = useRef<number | null>(null);
	const pairingBaselineDeviceIdsRef = useRef<Set<string>>(new Set());
	const revokingDeviceIdsRef = useRef<Set<string>>(new Set());
	const locallyRevokedDeviceIdsRef = useRef<Set<string>>(new Set());

	const clearPairingChallenge = useCallback(() => {
		pairingIssuedAtMsRef.current = null;
		pairingBaselineDeviceIdsRef.current = new Set();
		setPairingChallenge(null);
		setPairingInlineNotice(null);
		storePairingChallenge(null);
	}, []);

	const applyPairingChallenge = useCallback(
		(challenge: MobilePairingChallengeResponse) => {
			const issuedAtMs = Date.now();
			const baseline = new Set(trustedDevices.map((device) => device.id));
			pairingIssuedAtMsRef.current = issuedAtMs;
			pairingBaselineDeviceIdsRef.current = baseline;
			setPairingChallenge(challenge);
			setPairingInlineNotice(null);
			storePairingChallenge({
				challenge,
				issuedAtMs,
				baselineDeviceIds: [...baseline],
			});
		},
		[trustedDevices]
	);

	const load = useCallback(
		async (options?: { silent?: boolean }) => {
			const silent = options?.silent === true;
			if (!silent) setLoading(true);
			setError(null);
			if (!silent) setTrustedDevicesError(null);

			const overviewTask = fetchMobileAppOverview()
				.then(setOverview)
				.catch(() => {
					setError(t('friends.mobileApp.loadError'));
					setOverview(null);
				});
			const devicesTask = fetchMobileTrustedDevices()
				.then((data) => {
					setTrustedDevices(
						data.items.filter(
							(item) =>
								item.status === 'active' &&
								!locallyRevokedDeviceIdsRef.current.has(item.id)
						)
					);
					setTrustedDevicesError(null);
				})
				.catch(() => {
					setTrustedDevicesError(
						t('friends.mobileApp.trustedDevicesLoadError')
					);
					setTrustedDevices([]);
				});
			await Promise.allSettled([overviewTask, devicesTask]);
			if (!silent) setLoading(false);
		},
		[t]
	);

	const requestFreshAuthForDeviceAction = useCallback(
		(options?: { forRevoke?: boolean }) => {
			if (!options?.forRevoke) {
				sessionStorage.setItem(
					PAIRING_PENDING_KEY,
					JSON.stringify({ prepareGafE2ee })
				);
			}
			const message = options?.forRevoke
				? t('friends.mobileApp.trustedDeviceFreshAuthRevokeBody', {
						defaultValue:
							'Сейчас откроется Keycloak. Войдите заново, затем снова нажмите «Отозвать».',
					})
				: t('friends.mobileApp.trustedDeviceFreshAuthRequiredBody', {
						defaultValue:
							'Сейчас откроется Keycloak. Войдите заново — код привязки создастся автоматически.',
					});
			setPairingInlineNotice(message);
			notify.warning(
				t('friends.mobileApp.trustedDeviceFreshAuthRequired', {
					defaultValue: 'Нужно обновить вход',
				}),
				message
			);
			void keycloak.login({
				redirectUri: window.location.href,
				forceFreshAuth: true,
			});
		},
		[prepareGafE2ee, t]
	);

	const requestFreshAuthForPairing = useCallback(() => {
		requestFreshAuthForDeviceAction();
	}, [requestFreshAuthForDeviceAction]);

	const handlePairingError = useCallback(
		(pairingError: unknown) => {
			if (isTrustedUserRequiredError(pairingError)) {
				const message = t(
					'friends.mobileApp.trustedDeviceTrustedRequiredBody',
					{
						defaultValue:
							'Привязка телефона доступна только пользователям с trusted-статусом.',
					}
				);
				setPairingInlineNotice(message);
				notify.error(
					t('friends.mobileApp.trustedDeviceTrustedRequired', {
						defaultValue: 'Нужен статус доверенного пользователя',
					}),
					message
				);
				return;
			}
			if (
				isFreshAuthRequiredError(pairingError) ||
				isForbiddenResponse(pairingError)
			) {
				requestFreshAuthForPairing();
				return;
			}
			const message =
				getApiErrorDetail(pairingError) ||
				t('friends.mobileApp.trustedDevicePairingFailedBody', {
					defaultValue:
						'Проверьте trusted-статус пользователя и свежую авторизацию.',
				});
			setPairingInlineNotice(message);
			notify.error(
				t('friends.mobileApp.trustedDevicePairingFailed', {
					defaultValue: 'Не удалось создать код привязки',
				}),
				message
			);
		},
		[requestFreshAuthForPairing, t]
	);

	const createPairingChallenge = useCallback(
		async (prepareFlag: boolean) => {
			setPairingBusy(true);
			try {
				applyPairingChallenge(await createMobilePairingChallenge(prepareFlag));
				notify.success(
					t('friends.mobileApp.trustedDevicePairingStarted', {
						defaultValue: 'Код привязки создан',
					}),
					t('friends.mobileApp.trustedDevicePairingStartedBody', {
						defaultValue:
							'Введите код в мобильном приложении в течение 5 минут.',
					})
				);
			} catch (pairingError) {
				handlePairingError(pairingError);
			} finally {
				setPairingBusy(false);
			}
		},
		[applyPairingChallenge, handlePairingError, t]
	);

	useEffect(() => {
		const stored = readStoredPairingChallenge();
		if (!stored) return;
		pairingIssuedAtMsRef.current = stored.issuedAtMs;
		pairingBaselineDeviceIdsRef.current = new Set(stored.baselineDeviceIds);
		setPairingChallenge(stored.challenge);
	}, []);
	useEffect(() => {
		void load();
	}, [load]);
	useEffect(() => {
		const intervalId = window.setInterval(
			() => void load({ silent: true }),
			BACKGROUND_POLL_MS
		);
		return () => window.clearInterval(intervalId);
	}, [load]);
	useEffect(() => {
		const refresh = () => void load({ silent: true });
		const onVisibility = () => {
			if (document.visibilityState === 'visible') refresh();
		};
		window.addEventListener('focus', refresh);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('focus', refresh);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [load]);
	useEffect(() => {
		if (!pairingChallenge) return;
		const expiresAt = new Date(pairingChallenge.expires_at).getTime();
		const intervalId = window.setInterval(() => {
			if (Number.isFinite(expiresAt) && Date.now() > expiresAt) return;
			void load({ silent: true });
		}, PAIRING_POLL_MS);
		return () => window.clearInterval(intervalId);
	}, [load, pairingChallenge]);
	useEffect(() => {
		if (!pairingChallenge || pairingIssuedAtMsRef.current == null) return;
		if (
			pairingBindDetectedAfterChallenge(
				trustedDevices,
				pairingIssuedAtMsRef.current,
				pairingBaselineDeviceIdsRef.current
			)
		) {
			clearPairingChallenge();
			notify.success(
				t('friends.mobileApp.trustedDeviceBound', {
					defaultValue: 'Телефон привязан',
				}),
				t('friends.mobileApp.trustedDeviceBoundBody', {
					defaultValue: 'Secure Connection config выдан телефону.',
				})
			);
		}
	}, [clearPairingChallenge, pairingChallenge, t, trustedDevices]);
	useEffect(() => {
		const raw = sessionStorage.getItem(PAIRING_PENDING_KEY);
		if (!raw || !isAuthenticated()) return;
		if (!isOidcAuthFreshForDeviceBinding()) {
			setPairingInlineNotice(
				t('friends.mobileApp.trustedDeviceFreshAuthRequiredBody', {
					defaultValue: 'Нажмите «Создать код привязки» ещё раз.',
				})
			);
			return;
		}
		let prepareFlag = true;
		try {
			const parsed = JSON.parse(raw) as { prepareGafE2ee?: boolean };
			if (typeof parsed.prepareGafE2ee === 'boolean')
				prepareFlag = parsed.prepareGafE2ee;
		} catch {
			// A malformed pending record is safely ignored.
		}
		sessionStorage.removeItem(PAIRING_PENDING_KEY);
		setPrepareGafE2ee(prepareFlag);
		void createPairingChallenge(prepareFlag);
	}, [createPairingChallenge, t]);

	const onDownload = useCallback(async () => {
		if (!overview?.apk_available) {
			notify.warning(
				t('friends.mobileApp.apkUnavailableTitle'),
				t('friends.mobileApp.apkUnavailableBody')
			);
			return;
		}
		setDownloading(true);
		try {
			triggerApkDownloadByUrl(
				(await requestMobileApkDownloadTicket()).download_url
			);
			notify.info(
				t('friends.mobileApp.downloadStarted'),
				t('friends.mobileApp.downloadStartedBody')
			);
		} catch {
			try {
				triggerApkDownload(await downloadMobileApkBlob());
				notify.info(
					t('friends.mobileApp.downloadStarted'),
					t('friends.mobileApp.downloadStartedBody')
				);
			} catch {
				notify.error(
					t('friends.mobileApp.downloadFailedTitle'),
					t('friends.mobileApp.downloadFailedBody')
				);
			}
		} finally {
			setDownloading(false);
		}
	}, [overview?.apk_available, t]);

	const onCreatePairingChallenge = useCallback(async () => {
		if (!isOidcAuthFreshForDeviceBinding()) {
			requestFreshAuthForPairing();
			return;
		}
		await createPairingChallenge(prepareGafE2ee);
	}, [createPairingChallenge, prepareGafE2ee, requestFreshAuthForPairing]);
	const onCopyPairingCode = useCallback(async () => {
		if (!pairingChallenge) return;
		await navigator.clipboard?.writeText(pairingChallenge.pairing_code);
		notify.success(
			t('friends.mobileApp.trustedDeviceCopied', {
				defaultValue: 'Код скопирован',
			}),
			''
		);
	}, [pairingChallenge, t]);
	const onRevokeDevice = useCallback(
		async (device: MobileTrustedDeviceItem) => {
			if (revokingDeviceIdsRef.current.has(device.id)) return;
			if (!isOidcAuthFreshForDeviceBinding()) {
				requestFreshAuthForDeviceAction({ forRevoke: true });
				return;
			}
			revokingDeviceIdsRef.current.add(device.id);
			locallyRevokedDeviceIdsRef.current.add(device.id);
			setRevokeBusyId(device.id);
			setTrustedDevices((items) =>
				items.filter((item) => item.id !== device.id)
			);
			clearPairingChallenge();
			try {
				await revokeMobileTrustedDevice(
					device.id,
					'user_revoked_from_desktop_phone_panel'
				);
				notify.success(
					t('friends.mobileApp.trustedDeviceRevoked', {
						defaultValue: 'Устройство отозвано',
					}),
					t('friends.mobileApp.trustedDeviceRevokedBody', {
						defaultValue: 'Чтобы привязать снова, создайте новый код.',
					})
				);
				await load({ silent: true });
			} catch (revokeError) {
				locallyRevokedDeviceIdsRef.current.delete(device.id);
				if (isFreshAuthRequiredError(revokeError)) {
					requestFreshAuthForDeviceAction({ forRevoke: true });
					await load();
					return;
				}
				const detail = getApiErrorDetail(revokeError);
				notify.error(
					t('friends.mobileApp.trustedDeviceRevokeFailed', {
						defaultValue: 'Не удалось отозвать устройство',
					}),
					detail ||
						t('friends.mobileApp.trustedDeviceRevokeFailedBody', {
							defaultValue:
								'Обновите страницу. Если телефон уже отвязан в приложении — список очистится после обновления входа.',
						})
				);
				await load();
			} finally {
				revokingDeviceIdsRef.current.delete(device.id);
				setRevokeBusyId(null);
			}
		},
		[clearPairingChallenge, load, requestFreshAuthForDeviceAction, t]
	);

	return {
		overview,
		loading,
		downloading,
		error,
		trustedDevices,
		trustedDevicesError,
		pairingChallenge,
		pairingBusy,
		pairingInlineNotice,
		prepareGafE2ee,
		revokeBusyId,
		load,
		setPrepareGafE2ee,
		onDownload,
		onCreatePairingChallenge,
		onCopyPairingCode,
		onRevokeDevice,
	};
}
