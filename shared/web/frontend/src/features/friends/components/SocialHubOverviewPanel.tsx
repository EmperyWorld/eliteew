/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy adapter around Social Hub home section for callers still using tab ids.
 *
 * Invariants:
 * - Maps legacy `onSelectTab` targets to home section navigation handlers.
 *
 * Related:
 * - ../social-hub/sections/SocialHubHomeSection.tsx
 */

import SocialHubHomeSection from '../social-hub/sections/SocialHubHomeSection';
export type SocialHubOverviewTargetTab =
	| 'inbox'
	| 'friends'
	| 'circles'
	| 'privacy'
	| 'mobile-app';

interface SocialHubOverviewPanelProps {
	onSelectTab: (tab: SocialHubOverviewTargetTab) => void;
	onOpenFriend?: (friendId: string) => void;
}

export default function SocialHubOverviewPanel({
	onSelectTab,
	onOpenFriend,
}: SocialHubOverviewPanelProps): JSX.Element {
	return (
		<SocialHubHomeSection
			onOpenPeople={(subview) => {
				if (subview === 'requests') {
					onSelectTab('inbox');
					return;
				}
				if (subview === 'lists') {
					onSelectTab('circles');
					return;
				}
				onSelectTab('friends');
			}}
			onOpenPrivacy={() => onSelectTab('privacy')}
			onOpenPhone={() => onSelectTab('mobile-app')}
			onOpenFriend={onOpenFriend}
		/>
	);
}
