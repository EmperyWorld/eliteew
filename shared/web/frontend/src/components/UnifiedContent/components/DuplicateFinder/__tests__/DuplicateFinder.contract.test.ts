/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for Duplicates tab: preview + potential single-delete wiring.
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const panelSource = readFileSync(join(here, '../DuplicateFinder.tsx'), 'utf8');

describe('DuplicateFinder contract', () => {
	it('opens FilePreviewModal after getContent for duplicate rows', () => {
		expect(panelSource).toContain('FilePreviewModal');
		expect(panelSource).toContain('openFilePreview');
		expect(panelSource).toContain('contentApi.getContent');
		expect(panelSource).toContain("t('duplicates.preview'");
	});

	it('allows confirmed single delete from potential duplicate rows', () => {
		expect(panelSource).toContain("t('duplicates.deletePotential'");
		expect(panelSource).toContain('setPendingSingleDelete');
		expect(panelSource).toContain('executeDeleteSingle');
		expect(panelSource).toContain('ConfirmDeleteModal');
	});

	it('locales cover preview and potential delete', () => {
		const ru = JSON.parse(
			readFileSync(
				join(here, '../../../../../i18n/locales/ru/contentManager.json'),
				'utf8'
			)
		) as { duplicates: Record<string, string> };
		const en = JSON.parse(
			readFileSync(
				join(here, '../../../../../i18n/locales/en/contentManager.json'),
				'utf8'
			)
		) as { duplicates: Record<string, string> };
		expect(ru.duplicates.preview).toMatch(/Просмотр/i);
		expect(en.duplicates.preview).toMatch(/Preview/i);
		expect(ru.duplicates.deletePotential).toBeTruthy();
		expect(en.duplicates.deletePotential).toBeTruthy();
		expect(ru.duplicates.previewError).toBeTruthy();
	});
});
