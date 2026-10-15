import { describe, expect, it } from 'vitest';
import { EWRP_HISTORY_STALE_AFTER_MS } from './EwrpGeneratorChunks';
import {
	ewrpFormLockedFromJob,
	ewrpHistoryRowCapabilities,
	ewrpShouldStopStatusPolling,
	ewrpSlideEditorJobBusy,
	ewrpSlideRebuildInProgress,
	ewrpSlideRegenAllowed,
} from './ewrpClientJobPolicy';

describe('ewrpShouldStopStatusPolling', () => {
	it('stops on completed and failed', () => {
		expect(ewrpShouldStopStatusPolling('completed')).toBe(true);
		expect(ewrpShouldStopStatusPolling('failed')).toBe(true);
	});

	it('continues on in-progress statuses', () => {
		expect(ewrpShouldStopStatusPolling('queued')).toBe(false);
		expect(ewrpShouldStopStatusPolling('generating_images')).toBe(false);
	});
});

describe('ewrpFormLockedFromJob', () => {
	it('is unlocked without active job id', () => {
		expect(ewrpFormLockedFromJob(null, 'queued')).toBe(false);
	});

	it('locks while job is in progress', () => {
		expect(ewrpFormLockedFromJob('job-1', 'generating_content')).toBe(true);
	});

	it('unlocks when job is terminal', () => {
		expect(ewrpFormLockedFromJob('job-1', 'completed')).toBe(false);
		expect(ewrpFormLockedFromJob('job-1', 'failed')).toBe(false);
	});
});

describe('ewrpHistoryRowCapabilities', () => {
	const now = Date.parse('2026-05-27T12:00:00.000Z');

	it('shows retry and duplicate for failed jobs', () => {
		expect(ewrpHistoryRowCapabilities('failed', null, now)).toEqual({
			canRetry: true,
			canDuplicate: true,
		});
	});

	it('shows duplicate only for completed jobs', () => {
		expect(ewrpHistoryRowCapabilities('completed', null, now)).toEqual({
			canRetry: false,
			canDuplicate: true,
		});
	});

	it('shows retry without duplicate for stale in-progress', () => {
		const stale = new Date(
			now - EWRP_HISTORY_STALE_AFTER_MS - 60_000
		).toISOString();
		expect(ewrpHistoryRowCapabilities('queued', stale, now)).toEqual({
			canRetry: true,
			canDuplicate: false,
		});
	});
});

describe('ewrpSlideRegenAllowed', () => {
	it('allows completed and failed jobs', () => {
		expect(ewrpSlideRegenAllowed('completed')).toBe(true);
		expect(ewrpSlideRegenAllowed('failed')).toBe(true);
	});

	it('blocks in-progress jobs', () => {
		expect(ewrpSlideRegenAllowed('generating_images')).toBe(false);
		expect(ewrpSlideRegenAllowed('queued')).toBe(false);
	});
});

describe('ewrpSlideRebuildInProgress', () => {
	it('detects regen and PDF rebuild phases', () => {
		expect(ewrpSlideRebuildInProgress('generating_content')).toBe(true);
		expect(ewrpSlideRebuildInProgress('generating_images')).toBe(true);
		expect(ewrpSlideRebuildInProgress('building_pdf')).toBe(true);
	});

	it('is false for terminal and queued', () => {
		expect(ewrpSlideRebuildInProgress('completed')).toBe(false);
		expect(ewrpSlideRebuildInProgress('queued')).toBe(false);
	});
});

describe('ewrpSlideEditorJobBusy', () => {
	it('blocks UGS actions during pipeline and rebuild', () => {
		expect(ewrpSlideEditorJobBusy('queued')).toBe(true);
		expect(ewrpSlideEditorJobBusy('generating_content')).toBe(true);
		expect(ewrpSlideEditorJobBusy('generating_images')).toBe(true);
		expect(ewrpSlideEditorJobBusy('building_pdf')).toBe(true);
	});

	it('allows actions when job is terminal', () => {
		expect(ewrpSlideEditorJobBusy('completed')).toBe(false);
		expect(ewrpSlideEditorJobBusy('failed')).toBe(false);
	});
});
