/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for agentic trace → created document parsing (FE fallback).
 */

import { describe, expect, it } from 'vitest';

import { agenticCreatedDocumentsFromTrace } from '@/features/ewa/agentic/agenticCreatedDocumentsFromTrace';

describe('agenticCreatedDocumentsFromTrace', () => {
	it('collects confirmed HITL file_create documents from gate checkpoints', () => {
		const docs = agenticCreatedDocumentsFromTrace([
			{
				seq: 1,
				node_id: 'node-1',
				kind: 'gate',
				payload_json: {
					event: 'hitl_companion_finalize',
					decision: 'confirm',
					created_unified_content_id: 'uc-a',
					summary: 'Готова: создала документ «rules.txt»',
				},
			},
			{
				seq: 2,
				node_id: 'node-2',
				kind: 'gate',
				payload_json: {
					event: 'hitl_companion_finalize',
					decision: 'confirm',
					created_unified_content_id: 'uc-a',
				},
			},
			{
				seq: 3,
				node_id: 'node-3',
				kind: 'gate',
				payload_json: {
					event: 'hitl_companion_finalize',
					decision: 'cancel',
					created_unified_content_id: 'uc-x',
				},
			},
		]);
		expect(docs).toEqual([{ unifiedContentId: 'uc-a', name: 'rules.txt' }]);
	});

	it('collects auto-accept file_create documents from act checkpoints', () => {
		const docs = agenticCreatedDocumentsFromTrace([
			{
				seq: 4,
				node_id: 'n-file',
				kind: 'act',
				payload_json: {
					tool: 'file_create',
					status: 'ok',
					created_unified_content_id: 'uc-b',
					document_name: 'IT_market_analysis_RF.md',
					summary: 'Готова: создала документ',
				},
			},
			{
				seq: 5,
				node_id: 'n-expert',
				kind: 'act',
				payload_json: {
					tool: 'call_expert_chat',
					status: 'ok',
					summary: 'research done',
				},
			},
		]);
		expect(docs).toEqual([
			{ unifiedContentId: 'uc-b', name: 'IT_market_analysis_RF.md' },
		]);
	});
});
