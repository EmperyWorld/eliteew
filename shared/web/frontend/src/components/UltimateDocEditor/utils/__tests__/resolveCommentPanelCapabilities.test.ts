/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock deny-by-default for comment panel when API capabilities are absent.
 *
 * Related:
 * - resolveCommentPanelCapabilities.ts
 */

import { describe, expect, it } from 'vitest';
import { resolveCommentPanelCapabilities } from '../resolveCommentPanelCapabilities';

describe('resolveCommentPanelCapabilities', () => {
	it('denies all actions when capabilities are null', () => {
		expect(resolveCommentPanelCapabilities(null)).toEqual({
			canWriteComments: false,
			canManageThreads: false,
			canResolveThreads: false,
			canAssignReviewer: false,
			capabilitiesKnown: false,
		});
	});

	it('denies all actions when capabilities are undefined', () => {
		expect(resolveCommentPanelCapabilities(undefined).capabilitiesKnown).toBe(
			false
		);
		expect(resolveCommentPanelCapabilities(undefined).canWriteComments).toBe(
			false
		);
	});

	it('mirrors server capability flags when present', () => {
		expect(
			resolveCommentPanelCapabilities({
				'comment.write': true,
				'review.resolve': true,
				'review.assign': false,
			})
		).toEqual({
			canWriteComments: true,
			canManageThreads: true,
			canResolveThreads: true,
			canAssignReviewer: false,
			capabilitiesKnown: true,
		});
	});

	it('treats missing keys as false when capabilities object exists', () => {
		expect(resolveCommentPanelCapabilities({})).toEqual({
			canWriteComments: false,
			canManageThreads: false,
			canResolveThreads: false,
			canAssignReviewer: false,
			capabilitiesKnown: true,
		});
	});
});
