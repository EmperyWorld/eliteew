/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit lock for Desktop AI Chat sidebar title / secondary label hygiene.
 *
 * Related:
 * - utils/desktopAiChatListDisplayTitle.ts
 */
import { describe, expect, it } from 'vitest';
import {
	desktopAiChatListDisplayTitle,
	desktopAiChatListPrimaryTitle,
	desktopAiChatListSecondaryLabel,
	stripDesktopAiChatTitlePrefix,
} from '../utils/desktopAiChatListDisplayTitle';

describe('desktopAiChatListDisplayTitle', () => {
	it('maps legacy ensemble defaults to fallback', () => {
		expect(desktopAiChatListDisplayTitle('Чат: Команда', 'Команда')).toBe(
			'Команда'
		);
		expect(desktopAiChatListDisplayTitle('Chat: Team', 'Team')).toBe('Team');
		expect(desktopAiChatListDisplayTitle('Команда', 'Команда')).toBe('Команда');
	});

	it('strips Chat:/Чат: prefix from solo titles', () => {
		expect(stripDesktopAiChatTitlePrefix('Чат: Ликий Соренто')).toBe(
			'Ликий Соренто'
		);
		expect(desktopAiChatListDisplayTitle('Чат: Ликий Соренто', 'Чат')).toBe(
			'Ликий Соренто'
		);
	});

	it('keeps custom titles', () => {
		expect(desktopAiChatListDisplayTitle('Workshop', 'Команда')).toBe(
			'Workshop'
		);
		expect(desktopAiChatListDisplayTitle('AMKA · campaigns', 'Команда')).toBe(
			'AMKA · campaigns'
		);
	});

	it('uses fallback for empty', () => {
		expect(desktopAiChatListDisplayTitle('  ', 'Команда')).toBe('Команда');
	});
});

describe('desktopAiChatListPrimaryTitle', () => {
	it('prefers roster preview when ensemble title is generic Команда', () => {
		expect(
			desktopAiChatListPrimaryTitle({
				title: 'Команда',
				isEnsemble: true,
				teamFallback: 'Команда',
				soloFallback: 'Чат',
				rosterPreview: 'Ликий · Соренто · Макс',
			})
		).toBe('Ликий · Соренто · Макс');
	});

	it('keeps custom ensemble titles', () => {
		expect(
			desktopAiChatListPrimaryTitle({
				title: 'AMKA · campaigns',
				isEnsemble: true,
				teamFallback: 'Команда',
				soloFallback: 'Чат',
				rosterPreview: 'Ликий · Соренто',
			})
		).toBe('AMKA · campaigns');
	});
});

describe('desktopAiChatListSecondaryLabel', () => {
	it('hides ensemble badge — card chrome + roster already signal team mode', () => {
		expect(
			desktopAiChatListSecondaryLabel({
				primaryTitle: 'Команда',
				sideLabel: 'Команда',
				isEnsemble: true,
				isShared: false,
				sharedBadge: null,
			})
		).toBeNull();
		expect(
			desktopAiChatListSecondaryLabel({
				primaryTitle: 'AMKA campaigns',
				sideLabel: 'Команда',
				isEnsemble: true,
				isShared: false,
				sharedBadge: null,
			})
		).toBeNull();
	});

	it('keeps shared badge on team/shared cards', () => {
		expect(
			desktopAiChatListSecondaryLabel({
				primaryTitle: 'Команда',
				sideLabel: 'Команда',
				isEnsemble: true,
				isShared: true,
				sharedBadge: 'Общий',
			})
		).toEqual({ kind: 'shared', label: 'Общий' });
	});

	it('hides solo secondary when it repeats the primary', () => {
		expect(
			desktopAiChatListSecondaryLabel({
				primaryTitle: 'Ликий Соренто',
				sideLabel: 'Ликий Соренто',
				isEnsemble: false,
				isShared: false,
				sharedBadge: null,
			})
		).toBeNull();
	});

	it('shows solo secondary when title is generic chat', () => {
		expect(
			desktopAiChatListSecondaryLabel({
				primaryTitle: 'Чат',
				sideLabel: 'Стандартный ассистент',
				isEnsemble: false,
				isShared: false,
				sharedBadge: null,
			})
		).toEqual({ kind: 'solo', label: 'Стандартный ассистент' });
	});
});
