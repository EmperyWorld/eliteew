import { describe, expect, it, vi } from 'vitest';
import { filterEwrpHistoryJobs } from './EwrpGeneratorChunks';
import type { EwrpJobListItem } from '../../services/ewrpApi';

vi.mock('i18next', () => ({
	default: {
		language: 'ru',
		t: (key: string) => {
			if (key === 'ewrp:status.failed') return 'ошибка';
			if (key === 'ewrp:status.completed') return 'готово';
			return key;
		},
	},
}));

vi.mock('react-i18next', () => ({
	initReactI18next: { type: '3rdParty', init: () => {} },
	useTranslation: () => ({ t: (key: string) => key }),
}));

const sampleJobs: EwrpJobListItem[] = [
	{
		id: 'job-alpha',
		title: 'Pitch deck',
		topic: 'AI in logistics',
		num_slides: 5,
		status: 'completed',
		progress: 100,
		error_message: null,
		created_at: '2026-05-01T10:00:00.000Z',
		updated_at: '2026-05-01T10:05:00.000Z',
		completed_at: '2026-05-01T10:05:00.000Z',
	},
	{
		id: 'job-beta',
		title: 'Investor update',
		topic: 'Q2 metrics',
		num_slides: 8,
		status: 'failed',
		progress: 40,
		error_message: 'MinIO unreachable on worker',
		created_at: '2026-05-02T10:00:00.000Z',
		updated_at: '2026-05-02T10:02:00.000Z',
		completed_at: null,
	},
];

describe('filterEwrpHistoryJobs', () => {
	it('returns all jobs when query is empty', () => {
		expect(filterEwrpHistoryJobs(sampleJobs, '')).toHaveLength(2);
		expect(filterEwrpHistoryJobs(sampleJobs, '   ')).toHaveLength(2);
	});

	it('matches topic, title and job id', () => {
		expect(filterEwrpHistoryJobs(sampleJobs, 'logistics')).toHaveLength(1);
		expect(filterEwrpHistoryJobs(sampleJobs, 'job-beta')).toHaveLength(1);
		expect(filterEwrpHistoryJobs(sampleJobs, 'Investor')).toHaveLength(1);
	});

	it('matches error_message on failed jobs', () => {
		expect(filterEwrpHistoryJobs(sampleJobs, 'minio')).toHaveLength(1);
		expect(filterEwrpHistoryJobs(sampleJobs, 'unreachable')).toHaveLength(1);
	});

	it('matches raw status and localized status label', () => {
		expect(filterEwrpHistoryJobs(sampleJobs, 'failed')).toHaveLength(1);
		expect(filterEwrpHistoryJobs(sampleJobs, 'completed')).toHaveLength(1);
		expect(filterEwrpHistoryJobs(sampleJobs, 'ошибка')).toHaveLength(1);
	});
});
