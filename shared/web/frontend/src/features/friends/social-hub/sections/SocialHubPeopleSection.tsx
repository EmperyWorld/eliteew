/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Social Hub people workspace: contacts, lists, and requests sub-views.
 *
 * Invariants:
 * - Directory queries pause when the requests sub-view is active.
 * - Inbox panel uses the same action-target mapping as the legacy Social Hub shell.
 *
 * Related:
 * - SocialHubShell.tsx
 * - ../layout/SocialHubPeopleSubnav.tsx
 */

import { DesktopAppPanel } from '@/pages/Desktop/components/DesktopAppChrome';

import FriendsApp from '../../components/FriendsApp';
import SocialHubActionInboxPanel, {
	type SocialHubActionTargetTab,
} from '../../components/SocialHubActionInboxPanel';
import { useSocialHubOverviewStats } from '../hooks/useSocialHubOverviewStats';
import { SocialHubPeopleSubnav } from '../layout/SocialHubPeopleSubnav';
import {
	peopleDataActive,
	peopleDirectorySection,
	type SocialHubPeopleSubview,
} from '../socialHubNavigation';
import { SH_SECTION_STACK_CLASS } from '../layout/socialHubLayoutTokens';

interface SocialHubPeopleSectionProps {
	activeSubview: SocialHubPeopleSubview;
	embeddedMobile?: boolean;
	onChangeSubview: (subview: SocialHubPeopleSubview) => void;
	focusedFriendUserId: string | null;
	onNavigateFromInbox: (
		tab: SocialHubActionTargetTab,
		targetId?: string | null
	) => void;
}

export default function SocialHubPeopleSection({
	activeSubview,
	embeddedMobile = false,
	onChangeSubview,
	focusedFriendUserId,
	onNavigateFromInbox,
}: SocialHubPeopleSectionProps): JSX.Element {
	const { incomingPending, friendsCount, circles } = useSocialHubOverviewStats(
		activeSubview !== 'requests'
	);

	return (
		<div className={SH_SECTION_STACK_CLASS}>
			<SocialHubPeopleSubnav
				activeSubview={activeSubview}
				onChangeSubview={onChangeSubview}
				incomingPending={incomingPending}
				contactsCount={friendsCount}
				listsCount={circles.length}
			/>

			{activeSubview === 'requests' ? (
				<SocialHubActionInboxPanel
					embeddedMobileLayout={embeddedMobile}
					onSelectTarget={onNavigateFromInbox}
				/>
			) : (
				<DesktopAppPanel className="min-h-0 border-0 bg-transparent p-0 shadow-none">
					<FriendsApp
						hubMode
						friendsDataActive={peopleDataActive('people', activeSubview)}
						initialDirectorySection={peopleDirectorySection(activeSubview)}
						initialFriendUserId={focusedFriendUserId}
					/>
				</DesktopAppPanel>
			)}
		</div>
	);
}
