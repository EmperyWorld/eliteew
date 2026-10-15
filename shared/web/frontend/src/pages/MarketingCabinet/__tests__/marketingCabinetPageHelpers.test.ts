import { describe, expect, it } from 'vitest';

import { buildMarketingChatExcerpt } from '../marketingCabinetPageHelpers';

describe('buildMarketingChatExcerpt', () => {
	it('keeps the newest chat turns when the excerpt budget is tight', () => {
		const out = buildMarketingChatExcerpt(
			[
				{
					id: '1',
					role: 'user',
					content: 'Старый длинный контекст про лендинг и структуру оффера',
				},
				{
					id: '2',
					role: 'assistant',
					content: 'Старый ответ про сегменты и CJM',
				},
				{
					id: '3',
					role: 'user',
					content: 'Свежий вопрос про конкурентов',
				},
				{
					id: '4',
					role: 'assistant',
					content: 'Свежий ответ про позиционирование',
				},
			],
			100
		);

		expect(out).toContain('Свежий вопрос про конкурентов');
		expect(out).toContain('Свежий ответ про позиционирование');
		expect(out).not.toContain('Старый длинный контекст');
	});
});
