/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock interview room-card extraction from Team blueprint markdown/metadata.
 *
 * Invariants:
 * - Existing research_plan headings «Тема интервью» / «Цель интервью» are enough.
 * - Panel section `hero_id` lines become the Discussion roster.
 * - CTA start prefers prep roster, then contributors, then chat Team ids.
 *
 * Related:
 * - ../interviewHandoff.ts
 * - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 */
import { describe, expect, it } from 'vitest';
import {
	buildInterviewDiscussionStartInput,
	canShowInterviewHandoffCta,
	extractInterviewHandoff,
	INTERVIEW_HANDOFF_PRESET_ID,
} from '../interviewHandoff';

const POET_CARD = `## Тема интервью

**Стратегический вектор исследования рыночных ниш и потребительских болей для формирования позиционирования EliteEW.**

Для того чтобы наше позиционирование не стало набором маркетинговых клише.

## Цель интервью

Определить операционную задачу интервью: верификацию гипотез о ценности продукта.

**Задачи для операционной применимости:**
* Валидация функциональных связок.
`;

const PANEL_CARD = `## Тема интервью

Смысловое ядро EliteEW.

## Цель интервью

Позиционирование после ответов.

## Панель интервью

- \`arlyqueen\` — ведущий: JTBD
- \`it_kernel\` — техника

## Гайд для панели

1. Какой JTBD главный?
`;

describe('extractInterviewHandoff', () => {
	it('reads RU headings from an existing research-plan card', () => {
		const hit = extractInterviewHandoff(POET_CARD);
		expect(hit?.preset_id).toBe(INTERVIEW_HANDOFF_PRESET_ID);
		expect(hit?.topic).toMatch(/Стратегический вектор/);
		expect(hit?.goal).toMatch(/операционную задачу/);
		expect(hit?.roster).toEqual([]);
	});

	it('prefers metadata over markdown topic/goal', () => {
		const hit = extractInterviewHandoff('## Тема интервью\n\nFrom markdown', {
			interview_handoff: { topic: 'Meta topic', goal: 'Meta goal' },
		});
		expect(hit).toMatchObject({
			topic: 'Meta topic',
			goal: 'Meta goal',
			preset_id: INTERVIEW_HANDOFF_PRESET_ID,
			roster: [],
			panel_guide: '',
		});
	});

	it('returns null without a topic heading', () => {
		expect(
			extractInterviewHandoff('## Методология\n\nMixed method')
		).toBeNull();
	});

	it('reads bold Тема/Цель room cards without ## headings', () => {
		const hit = extractInterviewHandoff(`## Стратегическая карточка интервью

**Тема:** Извлечение смыслового ядра EliteEW.

**Цель:** Трансформировать видение основателя в позиционирование.
`);
		expect(hit?.topic).toMatch(/смыслового ядра/);
		expect(hit?.goal).toMatch(/позиционирование/);
	});

	it('ignores a lone bold Тема without Цель', () => {
		expect(
			extractInterviewHandoff('**Тема:** Только тема без цели.')
		).toBeNull();
	});

	it('parses panel roster and guide from prep card', () => {
		const hit = extractInterviewHandoff(PANEL_CARD);
		expect(hit?.roster).toEqual(['arlyqueen', 'it_kernel']);
		expect(hit?.panel_roles.arlyqueen).toMatch(/JTBD/);
		expect(hit?.panel_guide).toMatch(/JTBD главный/);
	});
});

describe('canShowInterviewHandoffCta', () => {
	it('shows for persisted freeform cards with topic and goal', () => {
		expect(
			canShowInterviewHandoffCta(
				{ id: '550e8400-e29b-41d4-a716-446655440000', content: POET_CARD },
				{ hasStartHandler: true }
			)
		).toBe(true);
	});

	it('hides without start handler, local id, or non-interview body', () => {
		expect(
			canShowInterviewHandoffCta(
				{ id: '550e8400-e29b-41d4-a716-446655440000', content: POET_CARD },
				{ hasStartHandler: false }
			)
		).toBe(false);
		expect(
			canShowInterviewHandoffCta(
				{ id: 'local-stream-1', content: POET_CARD },
				{ hasStartHandler: true }
			)
		).toBe(false);
		expect(
			canShowInterviewHandoffCta(
				{
					id: '550e8400-e29b-41d4-a716-446655440000',
					content: '## Методология\n\nMixed method',
				},
				{ hasStartHandler: true }
			)
		).toBe(false);
	});
});

describe('buildInterviewDiscussionStartInput', () => {
	it('uses panel roster from the prep card before chat ensemble fallback', () => {
		const input = buildInterviewDiscussionStartInput(
			{ id: 'msg-prep-1', content: PANEL_CARD },
			['likiy_sorrento', 'akimbo']
		);
		expect(input).toMatchObject({
			preset_id: INTERVIEW_HANDOFF_PRESET_ID,
			intensity: 'calm',
			source_message_id: 'msg-prep-1',
			roster: ['arlyqueen', 'it_kernel'],
		});
	});

	it('falls back to chat Team ids when the card has no panel section', () => {
		const input = buildInterviewDiscussionStartInput(
			{ id: 'msg-prep-2', content: POET_CARD },
			['likiy_sorrento', 'arlyqueen', 'likiy_sorrento', '']
		);
		expect(input?.roster).toEqual(['likiy_sorrento', 'arlyqueen']);
	});

	it('allows empty roster so the API can fill from chat settings', () => {
		const input = buildInterviewDiscussionStartInput(
			{ id: 'msg-prep-3', content: POET_CARD },
			[]
		);
		expect(input?.roster).toEqual([]);
	});
});
