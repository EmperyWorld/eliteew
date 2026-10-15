/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import { computePublishReadiness } from '../surveyAdminPublishReadiness';
import { buildAdminUserPreviewDetail } from '../surveyAdminUserPreview';
import type { QuestionDraft } from '../surveyAdminEditorUtils';

const baseQuestion: QuestionDraft = {
	localId: 'q1',
	question_key: 'satisfaction',
	question_type: 'scale',
	prompt: 'How satisfied are you?',
	required: true,
	choicesText: '',
};

describe('computePublishReadiness', () => {
	it('counts partial readiness for title and questions only', () => {
		const result = computePublishReadiness({
			title: 'Pulse',
			questionCount: 2,
			groupCount: 0,
			userCount: 0,
			previewCount: null,
			rewardConfigured: false,
		});
		expect(result.readyCount).toBe(2);
		expect(result.publishReady).toBe(false);
		expect(result.completionRate).toBeNull();
	});

	it('marks publish ready when title, questions, and audience exist', () => {
		const result = computePublishReadiness({
			title: 'Pulse',
			questionCount: 1,
			groupCount: 1,
			userCount: 0,
			previewCount: 12,
			rewardConfigured: true,
		});
		expect(result.publishReady).toBe(true);
		expect(result.readyCount).toBe(5);
		expect(result.completionRate).toBe(0);
	});
});

describe('buildAdminUserPreviewDetail', () => {
	it('returns null when no valid questions', () => {
		expect(
			buildAdminUserPreviewDetail({
				surveyId: 'srv-1',
				title: 'T',
				descriptionUser: 'D',
				rewardUgs: '0',
				rewardEw: '0',
				rewardCoins: '0',
				questions: [{ ...baseQuestion, prompt: '   ', question_key: '   ' }],
			})
		).toBeNull();
	});

	it('maps editor drafts to user detail with rewards', () => {
		const detail = buildAdminUserPreviewDetail({
			surveyId: 'srv-1',
			title: '  Weekly pulse ',
			descriptionUser: 'Help us improve',
			rewardUgs: '10',
			rewardEw: '0',
			rewardCoins: '3',
			questions: [baseQuestion],
		});
		expect(detail).toMatchObject({
			id: 'srv-1',
			title: 'Weekly pulse',
			description_user: 'Help us improve',
			reward: { ugs_credits: 10, ew_balance: 0, web_search_coins: 3 },
			completed: false,
		});
		expect(detail?.questions).toHaveLength(1);
		expect(detail?.questions[0]?.question_key).toBe('satisfaction');
	});
});
