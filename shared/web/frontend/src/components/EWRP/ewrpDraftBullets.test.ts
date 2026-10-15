import { describe, expect, it } from 'vitest';
import {
	ewrpBulletLinesFromTextarea,
	ewrpBulletsToTextareaValue,
	ewrpDraftBulletsUnchanged,
	ewrpNonEmptyBulletCount,
	normalizeEwrpSlideBullets,
} from './ewrpDraftBullets';

describe('ewrpBulletLinesFromTextarea', () => {
	it('preserves trailing spaces and inner whitespace while typing', () => {
		expect(ewrpBulletLinesFromTextarea(' a  b  \n c')).toEqual([
			' a  b  ',
			' c',
		]);
	});

	it('preserves empty and whitespace-only lines (Enter / mid-edit)', () => {
		expect(ewrpBulletLinesFromTextarea('hello\n')).toEqual(['hello', '']);
		expect(ewrpBulletLinesFromTextarea(' \n\t ')).toEqual([' ', '\t ']);
	});
});

describe('normalizeEwrpSlideBullets', () => {
	it('prefers bullets list over content', () => {
		expect(
			normalizeEwrpSlideBullets({
				bullets: ['a', 'b'],
				content: ['x'],
			})
		).toEqual(['a', 'b']);
	});

	it('falls back to content when bullets empty', () => {
		expect(
			normalizeEwrpSlideBullets({
				content: ['пункт 1', 'пункт 2'],
			})
		).toEqual(['пункт 1', 'пункт 2']);
	});

	it('falls back to multiline body', () => {
		expect(
			normalizeEwrpSlideBullets({
				body: 'line one\nline two',
			})
		).toEqual(['line one', 'line two']);
	});

	it('trims and drops empty lines for persist/enter-editor', () => {
		expect(
			normalizeEwrpSlideBullets({
				bullets: ['  a  ', '', '  b  b  '],
			})
		).toEqual(['a', 'b  b']);
	});
});

describe('ewrpBulletsToTextareaValue', () => {
	it('joins raw draft bullets without trimming (caret-safe round-trip)', () => {
		expect(ewrpBulletsToTextareaValue({ bullets: ['hello ', ''] })).toBe(
			'hello \n'
		);
	});

	it('joins clean lines with newlines', () => {
		expect(ewrpBulletsToTextareaValue({ bullets: ['one', 'two'] })).toBe(
			'one\ntwo'
		);
	});
});

describe('ewrpDraftBulletsUnchanged', () => {
	it('treats trailing space as a real edit (must update controlled value)', () => {
		expect(ewrpDraftBulletsUnchanged({ bullets: ['hello'] }, 'hello ')).toBe(
			false
		);
	});

	it('detects no-op when textarea already matches draft', () => {
		expect(ewrpDraftBulletsUnchanged({ bullets: ['hello '] }, 'hello ')).toBe(
			true
		);
	});

	it('detects real edits', () => {
		expect(ewrpDraftBulletsUnchanged({ bullets: ['hello'] }, 'hello!')).toBe(
			false
		);
	});
});

describe('ewrpNonEmptyBulletCount', () => {
	it('counts only non-empty trimmed bullets', () => {
		expect(ewrpNonEmptyBulletCount(['a', '', '  b  ', ''])).toBe(2);
	});

	it('handles nullish', () => {
		expect(ewrpNonEmptyBulletCount(undefined)).toBe(0);
	});
});

describe('live textarea round-trip', () => {
	it('space mid-edit does not rewrite value after from→to', () => {
		const typed = 'пункт один | курсор';
		const withSpace = `${typed.slice(0, 11)} ${typed.slice(11)}`;
		const lines = ewrpBulletLinesFromTextarea(withSpace);
		expect(ewrpBulletsToTextareaValue({ bullets: lines })).toBe(withSpace);
	});

	it('delete mid-string round-trips exactly', () => {
		const afterDelete = 'hel world';
		const lines = ewrpBulletLinesFromTextarea(afterDelete);
		expect(ewrpBulletsToTextareaValue({ bullets: lines })).toBe(afterDelete);
	});
});
