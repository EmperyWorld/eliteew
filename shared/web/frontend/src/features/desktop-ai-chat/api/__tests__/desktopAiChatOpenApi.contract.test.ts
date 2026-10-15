/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Honest lock that Desktop AI Chat HTTP DTOs are OpenAPI SSOT aliases (Wave B2),
 * not twin hand interfaces; pilot JSON paths $ref named outs; Wave B5 SSE
 * `text/event-stream` $ref for POST …/stream and Discussion GET …/events.
 *
 * Related:
 * - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
 * - desktopAiChatOpenApi.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { components as DesktopComponents } from '@/generated/desktop-openapi';

import type {
	DesktopAiChatItem,
	DesktopAiChatOut,
	DesktopAiMemoryCell,
	DesktopAiMemoryCellOut,
	DesktopAiMessageListOut,
} from '../desktopAiChatOpenApi';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** `…/api/__tests__` → frontend package root. */
const FRONTEND_ROOT = join(__dirname, '../../../../../');
const PILOT_PATH = join(FRONTEND_ROOT, 'openapi/pilot/desktop.openapi.json');
const BRIDGE_PATH = join(__dirname, '../desktopAiChatOpenApi.ts');
const CLIENT_PATH = join(__dirname, '../desktopChatClient.ts');

type Desktop = DesktopComponents['schemas'];

const JSON_PATHS: Array<{ path: string; method: string; schema: string }> = [
	{
		path: '/api/v1/desktop/ai-chat/chats',
		method: 'get',
		schema: 'DesktopAiChatListOut',
	},
	{
		path: '/api/v1/desktop/ai-chat/chats',
		method: 'post',
		schema: 'DesktopAiChatOut',
	},
	{
		path: '/api/v1/desktop/ai-chat/me',
		method: 'get',
		schema: 'DesktopAiChatMeOut',
	},
	{
		path: '/api/v1/desktop/ai-chat/chats/{chat_id}/messages',
		method: 'get',
		schema: 'DesktopAiMessageListOut',
	},
	{
		path: '/api/v1/desktop/ai-chat/solo-slot-tariffs',
		method: 'get',
		schema: 'DesktopAiSoloSlotTariffsOut',
	},
];

describe('desktop AI chat OpenAPI SSOT (Wave B2)', () => {
	it('UI aliases track desktop-openapi Out schemas (type-level)', () => {
		type _Chat = DesktopAiChatOut extends Desktop['DesktopAiChatOut']
			? true
			: false;
		type _Item =
			DesktopAiChatItem extends Omit<
				Desktop['DesktopAiChatOut'],
				'capabilities'
			>
				? true
				: false;
		type _Cell = DesktopAiMemoryCell extends DesktopAiMemoryCellOut
			? true
			: false;
		type _Msgs =
			DesktopAiMessageListOut extends Desktop['DesktopAiMessageListOut']
				? true
				: false;
		const ok: [_Chat, _Item, _Cell, _Msgs] = [true, true, true, true];
		expect(ok).toEqual([true, true, true, true]);
	});

	it('desktop pilot paths $ref named response schemas', () => {
		const pilot = JSON.parse(readFileSync(PILOT_PATH, 'utf8')) as {
			paths: Record<
				string,
				Record<
					string,
					{
						responses?: Record<
							string,
							{
								content?: {
									'application/json'?: {
										schema?: { $ref?: string; items?: { $ref?: string } };
									};
								};
							}
						>;
					}
				>
			>;
			components: { schemas: Record<string, unknown> };
		};

		for (const row of JSON_PATHS) {
			const op = pilot.paths[row.path]?.[row.method];
			expect(op, row.path).toBeTruthy();
			const schema =
				op?.responses?.['200']?.content?.['application/json']?.schema ??
				op?.responses?.['201']?.content?.['application/json']?.schema;
			expect(schema, `${row.path} schema`).toBeTruthy();
			const ref = schema?.$ref ?? schema?.items?.$ref;
			expect(ref).toBe(`#/components/schemas/${row.schema}`);
			expect(pilot.components.schemas[row.schema]).toBeTruthy();
		}
	});

	it('bridge exists and client imports it (no hand DesktopAiChatItem interface)', () => {
		const bridge = readFileSync(BRIDGE_PATH, 'utf8');
		const client = readFileSync(CLIENT_PATH, 'utf8');
		expect(bridge).toContain('@/generated/desktop-openapi');
		expect(bridge).toContain('DesktopAiChatStreamSsePayloadDoc');
		expect(client).toContain("from './desktopAiChatOpenApi'");
		expect(client).not.toMatch(/export type DesktopAiChatItem = \{/);
		expect(client).not.toMatch(/export type SoloSlotTariffsResponse = \{/);
	});

	it('Wave B5 stream paths document text/event-stream named $ref', () => {
		const pilot = JSON.parse(readFileSync(PILOT_PATH, 'utf8')) as {
			paths: Record<
				string,
				Record<
					string,
					{
						responses?: Record<
							string,
							{
								content?: {
									'text/event-stream'?: { schema?: { $ref?: string } };
								};
							}
						>;
					}
				>
			>;
			components: { schemas: Record<string, unknown> };
		};

		const rows = [
			{
				path: '/api/v1/desktop/ai-chat/chats/{chat_id}/stream',
				method: 'post',
				schema: 'DesktopAiChatStreamSsePayloadDoc',
			},
			{
				path: '/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/{session_id}/events',
				method: 'get',
				schema: 'DiscussionEventsStreamSsePayloadDoc',
			},
		] as const;

		for (const row of rows) {
			const op = pilot.paths[row.path]?.[row.method];
			expect(op, row.path).toBeTruthy();
			const schema =
				op?.responses?.['200']?.content?.['text/event-stream']?.schema;
			expect(schema?.$ref).toBe(`#/components/schemas/${row.schema}`);
			expect(pilot.components.schemas[row.schema]).toBeTruthy();
		}
	});
});
