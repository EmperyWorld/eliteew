import { describe, expect, it } from 'vitest';

import {
	ALL_NODE_TYPES,
	fieldsForNodeType,
} from '@/features/ewa/companionWorkflowDagBuilder/registry/fieldSchemas';

describe('fieldSchemas', () => {
	it('defines schema entries for every node type', () => {
		for (const type of ALL_NODE_TYPES) {
			const fields = fieldsForNodeType(type);
			expect(fields.length).toBeGreaterThan(0);
			expect(fields.some((field) => field.section === 'meta')).toBe(true);
		}
	});

	it('includes temperature for prompt_gen config', () => {
		const fields = fieldsForNodeType('prompt_gen');
		expect(fields.some((field) => field.key === 'temperature')).toBe(true);
		expect(
			fields.some(
				(field) => field.key === 'prompt' && field.section === 'inputs'
			)
		).toBe(true);
	});

	it('includes switch and for_each config fields', () => {
		const switchFields = fieldsForNodeType('switch');
		expect(switchFields.some((field) => field.key === 'switch_source')).toBe(
			true
		);
		const foreachFields = fieldsForNodeType('for_each');
		expect(foreachFields.some((field) => field.key === 'items_field')).toBe(
			true
		);
		expect(foreachFields.some((field) => field.key === 'max_iterations')).toBe(
			true
		);
	});

	it('includes transform_op for data_transformer', () => {
		const fields = fieldsForNodeType('data_transformer');
		const transformOp = fields.find((field) => field.key === 'transform_op');
		expect(transformOp?.kind).toBe('select');
		expect(transformOp?.options?.length).toBeGreaterThan(5);
		expect(transformOp?.labelRu).toBe('Операция');
	});

	it('uses Russian labels for telegram inputs', () => {
		const fields = fieldsForNodeType('telegram_sender');
		expect(fields.find((field) => field.key === 'chat_id')?.labelRu).toBe(
			'Chat ID Telegram'
		);
		expect(fields.find((field) => field.key === 'message_text')?.labelRu).toBe(
			'Текст сообщения'
		);
	});

	it('includes document_source inputs for pdf_parser', () => {
		const fields = fieldsForNodeType('pdf_parser');
		expect(
			fields.find((field) => field.key === 'unified_content_id')?.labelRu
		).toContain('Unified content');
	});
});
