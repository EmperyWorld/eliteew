/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for user-facing operation completion toast copy (U3.10).
 */

import { describe, expect, it } from 'vitest';

import { resolveCompanionOperationCompletedToast } from '@/features/ewa/companionUx/companionUserSuccessToasts';
import { makeCompanionTaskRun } from '@/features/ewa/companionOperations/companionTaskRunFixtures';

const t = ((key: string, opts?: Record<string, string>) => {
	if (opts?.name) return `${key}:${opts.name}`;
	if (opts?.hint) return `${key}:${opts.hint}`;
	if (opts?.title) return `${key}:${opts.title}`;
	return key;
}) as never;

describe('resolveCompanionOperationCompletedToast', () => {
	it('returns music toast with track name', () => {
		const run = makeCompanionTaskRun({
			id: 'r1',
			status: 'completed',
			intent_kind: 'music_generation_background',
			result_payload: {
				unified_content_id: 'uc-1',
				track_name: 'Летний вечер',
			},
		});
		expect(resolveCompanionOperationCompletedToast(run, t)).toEqual({
			title: 'ewaCompanion.userToast.musicReadyTitle',
			message: 'ewaCompanion.userToast.musicReadyMessage:Летний вечер',
		});
	});

	it('returns null for non-completed runs', () => {
		const run = makeCompanionTaskRun({
			id: 'r2',
			status: 'running',
			intent_kind: 'music_generation_background',
		});
		expect(resolveCompanionOperationCompletedToast(run, t)).toBeNull();
	});
});
