import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { components } from '@/generated/friends-openapi';
import { FRIENDS_API_V1_BASE } from '../friendsApi';

const FRIENDS_PILOT = join(
	__dirname,
	'../../../../../openapi/pilot/friends.openapi.json'
);

/**
 * Contract: HTTP bases and overview JSON shape vs pilot OpenAPI
 * (`openapi/pilot/friends.openapi.json` → `pnpm run openapi:pilot`).
 */
describe('friends API path contract', () => {
	it('uses v1 prefix mounted in shared/api/domains/social.py', () => {
		expect(FRIENDS_API_V1_BASE).toBe('/api/v1');
	});

	it('resolves overview URL', () => {
		expect(`${FRIENDS_API_V1_BASE}/friends/overview`).toBe(
			'/api/v1/friends/overview'
		);
	});

	it('overview response matches generated FriendsOverviewResponse', () => {
		const sample: components['schemas']['FriendsOverviewResponse'] = {
			friends: [
				{
					id: 'u1',
					username: 'a',
					avatar_url: null,
					full_name: null,
					is_favorite: false,
					is_muted: false,
					is_blocked: false,
					share_activity_with_friend: true,
					activity_visible_to_current_user: true,
					circles: [],
				},
			],
			incoming_requests: [],
			sent_requests: [],
			circles: [],
			stats: {
				friends_count: 1,
				incoming_requests_count: 0,
				sent_requests_count: 0,
			},
		};
		expect(sample.friends?.[0]?.id).toBe('u1');
	});

	it('OpenAPI pilot documents 304 on GET /friends/overview', () => {
		const spec = JSON.parse(readFileSync(FRIENDS_PILOT, 'utf8')) as {
			paths: Record<string, { get?: { responses?: Record<string, unknown> } }>;
		};
		const op = spec.paths['/api/v1/friends/overview']?.get;
		expect(op?.responses?.['304']).toBeDefined();
		expect(op?.responses?.['200']).toBeDefined();
	});
});
