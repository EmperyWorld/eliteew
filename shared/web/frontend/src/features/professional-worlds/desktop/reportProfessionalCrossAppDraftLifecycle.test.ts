/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for cross-app draft lifecycle client report helpers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
	reportProfessionalCrossAppDraft: vi.fn(),
}));

import { reportProfessionalCrossAppDraft } from './api';
import {
	readCrossAppLinkId,
	reportProfessionalCrossAppDraftLifecycle,
	shouldReportGafCrossAppDraftPublished,
} from './reportProfessionalCrossAppDraftLifecycle';

describe('readCrossAppLinkId', () => {
	it('reads cross_app_link_id from capsule JSON', () => {
		expect(
			readCrossAppLinkId({ cross_app_link_id: ' link-1 ', destination: 'ewrp' })
		).toBe('link-1');
		expect(readCrossAppLinkId({ destination: 'ewrp' })).toBeNull();
	});
});

describe('shouldReportGafCrossAppDraftPublished', () => {
	it('requires link id and outbound content', () => {
		expect(
			shouldReportGafCrossAppDraftPublished({
				linkId: 'link-1',
				body: 'Hello',
			})
		).toBe(true);
		expect(
			shouldReportGafCrossAppDraftPublished({
				linkId: 'link-1',
				body: '',
				attachmentContentId: 'uc-1',
			})
		).toBe(true);
		expect(
			shouldReportGafCrossAppDraftPublished({
				linkId: '',
				body: 'Hello',
			})
		).toBe(false);
	});
});

describe('reportProfessionalCrossAppDraftLifecycle', () => {
	beforeEach(() => {
		vi.mocked(reportProfessionalCrossAppDraft).mockReset();
		vi.mocked(reportProfessionalCrossAppDraft).mockResolvedValue({} as never);
	});

	it('skips empty link id', () => {
		reportProfessionalCrossAppDraftLifecycle('', 'opened');
		expect(reportProfessionalCrossAppDraft).not.toHaveBeenCalled();
	});

	it('posts opened report with remote tracking', async () => {
		reportProfessionalCrossAppDraftLifecycle('link-1', 'published', {
			ewrp_job_id: 'job-9',
		});
		await Promise.resolve();
		expect(reportProfessionalCrossAppDraft).toHaveBeenCalledWith('link-1', {
			lifecycle_state: 'published',
			remote_tracking: { ewrp_job_id: 'job-9' },
		});
	});
});
