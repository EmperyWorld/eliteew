/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders project team members with optional windowing for large rosters.
 *
 * Invariants:
 * - Virtual list only when count > threshold and no access panel is open.
 * - Opening access panel falls back to full stack so expanded editor layout is correct.
 *
 * Related:
 * - TeamSection.tsx, TeamMemberCard.tsx, constants.ts
 */
import { VirtualVariableList } from '@/components/shared/VirtualList';

import type { MarketingProjectMember } from '../marketingCabinetApi';
import {
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
	MARKETING_TEAM_MEMBER_ROW_ESTIMATE_PX,
} from '../constants';
import {
	TeamMemberCard,
	type TeamMemberCardContextProps,
} from './TeamMemberCard';

export function MarketingCabinetTeamMemberList({
	members,
	teamAccessMemberId,
	...cardContext
}: TeamMemberCardContextProps & {
	members: MarketingProjectMember[];
}) {
	const useVirtualList =
		members.length > MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD &&
		!teamAccessMemberId;

	const renderMember = (member: MarketingProjectMember) => (
		<TeamMemberCard
			member={member}
			teamAccessMemberId={teamAccessMemberId}
			{...cardContext}
		/>
	);

	if (useVirtualList) {
		return (
			<VirtualVariableList
				items={members}
				estimateSize={() => MARKETING_TEAM_MEMBER_ROW_ESTIMATE_PX}
				getItemKey={(index) => members[index]?.id ?? `team-member-${index}`}
				height={480}
				overscanCount={8}
				className="rounded-(--desktop-radius)"
				renderItem={(member) => (
					<div className="pb-2">{renderMember(member)}</div>
				)}
			/>
		);
	}

	return (
		<>
			{members.map((member) => (
				<div key={member.id}>{renderMember(member)}</div>
			))}
		</>
	);
}
