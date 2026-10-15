/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable catalog card renderer callback for App Store grid sections.
 *
 * Invariants:
 * - Install UX props come from useAppStoreInstallFlow; card component stays memoized.
 *
 * Related:
 * - AppStoreCatalogSections.tsx, AppStoreCatalogCard.tsx, useAppStoreInstallFlow.ts
 */

import type { TFunction } from 'i18next';
import { useCallback, type ReactElement, type ReactNode } from 'react';
import type { DesktopIconStyle } from '@/types/profile';
import type { StoreAppResponse } from '../../services/desktopApi';
import type { DesktopExpansionDiscoveryState } from '../../types/desktopExpansion.types';
import { AppStoreCatalogCard } from '../AppStoreCatalogCard';
import { categoryLabel } from './appStoreCategories';
import type { AppStoreCatalogCardInstallState } from './appStoreInstallTypes';

export type UseAppStoreCatalogCardRendererParams = {
	defaultIconsMap: Map<string, ReactNode>;
	getCatalogCardInstallState: (
		appId: string
	) => AppStoreCatalogCardInstallState;
	expansionState?: DesktopExpansionDiscoveryState;
	t: TFunction<'appStore'>;
	debouncedSearch: string;
	iconStyle: DesktopIconStyle;
	storeCardShellClass: string;
	reduceMotion: boolean;
	handleAppNavigate: (appId: string) => void;
	handleInstall: (appId: string) => Promise<void>;
	onOpenInstalledApp?: (appComponent: string) => void;
	clearInstallError: () => void;
};

export function useAppStoreCatalogCardRenderer({
	defaultIconsMap,
	getCatalogCardInstallState,
	expansionState,
	t,
	debouncedSearch,
	iconStyle,
	storeCardShellClass,
	reduceMotion,
	handleAppNavigate,
	handleInstall,
	onOpenInstalledApp,
	clearInstallError,
}: UseAppStoreCatalogCardRendererParams): (
	app: StoreAppResponse
) => ReactElement {
	return useCallback(
		(app: StoreAppResponse) => {
			const defaultIcon = defaultIconsMap.get(app.app_id);
			const {
				busyHere,
				actionBusy,
				installingAction,
				installErrorMessage: installErrMsg,
				installFeedback: feedbackAction,
			} = getCatalogCardInstallState(app.app_id);
			const catLabel = categoryLabel(app.category, t);
			const workspaceNames =
				expansionState?.workspaceProfiles
					.filter((profile) => profile.appIds.includes(app.app_id))
					.map((profile) => profile.name) ?? [];
			const collectionNames =
				expansionState?.appCollections
					.filter((collection) => collection.appIds.includes(app.app_id))
					.map((collection) => collection.name) ?? [];

			return (
				<AppStoreCatalogCard
					key={app.app_id}
					app={app}
					defaultIcon={defaultIcon}
					categoryLabel={catLabel}
					debouncedSearch={debouncedSearch}
					iconStyle={iconStyle}
					storeCardShellClass={storeCardShellClass}
					reduceMotion={reduceMotion}
					onAppClick={handleAppNavigate}
					onInstall={handleInstall}
					onOpenInstalledApp={onOpenInstalledApp}
					onClearInstallError={clearInstallError}
					busyHere={busyHere}
					actionBusy={actionBusy}
					installingAction={installingAction}
					installErrorMessage={installErrMsg}
					installFeedback={feedbackAction}
					workspaceNames={workspaceNames}
					collectionNames={collectionNames}
				/>
			);
		},
		[
			defaultIconsMap,
			getCatalogCardInstallState,
			expansionState,
			t,
			debouncedSearch,
			iconStyle,
			storeCardShellClass,
			reduceMotion,
			handleAppNavigate,
			handleInstall,
			onOpenInstalledApp,
			clearInstallError,
		]
	);
}
