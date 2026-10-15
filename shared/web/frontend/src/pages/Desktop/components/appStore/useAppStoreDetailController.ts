/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detail-card state, fetch/install handlers, and derived flags for the App Store
 * application detail surface (loading, install toggle, deep link, Escape→back).
 *
 * Invariants:
 * - Install/uninstall mutate local `installed` only after parent promise succeeds.
 * - Stale fetch responses are ignored via fetchIdRef.
 * - Escape always calls onBack while the detail surface is mounted.
 *
 * Related:
 * - AppStoreCard.tsx, AppStoreDetailBody.tsx, AppStoreDetailStateViews.tsx
 */

import { useAuth } from '@/contexts/AuthContext';
import { notify as toast } from '@/notifications';
import { hasUgsAdminIdentity } from '@/utils/ugsAdminAccess';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_APPS } from '../../constants';
import type {
	StoreAppDetailResponse,
	StoreAppResponse,
} from '../../services/desktopApi';
import { getStoreApp } from '../../services/desktopApi';
import type { DesktopExpansionDiscoveryState } from '../../types/desktopExpansion.types';
import { appStoreInstallErrorMessage } from '../../utils/appStoreInstallError';
import {
	storeAppBillingCaption,
	storeAppInstallCtaLabel,
} from '../../utils/appStoreBillingCopy';
import { copyAppStoreAppDeepLink } from '../../utils/appStoreDeepLink';
import { getAppStoreWindowInstanceCap } from '../../utils/appStoreWindowPolicy';
import { getDesktopWindowMinSizeForAppComponent } from '../../utils/desktopWindowMinSizeRegistry';
import { getStoreAppGradientBarClass } from '../storeCatalogGradients';
import { categoryLabel as categoryLabelFor } from './appStoreCategories';

export type UseAppStoreDetailControllerParams = {
	appId: string;
	appFromStore: StoreAppResponse | null;
	onBack: () => void;
	onInstall: (appId: string) => Promise<void>;
	onUninstall: (appId: string) => Promise<void>;
	onError?: (message: string) => void;
	onOpenInstalledApp?: (appComponent: string) => void;
	expansionState?: DesktopExpansionDiscoveryState;
	appStoreDesktopShortcutIds?: readonly string[];
};

export type AppStoreDetailBusyAction = 'install' | 'uninstall' | null;

export function useAppStoreDetailController({
	appId,
	appFromStore,
	onBack,
	onInstall,
	onUninstall,
	onError,
	onOpenInstalledApp,
	expansionState,
	appStoreDesktopShortcutIds,
}: UseAppStoreDetailControllerParams) {
	const { user } = useAuth();
	const showTechnicalDetails = hasUgsAdminIdentity(user);
	const { t } = useTranslation('appStore');

	const [detail, setDetail] = useState<
		StoreAppDetailResponse | StoreAppResponse | null
	>(appFromStore ?? null);
	const [loading, setLoading] = useState(!appFromStore);
	const [busy, setBusy] = useState(false);
	const [busyAction, setBusyAction] = useState<AppStoreDetailBusyAction>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const fetchIdRef = useRef(0);

	const fetchDetailFromApi = useCallback(() => {
		const id = ++fetchIdRef.current;
		setLoading(true);
		setLoadError(null);
		getStoreApp(appId)
			.then((data) => {
				if (id !== fetchIdRef.current) return;
				setDetail(data);
			})
			.catch((err) => {
				if (id !== fetchIdRef.current) return;
				console.error('[AppStoreCard] Failed to load app detail', {
					appId,
					err,
				});
				setDetail(null);
				const message = err instanceof Error ? err.message : t('error.loadApp');
				setLoadError(message);
				onError?.(message);
			})
			.finally(() => {
				if (id === fetchIdRef.current) setLoading(false);
			});
	}, [appId, onError, t]);

	useEffect(() => {
		if (appFromStore) {
			fetchIdRef.current += 1;
			setDetail(appFromStore);
			setLoading(false);
			setLoadError(null);
			return;
		}
		fetchDetailFromApi();
	}, [appFromStore, fetchDetailFromApi]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onBack();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onBack]);

	const handleInstall = useCallback(async () => {
		if (
			detail &&
			!detail.installed &&
			(detail.maintenance_mode === true ||
				('can_install' in detail && detail.can_install === false))
		) {
			return;
		}
		setBusy(true);
		const wasInstalled = detail?.installed === true;
		setBusyAction(wasInstalled ? 'uninstall' : 'install');
		try {
			const name = detail?.name ?? appId;
			if (detail?.installed) {
				await onUninstall(appId);
			} else {
				await onInstall(appId);
			}
			setDetail((prev) =>
				prev ? { ...prev, installed: !prev.installed } : null
			);
			toast.success(
				wasInstalled ? t('detail.toastRemoved') : t('detail.toastInstalled'),
				t('toast.appNameSubtitle', { name })
			);
		} catch (err) {
			onError?.(appStoreInstallErrorMessage(err, t));
		} finally {
			setBusy(false);
			setBusyAction(null);
		}
	}, [appId, detail, onInstall, onUninstall, onError, t]);

	const handleOpenInstalled = useCallback(() => {
		if (detail?.app_component && onOpenInstalledApp) {
			onOpenInstalledApp(detail.app_component);
		}
	}, [detail, onOpenInstalledApp]);

	const handleCopyDeepLink = useCallback(async () => {
		const ok = await copyAppStoreAppDeepLink(appId);
		if (ok) {
			toast.success(t('detail.linkCopied'));
			return;
		}
		toast.error(t('detail.copyLinkFailed'));
	}, [appId, t]);

	const defaultApp = DEFAULT_APPS.find((a) => a.id === appId);
	const defaultAppsMap = useMemo(
		() => new Map(DEFAULT_APPS.map((a) => [a.id, a.icon])),
		[]
	);
	const categoryLabel = useMemo(
		() => (detail ? categoryLabelFor(detail.category, t) : ''),
		[detail, t]
	);

	const detailCanUninstall = detail
		? (detail as StoreAppDetailResponse).can_uninstall
		: undefined;
	const cannotUninstall = Boolean(
		detail?.installed &&
			(detailCanUninstall === false ||
				(detailCanUninstall === undefined &&
					(appId === 'app-store' ||
						detail.is_system === true ||
						detail.is_factory === true)))
	);

	const uninstallBlockedTitle =
		appId === 'app-store'
			? t('uninstallBlocked.store')
			: detail?.is_system === true
				? t('uninstallBlocked.systemApp')
				: detail?.is_factory === true
					? t('uninstallBlocked.factoryApp')
					: t('uninstallBlocked.systemApp');

	const billingExempt = detail?.billing_exempt === true;
	const ewPrice = detail?.ew_monthly_price ?? 0;
	const trialDays = detail?.trial_duration_days ?? 0;
	const canInstall =
		!detail || !('can_install' in detail) || detail.can_install !== false;
	const inMaintenance = detail?.maintenance_mode === true;
	const allowInstall = canInstall && !inMaintenance;
	const maintenanceHint =
		detail?.maintenance_title?.trim() || t('maintenance.cannotInstall');

	const workspaceNames =
		detail && expansionState
			? expansionState.workspaceProfiles
					.filter((profile) => profile.appIds.includes(detail.app_id))
					.map((profile) => profile.name)
			: [];
	const collectionNames =
		detail && expansionState
			? expansionState.appCollections
					.filter((collection) => collection.appIds.includes(detail.app_id))
					.map((collection) => collection.name)
			: [];

	const isShortcutOnDesktop = Boolean(
		detail && appStoreDesktopShortcutIds?.includes(detail.app_id)
	);

	const { maxInstances: winMax, allowsMultipleInstances } = detail
		? getAppStoreWindowInstanceCap(detail)
		: { maxInstances: 1, allowsMultipleInstances: false };
	const windowsPolicyLabel = allowsMultipleInstances
		? t('detail.windowsPolicyMultiple', { count: winMax })
		: t('detail.windowsPolicySingle');
	const minWindowSize = detail
		? getDesktopWindowMinSizeForAppComponent(detail.app_component)
		: null;

	const installPrimaryLabel =
		detail && !detail.installed ? storeAppInstallCtaLabel(detail, t) : '';
	const billingCaption = detail ? storeAppBillingCaption(detail, t) : '';
	const heroGradient = detail
		? getStoreAppGradientBarClass(detail.gradient, detail.category)
		: '';
	const busyLabel =
		busyAction === 'uninstall'
			? t('inProgressUninstall')
			: t('inProgressInstall');

	return {
		t,
		detail,
		loading,
		busy,
		busyAction,
		loadError,
		fetchDetailFromApi,
		handleInstall,
		handleOpenInstalled,
		handleCopyDeepLink,
		showTechnicalDetails,
		defaultApp,
		defaultAppsMap,
		categoryLabel,
		cannotUninstall,
		uninstallBlockedTitle,
		billingExempt,
		ewPrice,
		trialDays,
		canInstall,
		inMaintenance,
		allowInstall,
		maintenanceHint,
		workspaceNames,
		collectionNames,
		isShortcutOnDesktop,
		winMax,
		allowsMultipleInstances,
		windowsPolicyLabel,
		minWindowSize,
		installPrimaryLabel,
		billingCaption,
		heroGradient,
		busyLabel,
		onOpenInstalledApp,
	};
}

export type AppStoreDetailController = ReturnType<
	typeof useAppStoreDetailController
>;
