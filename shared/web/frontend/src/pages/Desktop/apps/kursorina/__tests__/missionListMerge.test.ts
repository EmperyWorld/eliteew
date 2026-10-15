/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for Kursorina list merge — stale empty list must not wipe create.
 *
 * Related:
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/kursorinaUtils.ts
 * - documentation/reference/fixed-errors/kursorina/2026-09-05-mission-vanish-stale-list.md
 */

import { describe, expect, it } from 'vitest';
import { mergeServerMissions, preferFresher } from '../kursorinaUtils';
import type { MissionPublicView } from '../types';

function mission(
	partial: Partial<MissionPublicView> & Pick<MissionPublicView, 'id' | 'status'>
): MissionPublicView {
	return {
		goal: partial.goal ?? 'goal',
		progress: partial.progress ?? '',
		results: partial.results ?? [],
		answer: partial.answer ?? null,
		created_at: partial.created_at,
		updated_at: partial.updated_at,
		...partial,
	};
}

describe('mergeServerMissions', () => {
	it('keeps just-created local mission when late server list is empty', () => {
		const created = mission({
			id: 'new-1',
			status: 'queued',
			goal: 'Исследуй рынок',
			updated_at: '2026-09-05T09:00:00Z',
		});
		const merged = mergeServerMissions([], [created]);
		expect(merged).toHaveLength(1);
		expect(merged[0]?.id).toBe('new-1');
		expect(merged[0]?.status).toBe('queued');
	});

	it('prepends local orphan ahead of server rows', () => {
		const created = mission({ id: 'new-1', status: 'running' });
		const older = mission({ id: 'old-1', status: 'completed' });
		const merged = mergeServerMissions([older], [created, older]);
		expect(merged.map((m) => m.id)).toEqual(['new-1', 'old-1']);
	});

	it('does not roll terminal local back to older running from list', () => {
		const local = mission({
			id: 'm1',
			status: 'completed',
			answer: 'done',
			updated_at: '2026-09-05T09:10:00Z',
		});
		const stale = mission({
			id: 'm1',
			status: 'running',
			updated_at: '2026-09-05T09:00:00Z',
		});
		expect(preferFresher(local, stale).status).toBe('completed');
		const merged = mergeServerMissions([stale], [local]);
		expect(merged[0]?.status).toBe('completed');
		expect(merged[0]?.answer).toBe('done');
	});
});
