/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public card contracts and internal tab identifiers for the Social Hub friend card.
 *
 * Invariants:
 * - Public FriendPersonCard props stay stable while tab implementation is split.
 *
 * Related:
 * - ../FriendPersonCard.tsx
 * ---
 */

import type { FriendCircle, FriendProfile } from '../../types';

export type FriendCardTab =
	| 'overview'
	| 'notes'
	| 'shared'
	| 'privacy'
	| 'timeline';

export type FriendReportPayload = {
	reason: string;
	details?: string | null;
};

export interface FriendPersonCardProps {
	friend: FriendProfile | null;
	loading?: boolean;
	saving?: boolean;
	availableCircles?: FriendCircle[];
	onClose?: () => void;
	onOpenChat?: (friend: FriendProfile) => void;
	onToggleFavorite?: (friend: FriendProfile) => void;
	onToggleMute?: (friend: FriendProfile) => void;
	onToggleBlock?: (friend: FriendProfile) => void;
	onToggleShareActivity?: (friend: FriendProfile) => void;
	onToggleCircle?: (friend: FriendProfile, circleId: string) => void;
	onSaveNote?: (friend: FriendProfile, note: string) => void;
	onReport?: (friend: FriendProfile, payload: FriendReportPayload) => void;
}

export type FriendCardTimelineItem = {
	id: string;
	label: string;
	value: string | null;
};

export type FriendCardSharedSummaryItem = {
	id: string;
	label: string;
	value: string;
};

export type { FriendCircle, FriendProfile };
