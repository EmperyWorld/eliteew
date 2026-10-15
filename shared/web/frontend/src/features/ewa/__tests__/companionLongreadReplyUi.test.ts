/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for longread reply detection in companion chat typography.
 */
import { describe, expect, it } from 'vitest';

import {
	extractCompanionCopyText,
	isCompanionLongreadReply,
} from '@/features/ewa/companionLongreadReplyUi';

describe('isCompanionLongreadReply', () => {
	it('detects Russian longread header with copy block', () => {
		const md = `**Лонгрид для VK** — можно копировать:

---

Текст поста.

---

_Скопируй текст между линиями._`;
		expect(isCompanionLongreadReply(md)).toBe(true);
	});

	it('detects English long-form header', () => {
		expect(
			isCompanionLongreadReply(
				'**Long-form post for VK** — copy below:\n\n---\n\nBody\n\n---\n'
			)
		).toBe(true);
	});

	it('does not flag normal assistant prose', () => {
		expect(isCompanionLongreadReply('Короткий ответ без лонгрида.')).toBe(
			false
		);
	});

	it('extracts copy text between dividers', () => {
		const md = `**Лонгрид для VK**

---

Только тело поста.

---

_hint_`;
		expect(extractCompanionCopyText(md)).toBe('Только тело поста.');
	});
});
