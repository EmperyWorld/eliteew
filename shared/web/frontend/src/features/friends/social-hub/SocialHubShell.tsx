/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Social Hub shell: sidebar IA, product header, and section workspaces.
 *
 * Invariants:
 * - Legacy `socialHubTab` deep links map through `resolveLegacySocialHubTab`.
 * - Privacy and phone sections lazy-mount on first visit.
 * - `SocialHubApp` component name stays the desktop registry entry point.
 *
 * Related:
 * - ../components/SocialHubApp.tsx
 * - socialHubNavigation.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxStackIcon } from '@heroicons/react/24/outline';

import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';

import type { User as AppUser } from '@/services';
import type { NavigationHandler } from '@/types/navigation';
import type { WindowInitialPayload } from '@/pages/Desktop/types/desktop.types';
import {
	DesktopAppButton,
	DesktopAppContentWrapper,
	DesktopProductWorkspace,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopSurfaceLayout } from '@/pages/Desktop/hooks/useDesktopSurfaceLayout';
import { SOCIAL_HUB_INITIAL_TAB_KEY } from '@/pages/Desktop/utils/socialHubConstants';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import type { SocialHubActionTargetTab } from '../components/SocialHubActionInboxPanel';
import { useSocialHubOverviewStats } from './hooks/useSocialHubOverviewStats';
import { SocialHubSidebarNav } from './layout/SocialHubSidebarNav';
import { SocialHubMobileSegmentNav } from './layout/SocialHubMobileSegmentNav';
import { SocialHubLoadingPlaceholder } from './layout/SocialHubLoadingPlaceholder';
import {
	MOBILE_EMBEDDED_APP_ROOT_CLASS,
	MOBILE_EMBEDDED_CONTEXT_PILL_CLASS,
	MOBILE_EMBEDDED_MAIN_CLASS,
	MOBILE_EMBEDDED_PANEL_CLASS,
	MOBILE_EMBEDDED_REQUESTS_BANNER_CLASS,
} from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import {
	SH_CONTEXT_PILL_CLASS,
	SH_CONTEXT_PILL_DOT_CLASS,
	SH_SHELL_BODY_CLASS,
	SH_SHELL_BODY_COMPACT_CLASS,
	SH_SHELL_SIDEBAR_PANEL_CLASS,
	SH_SIDEBAR_WIDTH_CLASS,
	SH_SIDEBAR_WIDTH_COMPACT_CLASS,
	SH_WORKSPACE_MAIN_CLASS,
	SH_WORKSPACE_PANEL_CLASS,
} from './layout/socialHubLayoutTokens';
import type { SocialHubPeopleSubview } from './socialHubNavigation';
import {
	defaultSocialHubNavigation,
	resolveLegacySocialHubTab,
	sectionOpensPhone,
	sectionOpensPrivacy,
	type SocialHubNavigationState,
	type SocialHubSection,
} from './socialHubNavigation';
import SocialHubHomeSection from './sections/SocialHubHomeSection';
import SocialHubPeopleSection from './sections/SocialHubPeopleSection';
import SocialHubPhoneSection from './sections/SocialHubPhoneSection';
import SocialHubPrivacySection from './sections/SocialHubPrivacySection';
import {
	SOCIAL_HUB_GUIDE_AUDIO_LS_KEY,
	SOCIAL_HUB_GUIDE_ROOT_ID,
	SOCIAL_HUB_GUIDE_SECTION_BY_STEP,
	SOCIAL_HUB_GUIDE_STEP_DEFS,
	SOCIAL_HUB_GUIDE_TOUR_FOLDER,
} from './socialHubGuideConstants';

export interface SocialHubShellProps {
	onNavigate?: NavigationHandler;
	onUserUpdate?: (user: AppUser) => void;
	initialPayload?: WindowInitialPayload;
	/** MobileAndroid WebView `#/mobile-social-hub` — compact layout, hide desktop chrome. */
	embeddedMobile?: boolean;
}

const SECTION_LABEL_KEYS: Record<SocialHubSection, string> = {
	home: 'friends.socialHubSectionHome',
	people: 'friends.socialHubSectionPeople',
	privacy: 'friends.socialHubSectionPrivacy',
	phone: 'friends.socialHubSectionPhone',
};

function applyNavigation(
	setNav: (value: SocialHubNavigationState) => void,
	next: SocialHubNavigationState
): void {
	setNav(next);
}

export default function SocialHubShell({
	onNavigate,
	onUserUpdate,
	initialPayload,
	embeddedMobile = false,
}: SocialHubShellProps): JSX.Element {
	const { t } = useTranslation('contentManager');
	const guideLabels = useMemo(
		() => guideTourLabelsFromI18n(t, 'friends.socialHubGuide'),
		[t]
	);
	const guideSteps = useBuiltGuideSteps(
		t,
		'friends.socialHubGuide.steps',
		SOCIAL_HUB_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = useState(false);
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour, { enabled: !embeddedMobile });
	const { surfaceRef, isCompact: surfaceCompact } = useDesktopSurfaceLayout({
		compactWidth: 940,
		compactHeight: 700,
		denseWidth: 1120,
		denseHeight: 780,
	});
	const isCompact = embeddedMobile || surfaceCompact;
	const [nav, setNav] = useState<SocialHubNavigationState>(
		defaultSocialHubNavigation
	);
	const [privacyEverOpened, setPrivacyEverOpened] = useState(false);
	const [phoneEverOpened, setPhoneEverOpened] = useState(false);
	const { incomingPending } = useSocialHubOverviewStats(true);

	const initialFriendUserId =
		typeof initialPayload?.socialHubFriendUserId === 'string'
			? initialPayload.socialHubFriendUserId.trim() || null
			: null;
	const [focusedFriendUserId, setFocusedFriendUserId] = useState<string | null>(
		initialFriendUserId
	);

	useEffect(() => {
		try {
			const hint = sessionStorage.getItem(SOCIAL_HUB_INITIAL_TAB_KEY);
			const resolved = resolveLegacySocialHubTab(hint);
			if (resolved) {
				setNav(resolved);
				if (sectionOpensPrivacy(resolved.section)) {
					setPrivacyEverOpened(true);
				}
				if (sectionOpensPhone(resolved.section)) {
					setPhoneEverOpened(true);
				}
				sessionStorage.removeItem(SOCIAL_HUB_INITIAL_TAB_KEY);
			}
		} catch {
			// ignore
		}
	}, []);

	useEffect(() => {
		const resolved = resolveLegacySocialHubTab(initialPayload?.socialHubTab);
		if (resolved) {
			setNav(resolved);
			if (sectionOpensPrivacy(resolved.section)) {
				setPrivacyEverOpened(true);
			}
			if (sectionOpensPhone(resolved.section)) {
				setPhoneEverOpened(true);
			}
			return;
		}
		if (initialFriendUserId) {
			setFocusedFriendUserId(initialFriendUserId);
			setNav({ section: 'people', peopleSubview: 'contacts' });
		}
	}, [initialFriendUserId, initialPayload?.socialHubTab]);

	useEffect(() => {
		if (sectionOpensPrivacy(nav.section)) {
			setPrivacyEverOpened(true);
		}
		if (sectionOpensPhone(nav.section)) {
			setPhoneEverOpened(true);
		}
	}, [nav.section]);

	const sidebarItems = useMemo(
		() => [
			{
				id: 'home' as const,
				label: t(SECTION_LABEL_KEYS.home),
			},
			{
				id: 'people' as const,
				label: t(SECTION_LABEL_KEYS.people),
				badgeCount: incomingPending > 0 ? incomingPending : undefined,
			},
			{
				id: 'privacy' as const,
				label: t(SECTION_LABEL_KEYS.privacy),
			},
			{
				id: 'phone' as const,
				label: t(SECTION_LABEL_KEYS.phone),
			},
		],
		[incomingPending, t]
	);

	const openPeople = useCallback((subview: SocialHubPeopleSubview) => {
		setNav({ section: 'people', peopleSubview: subview });
	}, []);

	const openPrivacy = useCallback(() => {
		setNav({ section: 'privacy', peopleSubview: 'contacts' });
	}, []);

	const openPhone = useCallback(() => {
		setNav({ section: 'phone', peopleSubview: 'contacts' });
	}, []);

	const handleInboxTarget = useCallback(
		(targetTab: SocialHubActionTargetTab, targetId?: string | null) => {
			const resolved = resolveLegacySocialHubTab(targetTab);
			if (!resolved) {
				return;
			}
			if (targetId && targetTab === 'friends') {
				setFocusedFriendUserId(targetId);
			}
			setNav(resolved);
		},
		[]
	);

	const openFriendFromHome = useCallback((friendId: string) => {
		setFocusedFriendUserId(friendId);
		setNav({ section: 'people', peopleSubview: 'contacts' });
	}, []);

	const peopleSubviewLabel = (subview: SocialHubPeopleSubview): string => {
		if (subview === 'contacts') {
			return t('friends.socialHubPeopleSubviewContacts');
		}
		if (subview === 'lists') {
			return t('friends.socialHubPeopleSubviewLists');
		}
		return t('friends.socialHubPeopleSubviewRequests');
	};

	const sectionContextLabel =
		nav.section === 'people'
			? t('friends.socialHubPeopleContext', {
					section: t(SECTION_LABEL_KEYS.people),
					subview: peopleSubviewLabel(nav.peopleSubview),
				})
			: null;

	const prepareGuideStep = useCallback(
		(stepId: string) => {
			const section = SOCIAL_HUB_GUIDE_SECTION_BY_STEP[stepId];
			if (!section) return;
			if (section === 'privacy') {
				setPrivacyEverOpened(true);
			}
			if (section === 'phone') {
				setPhoneEverOpened(true);
			}
			setNav({
				section,
				peopleSubview: section === 'people' ? nav.peopleSubview : 'contacts',
			});
		},
		[nav.peopleSubview]
	);

	const guideSpotlightLayoutKey = `${nav.section}-${guideOpen}`;

	const renderSectionWorkspace = (): JSX.Element => (
		<>
			{nav.section === 'home' ? (
				<SocialHubHomeSection
					embeddedMobile={embeddedMobile}
					onOpenPeople={openPeople}
					onOpenPrivacy={openPrivacy}
					onOpenPhone={openPhone}
					onOpenFriend={openFriendFromHome}
				/>
			) : null}
			{nav.section === 'people' ? (
				<SocialHubPeopleSection
					activeSubview={nav.peopleSubview}
					embeddedMobile={embeddedMobile}
					onChangeSubview={(peopleSubview) =>
						setNav({ section: 'people', peopleSubview })
					}
					focusedFriendUserId={focusedFriendUserId}
					onNavigateFromInbox={handleInboxTarget}
				/>
			) : null}
			{nav.section === 'privacy' ? (
				privacyEverOpened ? (
					<SocialHubPrivacySection
						embeddedMobile={embeddedMobile}
						onNavigate={onNavigate}
						onUserUpdate={onUserUpdate}
					/>
				) : (
					<SocialHubLoadingPlaceholder />
				)
			) : null}
			{nav.section === 'phone' ? (
				phoneEverOpened ? (
					<SocialHubPhoneSection />
				) : (
					<SocialHubLoadingPlaceholder minHeightClass="min-h-[280px]" />
				)
			) : null}
		</>
	);

	if (embeddedMobile) {
		return (
			<DesktopAppContentWrapper appComponent="SocialHubApp" className="h-full">
				<div
					id={SOCIAL_HUB_GUIDE_ROOT_ID}
					ref={surfaceRef}
					className={MOBILE_EMBEDDED_APP_ROOT_CLASS}
					data-social-hub-root="1"
					data-embedded-mobile="1"
				>
					<h1 className="sr-only">{t('friends.socialHubProductTitle')}</h1>
					{incomingPending > 0 ? (
						<div className={MOBILE_EMBEDDED_REQUESTS_BANNER_CLASS}>
							<p className="min-w-0 flex-1 text-sm font-medium text-(--desktop-text-primary)">
								{t('friends.socialHubHeaderOpenRequests', {
									count: incomingPending,
								})}
							</p>
							<DesktopAppButton
								type="button"
								size="sm"
								variant="accent"
								onClick={() => openPeople('requests')}
							>
								<InboxStackIcon
									className={DESKTOP_LUCIDE.sm}
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								{t('friends.socialHubOverviewOpenInbox')}
							</DesktopAppButton>
						</div>
					) : null}

					<SocialHubMobileSegmentNav
						activeSection={nav.section}
						navItems={sidebarItems}
						ariaLabel={t('friends.socialHubNavLabel')}
						onSelectSection={(section) =>
							applyNavigation(setNav, {
								section,
								peopleSubview:
									section === 'people' ? nav.peopleSubview : 'contacts',
							})
						}
					/>

					{sectionContextLabel ? (
						<p className={MOBILE_EMBEDDED_CONTEXT_PILL_CLASS}>
							<span
								aria-hidden
								className="h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--desktop-accent-rgb))]/70"
							/>
							<span className="truncate">{sectionContextLabel}</span>
						</p>
					) : null}

					<main className={MOBILE_EMBEDDED_MAIN_CLASS}>
						<div className={MOBILE_EMBEDDED_PANEL_CLASS}>
							{renderSectionWorkspace()}
						</div>
					</main>
				</div>
			</DesktopAppContentWrapper>
		);
	}

	return (
		<DesktopAppContentWrapper appComponent="SocialHubApp" className="h-full">
			<DesktopProductWorkspace
				id={SOCIAL_HUB_GUIDE_ROOT_ID}
				ref={surfaceRef}
				className={cn(
					'flex h-full min-h-0 flex-col overflow-hidden bg-transparent p-3 text-(--desktop-text-primary) antialiased'
				)}
				contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
			>
				<h1 className="sr-only">{t('friends.socialHubProductTitle')}</h1>
				<div
					className={
						isCompact ? SH_SHELL_BODY_COMPACT_CLASS : SH_SHELL_BODY_CLASS
					}
				>
					<div
						className={cn(
							SH_SHELL_SIDEBAR_PANEL_CLASS,
							isCompact
								? SH_SIDEBAR_WIDTH_COMPACT_CLASS
								: SH_SIDEBAR_WIDTH_CLASS
						)}
						data-sh-guide="sidebar"
					>
						<SocialHubSidebarNav
							activeSection={nav.section}
							navItems={sidebarItems}
							navLabel={t('friends.socialHubNavLabel')}
							compact={isCompact}
							onSelectSection={(section) =>
								applyNavigation(setNav, {
									section,
									peopleSubview:
										section === 'people' ? nav.peopleSubview : 'contacts',
								})
							}
						/>
					</div>

					<main className={SH_WORKSPACE_MAIN_CLASS}>
						<div className={SH_WORKSPACE_PANEL_CLASS} data-sh-guide="workspace">
							{sectionContextLabel ? (
								<p className={SH_CONTEXT_PILL_CLASS}>
									<span aria-hidden className={SH_CONTEXT_PILL_DOT_CLASS} />
									<span className="truncate">{sectionContextLabel}</span>
								</p>
							) : null}
							{renderSectionWorkspace()}
						</div>
					</main>
				</div>
				<SpotlightGuideModal
					open={guideOpen}
					onClose={() => setGuideOpen(false)}
					rootId={SOCIAL_HUB_GUIDE_ROOT_ID}
					steps={guideSteps}
					audioLocalStorageKey={SOCIAL_HUB_GUIDE_AUDIO_LS_KEY}
					tourAudioFolder={SOCIAL_HUB_GUIDE_TOUR_FOLDER}
					labels={guideLabels}
					onPrepareStep={prepareGuideStep}
					spotlightLayoutKey={guideSpotlightLayoutKey}
					dialogTitleId="social-hub-guide-title"
				/>
			</DesktopProductWorkspace>
		</DesktopAppContentWrapper>
	);
}
