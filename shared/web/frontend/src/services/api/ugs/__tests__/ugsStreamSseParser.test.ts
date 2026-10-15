/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for UGS SSE block parsing.
 *
 * Invariants:
 * - Parser accepts CRLF, keep-alive comments, and multi-line `data:` payloads.
 *
 * Related:
 * - src/services/api/ugs/stream.ts
 */
import { describe, expect, it } from 'vitest';
import { parseUgsSseBlock } from '../stream';

describe('parseUgsSseBlock', () => {
	it('parses CRLF blocks with optional spaces after field separators', () => {
		expect(
			parseUgsSseBlock('event: started\r\ndata: {"request_id":"r1"}\r\n')
		).toEqual({
			event: 'started',
			data: '{"request_id":"r1"}',
		});
	});

	it('joins multi-line data and skips comments', () => {
		expect(
			parseUgsSseBlock(
				': keep-alive\nevent: progress\ndata: {"a":1,\ndata: "b":2}'
			)
		).toEqual({
			event: 'progress',
			data: '{"a":1,\n"b":2}',
		});
	});

	it('returns null for keep-alive blocks without data', () => {
		expect(parseUgsSseBlock(': keep-alive\n\n')).toBeNull();
	});
});
