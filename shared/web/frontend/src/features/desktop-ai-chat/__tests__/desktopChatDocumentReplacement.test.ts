/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock whole-document SSE replacement and additive public metadata on the streamed assistant bubble.
 *
 * Invariants:
 * - Finalized content is preserved byte-for-byte and never appended to the draft.
 * - Stage mode never flips blueprint chrome; commit promotes once and can rewrite local ids.
 *
 * Related:
 * - src/features/desktop-ai-chat/desktopChatDocumentReplacement.ts
 */
import { describe, expect, it } from 'vitest';

import type { DesktopAiMessage } from '../api/desktopChatClient';
import {
	applyDesktopAiDocumentReplacement,
	DESKTOP_STREAM_FINALIZING_KEY,
	rewriteDesktopAiMessageId,
} from '../desktopChatDocumentReplacement';

const draft: DesktopAiMessage = {
	id: 'local-assistant',
	role: 'assistant',
	content: 'streamed draft',
	metadata: {
		desktop_ensemble_joint: true,
		desktop_hero_id: 'strateg',
	},
	created_at: null,
};

const finalPayload = {
	content: '## Final document\n\nVerified body.\n',
	quality_status: {
		status: 'verified' as const,
		grounding_status: 'grounded' as const,
	},
	artifact_type: 'project_audit',
	plan_template_id: 'project_audit_v1',
	message_id: '11111111-1111-4111-8111-111111111111',
	context_sources: [
		{
			citation_id: 'P1',
			kind: 'project_document' as const,
			authority: 'project_material' as const,
			title: 'Project research',
		},
	],
};

describe('applyDesktopAiDocumentReplacement', () => {
	it('stages content without blueprint chrome', () => {
		const result = applyDesktopAiDocumentReplacement(
			[draft],
			draft.id,
			finalPayload,
			{ mode: 'stage' }
		);
		expect(result.applied).toBe(true);
		expect(result.messages[0]?.content).toBe(finalPayload.content);
		expect(result.messages[0]?.metadata).toMatchObject({
			desktop_ensemble_joint: true,
			quality_status: finalPayload.quality_status,
			[DESKTOP_STREAM_FINALIZING_KEY]: true,
		});
		expect(
			result.messages[0]?.metadata?.desktop_ensemble_blueprint
		).toBeUndefined();
		expect(result.messages[0]?.metadata?.plan_template_id).toBeUndefined();
	});

	it('merges council_transcript with closing on reload commit (Wave F4)', () => {
		const council = {
			version: 1,
			mode: 'joint_document' as const,
			roster: ['max_safin', 'viktor_engineer'],
			turns: [
				{
					kind: 'orchestrator_brief' as const,
					text: 'Открываем круг',
					at_ms: 0,
				},
				{
					kind: 'speaker_reply' as const,
					text: '## UX\n\nКалькулятор',
					at_ms: 10,
					hero_id: 'max_safin',
					index: 0,
				},
				{
					kind: 'closing' as const,
					text: 'Кворум собран',
					at_ms: 20,
				},
			],
			closing: { decision: 'ok' as const },
		};
		const committed = applyDesktopAiDocumentReplacement(
			[draft],
			draft.id,
			{ ...finalPayload, council_transcript: council },
			{ mode: 'commit' }
		);
		expect(committed.messages[0]?.metadata?.council_transcript).toMatchObject({
			version: 1,
			mode: 'joint_document',
			closing: { decision: 'ok' },
		});
		expect(
			committed.messages[0]?.metadata?.council_transcript?.turns?.map(
				(t) => t.kind
			)
		).toEqual(['orchestrator_brief', 'speaker_reply', 'closing']);
	});

	it('merges council_transcript on stage and commit (Wave F1)', () => {
		const council = {
			version: 1,
			mode: 'joint_document' as const,
			roster: ['max_safin'],
			turns: [
				{
					kind: 'orchestrator_brief' as const,
					text: 'Открываем круг',
					at_ms: 0,
				},
				{
					kind: 'speaker_reply' as const,
					text: '## UX\n\nКалькулятор',
					at_ms: 10,
					hero_id: 'max_safin',
					label: 'Макс Бериевич',
					index: 0,
				},
			],
			closing: null,
		};
		const staged = applyDesktopAiDocumentReplacement(
			[draft],
			draft.id,
			{ ...finalPayload, council_transcript: council },
			{ mode: 'stage' }
		);
		expect(
			staged.messages[0]?.metadata?.council_transcript?.turns
		).toHaveLength(2);
		const committed = applyDesktopAiDocumentReplacement(
			staged.messages,
			draft.id,
			{ ...finalPayload, council_transcript: council },
			{ mode: 'commit', rewriteIdTo: finalPayload.message_id }
		);
		expect(committed.messages[0]?.metadata?.council_transcript).toMatchObject({
			version: 1,
			mode: 'joint_document',
		});
		expect(
			committed.messages[0]?.metadata?.council_transcript?.turns?.[1]?.text
		).toContain('Калькулятор');
	});

	it('commits blueprint metadata, clears finalizing, and rewrites id', () => {
		const staged = applyDesktopAiDocumentReplacement(
			[draft],
			draft.id,
			finalPayload,
			{ mode: 'stage' }
		).messages;
		const result = applyDesktopAiDocumentReplacement(
			staged,
			draft.id,
			finalPayload,
			{
				mode: 'commit',
				rewriteIdTo: finalPayload.message_id,
			}
		);

		expect(result.applied).toBe(true);
		expect(result.messageId).toBe(finalPayload.message_id);
		expect(result.messages[0]?.id).toBe(finalPayload.message_id);
		expect(result.messages[0]?.content).toBe(finalPayload.content);
		expect(result.messages[0]?.metadata).toMatchObject({
			desktop_ensemble_joint: true,
			desktop_ensemble_blueprint: true,
			plan_template_id: 'project_audit_v1',
			artifact_type: 'project_audit',
			quality_status: {
				status: 'verified',
				grounding_status: 'grounded',
			},
			context_sources: [{ citation_id: 'P1' }],
		});
		expect(
			result.messages[0]?.metadata?.[DESKTOP_STREAM_FINALIZING_KEY]
		).toBeUndefined();
	});

	it('replaces the draft exactly and marks a blueprint with evidence metadata', () => {
		const finalContent = '## Final document\n\nVerified body.\n';
		const result = applyDesktopAiDocumentReplacement([draft], draft.id, {
			content: finalContent,
			quality_status: {
				status: 'verified',
				grounding_status: 'grounded',
			},
			artifact_type: 'project_audit',
			plan_template_id: 'project_audit_v1',
			context_sources: [
				{
					citation_id: 'P1',
					kind: 'project_document',
					authority: 'project_material',
					title: 'Project research',
				},
			],
		});

		expect(result.applied).toBe(true);
		expect(result.content).toBe(finalContent);
		expect(result.messages).toHaveLength(1);
		expect(result.messages[0]?.content).toBe(finalContent);
		expect(result.messages[0]?.content).not.toContain('streamed draft');
		expect(result.messages[0]?.metadata).toMatchObject({
			desktop_ensemble_joint: true,
			desktop_ensemble_blueprint: true,
			plan_template_id: 'project_audit_v1',
			artifact_type: 'project_audit',
			quality_status: {
				status: 'verified',
				grounding_status: 'grounded',
			},
			context_sources: [{ citation_id: 'P1' }],
			context_summary: {
				context_sources: [{ citation_id: 'P1' }],
			},
		});
	});

	it('ignores malformed or misdirected replacement events', () => {
		expect(
			applyDesktopAiDocumentReplacement([draft], 'other', {
				content: '## Final',
			})
		).toEqual({
			messages: [draft],
			content: null,
			applied: false,
			messageId: null,
		});
		expect(
			applyDesktopAiDocumentReplacement([draft], draft.id, { content: ' ' })
		).toEqual({
			messages: [draft],
			content: null,
			applied: false,
			messageId: null,
		});
	});
});

describe('rewriteDesktopAiMessageId', () => {
	it('rewrites a single message id', () => {
		const out = rewriteDesktopAiMessageId(
			[draft],
			'local-assistant',
			'11111111-1111-4111-8111-111111111111'
		);
		expect(out[0]?.id).toBe('11111111-1111-4111-8111-111111111111');
	});
});
