/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Memory cell create-chat attach contract', () => {
	it('solo slot create passes memory_cell_id and loads ready cells', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../hooks/useDesktopAiChatSoloSlot.ts'),
			'utf8'
		);
		expect(src).toContain('listDesktopAiMemoryCells');
		expect(src).toContain('memory_cell_id: attachCellId');
		expect(src).toContain("c.status === 'ready'");
	});

	it('hero picker exposes memory cell select', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../components/DesktopAiChatModals.tsx'),
			'utf8'
		);
		expect(src).toContain('memoryCellPickerLabel');
		expect(src).toContain('setPickedMemoryCellId');
	});
});
