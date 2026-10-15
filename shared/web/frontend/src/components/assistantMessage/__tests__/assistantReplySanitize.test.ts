import { describe, expect, it } from 'vitest';
import {
	assistantReplyDisplayParts,
	hasAssistantOrbitMeta,
	partitionAssistantOrbitMeta,
	stripAssistantReplyDisplayNoise,
	stripLeadingAssistantBoilerplateLines,
	stripLeadingInternalBulletReport,
	stripToolStepsRecapAndList,
} from '../assistantReplySanitize';

describe('stripLeadingAssistantBoilerplateLines', () => {
	it('removes known leading line patterns', () => {
		const input = 'Задействованы инструменты (2).\n\nПользовательский текст';
		expect(stripLeadingAssistantBoilerplateLines(input)).toBe(
			'Пользовательский текст'
		);
	});

	it('strips inline prefix before body', () => {
		const input = 'Задействованы инструменты (1) Реальный ответ здесь';
		expect(stripLeadingAssistantBoilerplateLines(input)).toContain(
			'Реальный ответ здесь'
		);
	});

	it('normalizes CRLF', () => {
		const input = 'Ответ на запрос пользователя.\r\n\r\nBody';
		expect(stripLeadingAssistantBoilerplateLines(input)).toBe('Body');
	});
});

describe('stripLeadingInternalBulletReport', () => {
	it('does not strip ordinary markdown lists', () => {
		const input = '- пункт один\n- пункт два';
		expect(stripLeadingInternalBulletReport(input)).toBe(input.trim());
	});

	it('strips orchestrator bullet block when probe matches', () => {
		const input =
			'- шаг инструментов выполнен\n- вызов инструмента\n\nПосле списка';
		const out = stripLeadingInternalBulletReport(input);
		expect(out).toContain('После списка');
	});
});

describe('stripToolStepsRecapAndList', () => {
	it('removes recap line and following probe bullets', () => {
		const input = [
			'В контексте запроса следующие шаги инструментов:',
			'',
			'- инструмент задействован',
			'- ещё пункт',
			'',
			'Оставшийся текст',
		].join('\n');
		const out = stripToolStepsRecapAndList(input);
		expect(out.trim()).toBe('Оставшийся текст');
	});
});

describe('hasAssistantOrbitMeta', () => {
	it('returns false for empty meta', () => {
		expect(hasAssistantOrbitMeta({})).toBe(false);
	});

	it('detects any filled field', () => {
		expect(hasAssistantOrbitMeta({ goal: 'x' })).toBe(true);
	});
});

describe('partitionAssistantOrbitMeta', () => {
	it('returns full text as remainder when no goal label', () => {
		const { remainder, meta } = partitionAssistantOrbitMeta('Просто текст');
		expect(remainder).toBe('Просто текст');
		expect(meta.goal).toBeUndefined();
	});

	it('extracts goal and remainder when delimiter present', () => {
		const text = [
			'Цель ответа: помочь пользователю.',
			'',
			'Итоговый ответ: финал для пузыря',
		].join('\n');
		const { remainder, meta } = partitionAssistantOrbitMeta(text);
		expect(meta.goal).toBeDefined();
		expect(remainder).toContain('финал для пузыря');
	});
});

describe('stripAssistantReplyDisplayNoise', () => {
	it('applies full pipeline with stripInternalList default true', () => {
		const noisy = 'Задействованы инструменты (1).\n\nЗдравствуйте, чем помочь?';
		const out = stripAssistantReplyDisplayNoise(noisy);
		expect(out).toBe('Здравствуйте, чем помочь?');
	});

	it('skips internal list stripping when disabled', () => {
		const text = '- внутренний отчёт\n- второй';
		const out = stripAssistantReplyDisplayNoise(text, {
			stripInternalList: false,
		});
		expect(out).toContain('- внутренний');
	});
});

describe('assistantReplyDisplayParts', () => {
	it('returns bubble text without orbit when stripOrbitMeta false', () => {
		const text = 'Цель ответа: x. Итоговый ответ: только это';
		const { bubbleMarkdown, orbitMeta } = assistantReplyDisplayParts(text, {
			stripOrbitMeta: false,
		});
		expect(orbitMeta).toBeNull();
		expect(bubbleMarkdown.length).toBeGreaterThan(0);
	});
});
