/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve a Desktop `app_component` to window content (Gen/Forge Wave F1 mount
 * implementations). Catalog of ids: `appMounts.registry.ts`.
 *
 * Invariants:
 * - Restricted apps (e.g. UnifiedAdminApp) mount behind DesktopShellRestrictedAppGate.
 * - Deep-link payload mapping stays in mount adapters or inline only when trivial.
 * - Ids handled here must stay listed in APP_MOUNTED_COMPONENTS.
 *
 * Related:
 * - shell/appMounts.registry.ts
 * - components/desktopWindowAppContent/lazyImports.ts
 * - components/desktopWindowAppContent/mounts.tsx
 */

import * as React from 'react';
import i18n from '@/i18n/config';
import type { DesktopAppPropsContextValue } from '../context/DesktopAppPropsContext';
import type { WindowState } from '../types/desktop.types';
import { requestOpenDesktopApp } from '../utils/desktopDeepLink';
import { resolveDocEditorPayloadTarget } from '../utils/desktopOpenPayloads';
import {
	DesktopAppContentWrapper,
	DesktopAppEmptyState,
} from '../components/DesktopAppChrome';
import { DesktopAppMaintenance } from '../components/DesktopAppMaintenance';
import { DesktopShellRestrictedAppGate } from '../components/DesktopShellRestrictedAppGate';
import {
	AppStoreWindowContentLazy,
	AssistantAppLazy,
	ClipboardManagerLazy,
	CustomerCabinetPageLazy,
	DesktopDashboardFavoritesAppLazy,
	DesktopShellSettingsWindowContentLazy,
	DesktopWidgetShelfAppLazy,
	DocEditorV2Lazy,
	EmperyNexusChronicleAppLazy,
	EBrowserAppLazy,
	EwaAppLazy,
	FeedbackHubAppLazy,
	ImageStudioPageLazy,
	KirsClientSitePageLazy,
	KirsPageLazy,
	LocalServiceIframeAppLazy,
	MarketingCabinetPageLazy,
	MusicForgeAppLazy,
	MusicPlayerPageLazy,
	NotificationsDesktopAppLazy,
	CalendarAppLazy,
	PoemmaAppLazy,
	ProfessionalWorldsAppLazy,
	KursorinaAppLazy,
	ProjectAboutAppLazy,
	SiteManagerOpsPanelLazy,
	SocialHubAppLazy,
	StudioGUPageLazy,
	SurveyHubAppLazy,
	UGSDesktopContainerLazy,
	UltimateDocEditor,
	UnifiedAdminPageLazy,
	VideoStudioPageLazy,
} from '../components/desktopWindowAppContent/lazyImports';
import {
	ContentManagerDesktopMount,
	DesktopAiChatAppDesktopMount,
	EWDeskDesktopMount,
	EwrpDesktopMount,
	GAFChatAppDesktopMount,
	UserSiteStudioDesktopMount,
	VideoCallAppDesktopMount,
} from '../components/desktopWindowAppContent/mounts';
import type { DesktopWindowAppCallbacks } from '../components/desktopWindowAppContent/types';

export function resolveAppMount(
	resolved: string,
	appProps?: DesktopAppPropsContextValue | null,
	windowState?: WindowState,
	windowCallbacks?: DesktopWindowAppCallbacks
): React.ReactElement | React.ComponentType {
	switch (resolved) {
		case 'ContentManagerPro':
			return (
				<ContentManagerDesktopMount
					initialPayload={windowState?.initialPayload}
					onUpdatePayload={windowCallbacks?.onUpdatePayload}
				/>
			);
		case 'UGS': {
			const initialView = windowState?.initialPayload?.ugsView ?? 'dashboard';
			return appProps?.onNavigate
				? React.createElement(UGSDesktopContainerLazy, {
						onNavigate: appProps.onNavigate,
						initialView,
					})
				: React.createElement(UGSDesktopContainerLazy, {
						initialView,
					});
		}
		case 'UGSHubApp': {
			const initialView = windowState?.initialPayload?.ugsView ?? 'hub';
			return appProps?.onNavigate
				? React.createElement(UGSDesktopContainerLazy, {
						onNavigate: appProps.onNavigate,
						initialView,
					})
				: React.createElement(UGSDesktopContainerLazy, {
						initialView,
					});
		}
		case 'Presentations':
		case 'PresentationsArchive':
		case 'EWRP':
			return (
				<EwrpDesktopMount
					onUpdatePayload={windowCallbacks?.onUpdatePayload}
					initialPayload={windowState?.initialPayload}
				/>
			);
		case 'StudioGU':
			return StudioGUPageLazy;
		case 'MusicGenerator':
		case 'MusicEvolutionApp':
			return React.createElement(MusicForgeAppLazy, {
				embedded: true,
				initialRunId:
					typeof windowState?.initialPayload?.musicForgeRunId === 'string'
						? windowState.initialPayload.musicForgeRunId
						: null,
			});
		case 'MusicForgeApp':
			return React.createElement(MusicForgeAppLazy, {
				embedded: true,
				initialRunId:
					typeof windowState?.initialPayload?.musicForgeRunId === 'string'
						? windowState.initialPayload.musicForgeRunId
						: null,
			});
		case 'PoemmaApp':
			return PoemmaAppLazy;
		case 'ProjectAboutApp':
			// App owns DesktopAppContentWrapper (avoid double chrome nesting).
			return ProjectAboutAppLazy;
		case 'EBrowserApp':
			return EBrowserAppLazy;
		case 'KursorinaApp':
			return KursorinaAppLazy;
		case 'EmperyNexusChronicleApp':
			return (
				<DesktopAppContentWrapper
					appComponent="EmperyNexusChronicleApp"
					windowStyle={windowCallbacks?.visualStyle}
					mode="passthrough"
					className="h-full min-h-0 overflow-hidden"
				>
					<EmperyNexusChronicleAppLazy />
				</DesktopAppContentWrapper>
			);
		case 'ImageStudio':
			return React.createElement(ImageStudioPageLazy, {
				embedded: true,
				onWindowPayloadChange: windowCallbacks?.onUpdatePayload,
			});
		case 'VideoStudio':
			return React.createElement(VideoStudioPageLazy, {
				embedded: true,
				onWindowPayloadChange: windowCallbacks?.onUpdatePayload,
			});
		case 'MusicPlayer':
			return React.createElement(MusicPlayerPageLazy, {
				embedded: true,
				onWindowPayloadChange: windowCallbacks?.onUpdatePayload,
			});
		case 'NotificationsApp':
			return (
				<NotificationsDesktopAppLazy
					onRequestClose={windowCallbacks?.onClose}
				/>
			);
		case 'CalendarApp':
			return CalendarAppLazy;
		case 'DesktopWidgetShelfApp':
			return (
				<DesktopWidgetShelfAppLazy
					initialTab={
						windowState?.initialPayload?.widgetShelfTab === 'todos'
							? 'todos'
							: 'notes'
					}
				/>
			);
		case 'DesktopDashboardFavoritesApp':
			return <DesktopDashboardFavoritesAppLazy />;
		case 'EWDeskApp':
			return (
				<EWDeskDesktopMount initialPayload={windowState?.initialPayload} />
			);
		case 'FeedbackHubApp':
			return React.createElement(FeedbackHubAppLazy, {
				initialQuickMode: windowState?.initialPayload?.feedbackQuickMode,
				initialDraftBody: windowState?.initialPayload?.feedbackDraftBody,
			});
		case 'SurveyHubApp':
			return React.createElement(SurveyHubAppLazy, {
				initialSurveyId: windowState?.initialPayload?.surveyId,
			});
		case 'AssistantApp':
			return AssistantAppLazy;
		case 'ProfessionalWorlds':
			return ProfessionalWorldsAppLazy;
		case 'DocEditor': {
			const docEditorTarget = resolveDocEditorPayloadTarget(
				windowState?.initialPayload
			);
			const docEditorDocumentId =
				docEditorTarget?.targetType === 'docEditor'
					? docEditorTarget.id
					: windowState?.initialPayload?.documentId;
			const docEditorUnifiedContentId =
				docEditorTarget?.targetType === 'unifiedContent'
					? docEditorTarget.id
					: windowState?.initialPayload?.unifiedContentId;
			const docEditorRequestId =
				docEditorTarget?.requestId ??
				windowState?.initialPayload?.docOpenRequestId;
			return (
				<UltimateDocEditor
					mode="edit"
					embedded
					documentId={docEditorDocumentId}
					documentIds={windowState?.initialPayload?.documentIds}
					activeDocumentId={windowState?.initialPayload?.activeDocumentId}
					tabTitles={windowState?.initialPayload?.tabTitles}
					unifiedContentId={docEditorUnifiedContentId}
					docEditorTabs={windowState?.initialPayload?.docEditorTabs}
					activeDocEditorTab={windowState?.initialPayload?.activeDocEditorTab}
					docOpenRequestId={docEditorRequestId}
					openCollabAfterLoad={
						windowState?.initialPayload?.openCollabPanel === true
					}
					autoJoinCollaborationAfterLoad={
						windowState?.initialPayload?.autoJoinCollaboration === true
					}
					onClose={windowCallbacks?.onClose}
					onPayloadChange={windowCallbacks?.onUpdatePayload}
				/>
			);
		}
		case 'DocEditorV2':
			return (
				<DocEditorV2Lazy
					initialDocumentId={windowState?.initialPayload?.documentId}
					initialUnifiedContentId={
						windowState?.initialPayload?.unifiedContentId
					}
					initialTitle={
						typeof windowState?.initialPayload?.docEditorTitle === 'string'
							? windowState.initialPayload.docEditorTitle
							: windowState?.initialPayload?.activeDocumentId
								? windowState.initialPayload.tabTitles?.[
										windowState.initialPayload.activeDocumentId
									]
								: undefined
					}
					onFallbackToLegacy={
						windowState?.initialPayload?.documentId ||
						windowState?.initialPayload?.unifiedContentId
							? () => {
									requestOpenDesktopApp({
										appComponent: 'DocEditor',
										forceNewWindow: true,
										...(windowState?.initialPayload?.documentId
											? {
													documentId: windowState.initialPayload.documentId,
												}
											: {}),
										...(windowState?.initialPayload?.unifiedContentId
											? {
													unifiedContentId:
														windowState.initialPayload.unifiedContentId,
												}
											: {}),
									});
								}
							: undefined
					}
				/>
			);
		case 'ClipboardManager':
			return <ClipboardManagerLazy embedded />;
		case 'GAFChatApp':
			return (
				<GAFChatAppDesktopMount initialPayload={windowState?.initialPayload} />
			);
		case 'VideoCallApp':
			return (
				<VideoCallAppDesktopMount
					initialPayload={windowState?.initialPayload}
				/>
			);
		case 'DesktopAiChatApp':
			return (
				<DesktopAiChatAppDesktopMount
					initialPayload={windowState?.initialPayload}
				/>
			);
		case 'SocialHubApp':
		case 'FriendsApp':
		case 'UserProfile':
			return appProps
				? React.createElement(SocialHubAppLazy, {
						onNavigate: appProps.onNavigate,
						onUserUpdate: appProps.onUserUpdate,
						initialPayload: windowState?.initialPayload,
					})
				: SocialHubAppLazy;
		case 'AppStore':
			return AppStoreWindowContentLazy;
		case 'DesktopShellSettings':
			return (
				<DesktopAppContentWrapper
					appComponent="DesktopShellSettings"
					windowStyle={windowCallbacks?.visualStyle}
					mode="passthrough"
					className="h-full min-h-0 overflow-hidden"
				>
					<DesktopShellSettingsWindowContentLazy
						onRequestClose={windowCallbacks?.onClose}
					/>
				</DesktopAppContentWrapper>
			);
		case 'DesktopAppMaintenance':
			return (
				<DesktopAppMaintenance initialPayload={windowState?.initialPayload} />
			);
		case 'UnifiedAdminApp':
			return (
				<DesktopAppContentWrapper
					appComponent="UnifiedAdminApp"
					windowStyle={windowCallbacks?.visualStyle}
					mode="passthrough"
					className="h-full min-h-0 overflow-hidden"
				>
					<DesktopShellRestrictedAppGate
						appComponent="UnifiedAdminApp"
						onRequestClose={windowCallbacks?.onClose}
					>
						<UnifiedAdminPageLazy
							embedded
							onNavigate={appProps?.onNavigate}
							onRequestClose={windowCallbacks?.onClose}
						/>
					</DesktopShellRestrictedAppGate>
				</DesktopAppContentWrapper>
			);
		case 'MarketingCabinet':
			return React.createElement(MarketingCabinetPageLazy, {
				desktopConsumedMarketingDeepLink:
					windowState?.initialPayload?.marketingCabinetDeepLink ?? undefined,
			});
		case 'EwaApp':
			return (
				<DesktopAppContentWrapper
					appComponent="EwaApp"
					windowStyle={windowCallbacks?.visualStyle}
					mode="passthrough"
					className="h-full min-h-0 overflow-hidden"
				>
					<EwaAppLazy
						initialPayload={windowState?.initialPayload}
						onWindowPayloadChange={windowCallbacks?.onUpdatePayload}
						openedFromSessionRestore={
							windowState?.openedFromSessionRestore === true
						}
					/>
				</DesktopAppContentWrapper>
			);
		case 'CustomerCabinet':
			return CustomerCabinetPageLazy;
		case 'UserSiteStudio':
			return (
				<UserSiteStudioDesktopMount
					initialPayload={windowState?.initialPayload}
				/>
			);
		case 'SiteManagerOps':
			return (
				<DesktopAppContentWrapper
					appComponent="SiteManagerOps"
					windowStyle={windowCallbacks?.visualStyle}
					mode="passthrough"
					className="h-full min-h-0 overflow-hidden"
				>
					<SiteManagerOpsPanelLazy />
				</DesktopAppContentWrapper>
			);
		case 'LocalServiceIframeApp':
			return (
				<DesktopAppContentWrapper
					appComponent="LocalServiceIframeApp"
					windowStyle={windowCallbacks?.visualStyle}
					mode="passthrough"
					className="h-full min-h-0 overflow-hidden"
				>
					<LocalServiceIframeAppLazy />
				</DesktopAppContentWrapper>
			);
		case 'KirsCuration':
			return KirsPageLazy;
		case 'KirsClientSite':
			return React.createElement(KirsClientSitePageLazy);
		default:
			return (
				<DesktopAppContentWrapper
					appComponent={resolved}
					windowStyle={windowCallbacks?.visualStyle}
				>
					<DesktopAppEmptyState
						className="h-full"
						title={i18n.t('windowChrome.appNotFound', { ns: 'desktopUi' })}
						description={i18n.t('windowChrome.appNotRegisteredDescription', {
							ns: 'desktopUi',
						})}
					/>
				</DesktopAppContentWrapper>
			);
	}
}
