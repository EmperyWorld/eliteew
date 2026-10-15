/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion chat transcript extraction (`normalizeLearnedPreferences`, `extractCompanionChatMessagesFromLearned`).
 *
 * Invariants:
 * - Keeps **`desktop_friend_chat_v1`** wire assumptions aligned with `api/services/ewa_companion/chat_turn.py`.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 */
import { describe, expect, it } from 'vitest';

import {
	EWA_COMPANION_TURN_PLAN_NS,
	EWA_DESKTOP_FRIEND_CHAT_NS,
	clearEwaCompanionChatDraft,
	extractCompanionChatMessagesFromLearned,
	extractCompanionTurnPlanFromLearned,
	extractLatestCompanionAssistantReplyFromLearned,
	extractLatestCompanionUserMessageFromLearned,
	loadEwaCompanionChatDraft,
	normalizeLearnedPreferences,
	resolveLastUserMessageForRestore,
	saveEwaCompanionChatDraft,
} from '../ewaCompanionChatApi';

describe('ewaCompanionChatApi transcript helpers', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it('parses stringified learned_preferences root', () => {
		const nested = JSON.stringify({
			[EWA_DESKTOP_FRIEND_CHAT_NS]: {
				messages: [{ role: 'user', content: 'hi' }],
			},
		});
		expect(
			normalizeLearnedPreferences(nested)[EWA_DESKTOP_FRIEND_CHAT_NS]
		).toBeTruthy();
		expect(extractCompanionChatMessagesFromLearned(nested)).toHaveLength(1);
	});

	it('parses stringified desktop_friend_chat_v1 subtree', () => {
		const lp = {
			[EWA_DESKTOP_FRIEND_CHAT_NS]: JSON.stringify({
				messages: [
					{ role: 'user', content: 'a' },
					{ role: 'assistant', content: 'b' },
				],
			}),
		};
		expect(extractCompanionChatMessagesFromLearned(lp)).toHaveLength(2);
	});

	it('returns only the latest assistant reply for the visible friend-chat panel', () => {
		const lp = {
			[EWA_DESKTOP_FRIEND_CHAT_NS]: {
				messages: [
					{ role: 'user', content: 'первый вопрос' },
					{ role: 'assistant', content: 'первый ответ' },
					{ role: 'user', content: 'второй вопрос' },
					{ role: 'assistant', content: 'второй ответ' },
				],
			},
		};
		expect(extractCompanionChatMessagesFromLearned(lp)).toHaveLength(4);
		expect(extractLatestCompanionAssistantReplyFromLearned(lp)).toEqual([
			{ role: 'assistant', content: 'второй ответ' },
		]);
		expect(extractLatestCompanionUserMessageFromLearned(lp)).toBe(
			'второй вопрос'
		);
	});

	it('resolveLastUserMessageForRestore prefers pending turn user line', () => {
		expect(
			resolveLastUserMessageForRestore({
				messages: [{ role: 'user', content: 'stored' }],
				pendingTurn: [
					{ role: 'user', content: 'in flight' },
					{ role: 'assistant', content: '…' },
				],
			})
		).toBe('in flight');
	});

	it('extracts companion_turn_plan_v1 queue snapshot from learned_preferences', () => {
		const lp = {
			[EWA_COMPANION_TURN_PLAN_NS]: {
				source: 'file_study_compose_followup_music',
				created_at: '2026-05-25T00:00:00Z',
				steps: [
					{
						tool: 'music_generation',
						args: { user_line: 'сгенерируй песню' },
					},
				],
			},
		};
		expect(extractCompanionTurnPlanFromLearned(lp)).toEqual({
			source: 'file_study_compose_followup_music',
			created_at: '2026-05-25T00:00:00Z',
			steps: [
				{
					tool: 'music_generation',
					args: { user_line: 'сгенерируй песню' },
				},
			],
		});
	});

	it('returns null for malformed turn plan payloads', () => {
		expect(extractCompanionTurnPlanFromLearned({})).toBeNull();
		expect(
			extractCompanionTurnPlanFromLearned({
				[EWA_COMPANION_TURN_PLAN_NS]: { steps: [{ args: {} }] },
			})
		).toBeNull();
	});

	it('persists companion input drafts per principal and clears them on demand', () => {
		saveEwaCompanionChatDraft('user-a', 'черновик');
		saveEwaCompanionChatDraft('user-b', 'другой');
		expect(loadEwaCompanionChatDraft('user-a')).toBe('черновик');
		expect(loadEwaCompanionChatDraft('user-b')).toBe('другой');

		saveEwaCompanionChatDraft('user-a', '   ');
		expect(loadEwaCompanionChatDraft('user-a')).toBe('');
		expect(loadEwaCompanionChatDraft('user-b')).toBe('другой');

		clearEwaCompanionChatDraft('user-b');
		expect(loadEwaCompanionChatDraft('user-b')).toBe('');
	});
});
