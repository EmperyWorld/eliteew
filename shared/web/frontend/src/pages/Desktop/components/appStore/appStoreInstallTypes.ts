/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared install/uninstall types for App Store catalog flow.
 *
 * Invariants:
 * - Payload shape matches parent shell toast handlers.
 *
 * Related:
 * - useAppStoreInstallFlow.ts, AppStore.tsx
 */

export type AppStoreInstallAction = 'install' | 'uninstall';

export type AppStoreSuccessPayload = {
	action: AppStoreInstallAction;
	appId: string;
	appName: string;
	/** For «Open» toast after install */
	appComponent?: string;
};

export type AppStoreInstallStatus = {
	appId: string;
	action: AppStoreInstallAction;
} | null;

export type AppStoreInstallError = {
	appId: string;
	message: string;
} | null;

export type AppStoreInstallFeedback = {
	appId: string;
	action: AppStoreInstallAction;
} | null;

export type AppStoreCatalogCardInstallState = {
	busyHere: boolean;
	actionBusy: boolean;
	installingAction: AppStoreInstallAction | null;
	installErrorMessage: string | null;
	installFeedback: AppStoreInstallAction | null;
};
