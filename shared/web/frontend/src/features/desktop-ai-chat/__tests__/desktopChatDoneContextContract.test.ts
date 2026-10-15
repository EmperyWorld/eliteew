import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { DesktopAiStreamContextSummary } from '../api/desktopChatClient';
import { formatDesktopAiContextSummaryLine } from '../desktopChatContextSummary';
import { extractDoneStreamContext } from '../desktopChatSsePayload';

const GOLDEN_PATH = resolve(
	__dirname,
	'../../../../../../api/tests/fixtures/desktop_chat_done_context_golden.json'
);

const t = ((key: string, opts?: Record<string, unknown>) => {
	if (key === 'contextSummaryPrefix') {
		return `CTX(${opts?.parts ?? ''})`;
	}
	return key;
}) as TFunction<'desktopAiChat'>;

describe('desktop chat done.context golden contract', () => {
	it('loads shared golden fixture from api/tests/fixtures', () => {
		const golden = JSON.parse(
			readFileSync(GOLDEN_PATH, 'utf-8')
		) as DesktopAiStreamContextSummary;
		expect(golden.chat_rag_quality?.unique_content_ids).toBe(0);
		expect(golden.context_policy_applied).toBe(false);
	});

	it('extracts and formats golden done payload', () => {
		const golden = JSON.parse(
			readFileSync(GOLDEN_PATH, 'utf-8')
		) as DesktopAiStreamContextSummary;
		const ctx = extractDoneStreamContext({ event: 'done', context: golden });
		expect(ctx).toEqual(golden);
		// Empty retrieval chrome: zero materials → no footnote line.
		expect(formatDesktopAiContextSummaryLine(ctx ?? undefined, t)).toBe('');
		const withMemory: DesktopAiStreamContextSummary = {
			...golden,
			memory_cell_requested: true,
			memory_cell_chunks: 2,
		};
		const memLine = formatDesktopAiContextSummaryLine(withMemory, t);
		expect(memLine).toContain('contextMemoryCellMaterials');
	});
});
