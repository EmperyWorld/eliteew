import { describe, expect, it } from 'vitest';
import { mapFriendSearchCandidateFromApi } from '../friendsApi';

describe('searchFriendCandidates API → domain mapping', () => {
	it('maps relationship_status to relationshipStatus (regression guard)', () => {
		const row = mapFriendSearchCandidateFromApi({
			id: 'u1',
			username: 'alice',
			avatar_url: null,
			full_name: 'Alice',
			relationship_status: 'can_send',
			request_id: null,
			is_muted: false,
			is_blocked: false,
			share_activity_with_friend: true,
			activity_visible_to_current_user: true,
			last_activity_at: null,
			last_interaction_at: null,
		});
		expect(row.relationshipStatus).toBe('can_send');
		expect('relationship_status' in row).toBe(false);
	});

	it('passes through optional badge fields when present on wire', () => {
		const row = mapFriendSearchCandidateFromApi({
			id: 'u2',
			username: 'bob',
			avatar_url: null,
			full_name: null,
			relationship_status: 'friend',
			is_trusted: true,
			admin_badge_label: 'Staff',
			admin_badge_hint: null,
			request_id: null,
			is_muted: false,
			is_blocked: false,
			share_activity_with_friend: true,
			activity_visible_to_current_user: true,
			last_activity_at: null,
			last_interaction_at: null,
		});
		expect(row.is_trusted).toBe(true);
		expect(row.admin_badge_label).toBe('Staff');
	});
});
