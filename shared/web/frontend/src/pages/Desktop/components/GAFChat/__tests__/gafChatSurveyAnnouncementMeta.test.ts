import { describe, expect, it } from 'vitest';
import { getGafSurveyAnnouncementMeta } from '@/pages/Desktop/components/GAFChat/gafChatSurveyAnnouncementMeta';

describe('gafChatSurveyAnnouncementMeta', () => {
	it('parses survey announcement metadata', () => {
		const meta = getGafSurveyAnnouncementMeta({
			kind: 'survey_announcement',
			survey_id: 'abc-123',
			title: 'Pulse',
			open_app_component: 'SurveyHubApp',
			deep_link: { surveyId: 'abc-123' },
		});
		expect(meta?.survey_id).toBe('abc-123');
		expect(meta?.open_app_component).toBe('SurveyHubApp');
	});

	it('rejects unknown kinds', () => {
		expect(
			getGafSurveyAnnouncementMeta({ kind: 'desktop_app_link' })
		).toBeNull();
	});
});
