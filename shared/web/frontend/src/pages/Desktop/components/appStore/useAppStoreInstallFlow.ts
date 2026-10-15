/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Install/uninstall state and handlers for App Store catalog cards.
 *
 * Invariants:
 * - Only one global install/remove operation at a time (actionBusy).
 * - Errors are scoped per app_id for inline card retry UI.
 *
 * Related:
 * - AppStore.tsx, AppStoreInstallProgress.tsx, appStoreInstallError.ts
 */

import type { TFunction } from 'i18next';
import { useCallback, useEffect, useState } from 'react';
import type { StoreAppResponse } from '../../services/desktopApi';
import { appStoreInstallErrorMessage } from '../../utils/appStoreInstallError';
import type {
	AppStoreCatalogCardInstallState,
	AppStoreInstallAction,
	AppStoreInstallError,
	AppStoreInstallFeedback,
	AppStoreInstallStatus,
	AppStoreSuccessPayload,
} from './appStoreInstallTypes';

const INSTALL_FEEDBACK_MS = 2400;

export type UseAppStoreInstallFlowParams = {
	apps: StoreAppResponse[];
	onInstall: (appId: string) => Promise<void>;
	onUninstall: (appId: string) => Promise<void>;
	onError?: (message: string) => void;
	onSuccess?: (payload: AppStoreSuccessPayload) => void;
	t: TFunction<'appStore'>;
};

export type UseAppStoreInstallFlowResult = {
	handleInstall: (appId: string) => Promise<void>;
	clearInstallError: () => void;
	isBusy: boolean;
	installingId: string | null;
	installStatus: AppStoreInstallStatus;
	getCatalogCardInstallState: (
		appId: string
	) => AppStoreCatalogCardInstallState;
};

export function useAppStoreInstallFlow({
	apps,
	onInstall,
	onUninstall,
	onError,
	onSuccess,
	t,
}: UseAppStoreInstallFlowParams): UseAppStoreInstallFlowResult {
	const [installingId, setInstallingId] = useState<string | null>(null);
	const [installingAction, setInstallingAction] =
		useState<AppStoreInstallAction | null>(null);
	const [installStatus, setInstallStatus] =
		useState<AppStoreInstallStatus>(null);
	const [installError, setInstallError] = useState<AppStoreInstallError>(null);
	const [installFeedback, setInstallFeedback] =
		useState<AppStoreInstallFeedback>(null);

	const isBusy = installStatus !== null;

	const handleInstall = useCallback(
		async (appId: string) => {
			const app = apps?.find((a) => a.app_id === appId);
			if (!app) return;
			const action: AppStoreInstallAction = app.installed
				? 'uninstall'
				: 'install';
			setInstallError(null);
			setInstallStatus({ appId, action });
			setInstallingId(appId);
			setInstallingAction(action);
			try {
				if (app.installed) {
					await onUninstall(appId);
				} else {
					await onInstall(appId);
				}
				onSuccess?.({
					action,
					appId,
					appName: app.name,
					appComponent: app.app_component,
				});
				setInstallFeedback({ appId, action });
			} catch (err) {
				const message = appStoreInstallErrorMessage(err, t);
				setInstallError({ appId, message });
				onError?.(message);
			} finally {
				setInstallingId(null);
				setInstallingAction(null);
				setInstallStatus(null);
			}
		},
		[apps, onInstall, onUninstall, onError, onSuccess, t]
	);

	const clearInstallError = useCallback(() => {
		setInstallError(null);
	}, []);

	useEffect(() => {
		if (!installFeedback) return;
		const id = window.setTimeout(
			() => setInstallFeedback(null),
			INSTALL_FEEDBACK_MS
		);
		return () => window.clearTimeout(id);
	}, [installFeedback]);

	const getCatalogCardInstallState = useCallback(
		(appId: string): AppStoreCatalogCardInstallState => ({
			busyHere: installingId === appId,
			actionBusy: installingId !== null,
			installingAction,
			installErrorMessage:
				installError?.appId === appId ? installError.message : null,
			installFeedback:
				installFeedback?.appId === appId ? installFeedback.action : null,
		}),
		[installingId, installingAction, installError, installFeedback]
	);

	return {
		handleInstall,
		clearInstallError,
		isBusy,
		installingId,
		installStatus,
		getCatalogCardInstallState,
	};
}
